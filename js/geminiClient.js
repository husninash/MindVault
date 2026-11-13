// MindVault Google Gemini AI Integration Client
const MindVaultGemini = {
  getApiKey() {
    return (window.ENV && window.ENV.GEMINI_API_KEY) ||
      localStorage.getItem('MINDVAULT_GEMINI_KEY') ||
      '';
  },

  // Models tried in order when one is overloaded (Google returns 503/429 during demand spikes)
  models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],

  // POST a generateContent request with retry + model fallback.
  // Returns { data } on success or { error: true, message } on failure.
  async generate(body) {
    const apiKey = this.getApiKey();
    if (!apiKey) return { error: true, message: 'Gemini API key belum diatur. Isi di menu Settings.' };
    const busy = (status) => status === 429 || status === 500 || status === 503 || status === 504;
    let lastError = null;

    for (const model of this.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let response;
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        } catch (err) {
          lastError = { status: 0, message: err.message || 'Gagal menghubungi Gemini.' };
          break; // network problem: try the next model
        }
        if (response.ok) return { data: await response.json(), model };

        const errJson = await response.json().catch(() => ({}));
        lastError = { status: response.status, message: errJson.error?.message || `HTTP ${response.status}` };
        console.warn(`Gemini ${model} error:`, response.status, lastError.message);
        if (response.status === 404) break;            // model not available for this key: next model
        if (!busy(response.status)) return { error: true, message: lastError.message }; // bad key / bad request
        if (attempt === 0) await new Promise(r => setTimeout(r, 1200));
      }
    }

    if (lastError && busy(lastError.status)) {
      return { error: true, message: 'Server Gemini sedang penuh. Sudah dicoba beberapa model tapi semuanya sibuk — coba lagi sebentar lagi.' };
    }
    return { error: true, message: lastError?.message || 'Gagal menghubungi Gemini.' };
  },

  async askGemini(prompt, systemInstruction = '') {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.log('ℹ️ Gemini API key not configured. Using local intelligence fallback.');
      return null;
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };
    if (systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await this.generate(requestBody);
    if (res.error) return res;
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  },

  // English vocabulary breakdown for a word or phrase the user picked up from shows/videos.
  // Returns the parsed entry object or { error, message }.
  async analyzeVocab(word) {
    const apiKey = this.getApiKey();
    if (!apiKey) return { error: true, message: 'Gemini API key belum diatur. Isi di menu Settings.' };

    const prompt = `Kamu adalah guru bahasa Inggris untuk pelajar Indonesia. Analisis kata/frasa bahasa Inggris berikut: "${word}".
Kalau ejaannya salah, perbaiki dan analisis bentuk yang benar. Kalau itu phrasal verb, idiom, atau slang, jelaskan sebagai frasa.

Balas HANYA dengan JSON (tanpa markdown) dengan struktur persis seperti ini:
{
  "word": "bentuk dasar yang benar",
  "corrected": true/false (true kalau input dikoreksi),
  "phonetic": "IPA, misal /raɪt/",
  "meaning": "arti utama dalam bahasa Indonesia, singkat",
  "level": "perkiraan CEFR: A1/A2/B1/B2/C1/C2",
  "forms": [
    { "pos": "verb|noun|adjective|adverb|...", "word": "bentuk kata", "meaning": "arti Indonesia", "example": "1 kalimat contoh pendek bahasa Inggris" },
    { "pos": "adverb", "word": "", "none": true, "alternative": "frasa pengganti yang umum, misal 'in writing'", "meaning": "arti frasa pengganti", "example": "contoh kalimat pakai frasa pengganti" }
  ],
  "verb_forms": { "base": "", "past": "", "past_participle": "", "present_participle": "", "third_person": "" } atau null kalau tidak ada bentuk verb,
  "synonyms": [ { "word": "", "meaning": "arti Indonesia" } ],
  "antonyms": [ { "word": "", "meaning": "arti Indonesia" } ],
  "examples": [ { "en": "kalimat contoh natural sehari-hari", "id": "terjemahan Indonesia" } ],
  "collocations": ["kombinasi kata yang umum, misal 'write a letter'"],
  "tip": "1-2 kalimat tips pemakaian/kesalahan umum dalam bahasa Indonesia"
}
Aturan: "forms" WAJIB memuat keempat jenis utama verb, noun, adjective, dan adverb (urut seperti itu), ditambah kata turunan lain yang umum (misal writer/writing/written), maksimal 10.
Kalau salah satu jenis utama tidak punya bentuk yang umum dipakai, tetap tulis barisnya dengan "word": "" dan "none": true, lalu isi "alternative" dengan frasa pengganti yang umum (misal adverb dari write → "in writing") beserta arti dan contohnya; kalau benar-benar tidak ada pengganti, kosongkan "alternative". Jangan mengarang kata yang tidak ada di kamus.
Synonyms dan antonyms masing-masing 3-6 (antonyms boleh kosong kalau memang tidak ada). Examples 3 kalimat dengan konteks berbeda, gaya percakapan seperti di film/serial. Collocations 3-5.`;

    try {
      const res = await this.generate({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
      });
      if (res.error) return res;
      const data = res.data;
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { error: true, message: 'Jawaban AI tidak bisa dibaca. Coba lagi.' };
      const entry = JSON.parse(match[0]);
      if (!entry.word) return { error: true, message: 'Kata tidak dikenali. Cek ejaannya.' };
      return entry;
    } catch (err) {
      return { error: true, message: err.message || 'Gagal menghubungi Gemini.' };
    }
  },

  // Conversation topics grounded in today's news via Gemini's Google Search tool.
  // Returns { topics: [{ headline, topic, friend, why }], sources: [{ title, uri }], searchEntryHtml }
  // or { error: true, message }.
  async fetchNewsTopics(friends) {
    const apiKey = this.getApiKey();
    if (!apiKey) return { error: true, message: 'Gemini API key belum diatur. Isi di menu Settings.' };

    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const interests = (friends || []).slice(0, 12).map(f => {
      const likes = [...(f.likes || []), ...(f.favorites?.hobby ? [f.favorites.hobby] : [])].slice(0, 6).join(', ');
      return `- ${f.name}: ${likes || f.bio || 'minat belum dicatat'}`;
    }).join('\n');

    const prompt = `Hari ini ${today}. Cari berita terbaru (maksimal 3 hari terakhir) dengan Google Search, utamakan Indonesia lalu dunia.
${interests ? `Pilih berita yang nyambung dengan minat teman-teman berikut:\n${interests}\n` : 'Pilih berita umum yang enak dijadikan bahan obrolan santai.\n'}
Buat 4 topik obrolan. Balas HANYA dengan JSON array tanpa teks lain, format:
[{"headline": "judul berita singkat", "topic": "kalimat pembuka obrolan dalam Bahasa Indonesia santai", "friend": "nama teman yang cocok atau null", "why": "alasan singkat kenapa relevan"}]`;

    try {
      const res = await this.generate({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }]
      });
      if (res.error) return res;
      const data = res.data;
      const candidate = data.candidates?.[0] || {};
      const text = (candidate.content?.parts || []).map(p => p.text || '').join('');
      // Search grounding can't be combined with JSON mode, so pull the array out of the text
      const match = text.match(/\[[\s\S]*\]/);
      let topics = [];
      try {
        topics = match ? JSON.parse(match[0]) : [];
      } catch (e) {
        topics = [];
      }
      topics = (Array.isArray(topics) ? topics : []).filter(t => t && t.topic).slice(0, 4);
      if (topics.length === 0) return { error: true, message: 'AI tidak mengembalikan topik. Coba lagi.' };

      const meta = candidate.groundingMetadata || {};
      const seen = new Set();
      const sources = (meta.groundingChunks || [])
        .map(c => c.web)
        .filter(w => w && w.uri && !seen.has(w.uri) && seen.add(w.uri))
        .slice(0, 6)
        .map(w => ({ title: w.title || w.uri, uri: w.uri }));

      return { topics, sources, searchEntryHtml: meta.searchEntryPoint?.renderedContent || '' };
    } catch (err) {
      return { error: true, message: err.message || 'Gagal menghubungi Gemini API.' };
    }
  },

  // Deep Relationship Intelligence Assistant Prompt with Full RAG Database
  async chatWithAssistant(userQuery, friendsData, diariesData, dailyJournalsData, activeFriendId, liveTopicsData) {
    const friendsContext = (friendsData || []).map(f => `
- Friend Name: ${f.name} (ID: ${f.id}, Relation: ${f.relation || 'Friend'})
  Birthday: ${f.birthday || 'N/A'}
  Upcoming Special Milestones & Events: ${JSON.stringify(f.milestones || [])}
  Intimacy Score: ${f.score || 85}%
  Bio: ${f.bio || '-'}
  Current Life Status: ${f.currentLife || '-'}
  Safe Topics: ${(f.safeTopics || []).join(', ')}
  Topics to Avoid: ${(f.avoidTopics || []).join(', ')}
  Gift Ideas: ${JSON.stringify(f.giftIdeas || [])}
  AI Memory Summary: ${f.aiSummary || '-'}
`).join('\n');

    const diariesContext = (diariesData || []).map(d => `
- [Log Date: ${d.date}] Friend: "${d.friendName}" | Title: "${d.title}"
  Mood: ${d.mood || 'Reflective'}
  Location: ${d.location || 'Log'}
  EXACT LOGGED CONTENT: "${d.content}"
  Tags: ${(d.tags || []).join(', ')}
`).join('\n');

    const dailyContext = (dailyJournalsData || []).map(j => `
- [Daily Reflection Date: ${j.date}] "${j.title}" (Mood: ${j.mood})
  Content: "${j.content}"
  Gratitude: "${j.gratitude || 'N/A'}"
`).join('\n');

    const startersContext = ((liveTopicsData && liveTopicsData.starters) || []).map(s => `- [AI Suggested Starter] "${s}"`).join('\n');
    const reflectionsContext = ((liveTopicsData && liveTopicsData.reflections) || []).map(r => `- [Personal Relationship Reflection] "${r}"`).join('\n');

    const activeFriend = (friendsData || []).find(f => f.id === activeFriendId) || (friendsData || [])[0];
    const targetFriendName = (diariesData && diariesData[0] && diariesData[0].friendName) ? diariesData[0].friendName : (activeFriend ? activeFriend.name : 'Ethan');

    const latestDiary = (diariesData && diariesData.length > 0) ? diariesData[0] : null;

    const systemInstruction = `YOU ARE MINDVAULT AI, A COMPREHENSIVE RAG-POWERED RELATIONSHIP INTELLIGENCE ASSISTANT.

MANDATORY RAG & BEHAVIOR RULES:
1. ALWAYS RESPOND IN WARM, EMPATHETIC INDONESIAN LANGUAGE.
2. YOU HAVE COMPLETE ACCESS TO THE USER'S RAG DATABASE (FRIEND PROFILES, CONVERSATION MEMORIES, TODAY'S TOPICS & STARTERS, AND PERSONAL REFLECTIONS).
3. ADAPT TO USER INTENT NATURALLY:
   - If the user asks about "topik hari ini", "starters", "pemantik", "renungan", "ide obrolan", use the "TODAY'S TOPICS & AI SUGGESTED STARTERS" and "PERSONAL REFLECTIONS" below.
   - If the user asks about relationships, conversation memories, conflicts, logs, pronouns ("dia"), or asks for evaluation/analysis:
     Inspect the "LOGGED CONVERSATION MEMORIES" below (e.g. "${latestDiary ? latestDiary.title : 'Closure'}") and provide a deep, thoughtful relationship analysis addressing any conflict or tension.
   - If the user asks general questions (gifts, bios, catchup), answer naturally.

LIVE RAG DATABASE CONTEXT:

### TODAY'S TOPICS & AI SUGGESTED STARTERS (RAG):
${startersContext || 'No starters active today.'}

### PERSONAL RELATIONSHIP THOUGHTS & REFLECTIONS (RAG):
${reflectionsContext || 'No personal reflections active today.'}

### FRIEND PROFILES (RAG):
${friendsContext || 'No friends added yet.'}

### LOGGED CONVERSATION MEMORIES (RAG):
${diariesContext || 'No conversation memories logged yet.'}

### PERSONAL DAILY REFLECTIONS (RAG):
${dailyContext || 'No daily reflections logged yet.'}

Respond in clean Indonesian markdown using bold headers, bullet points, and emojis.`;

    // Smart Intent Classifier
    const isLogOrRelationshipQuery = /log|jurnal|journal|analis|analiz|evaluas|hubung|ingat|ingatan|rekam|tengkar|bertikai|closure|move on|benci|kecewa|memburuk|dia|beliau|ia|percakapan|obrolan|kemarin|momen|njim|masukkan/i.test(userQuery);
    const isTopicQuery = /topik|topic|starter|pemantik|renungan|thought|ide obrolan|bicara|ngobrol/i.test(userQuery);

    let enrichedUserPrompt = userQuery;

    if (isTopicQuery) {
      enrichedUserPrompt = `PESAN USER: "${userQuery}"

DATABASE RAG TOPIC & RENUNGAN HARI INI:
- Pemantik Obrolan:
${startersContext || '- Tidak ada pemantik.'}
- Renungan Hubungan:
${reflectionsContext || '- Tidak ada renungan.'}

PETUNJUK:
Jawab pertanyaan user menggunakan data RAG Topik & Renungan Hari Ini di atas dalam Bahasa Indonesia.`;
    } else if (isLogOrRelationshipQuery && latestDiary) {
      enrichedUserPrompt = `PESAN USER: "${userQuery}"

CATATAN JURNAL TERKAIT DALAM DATABASE RAG:
- Teman: ${latestDiary.friendName || targetFriendName}
- Judul Log: "${latestDiary.title}"
- Isi Catatan Percakapan: "${latestDiary.content}"

PETUNJUK:
User merujuk pada jurnal/percakapan di atas. Bacalah isi catatan jurnal tersebut dengan cermat dan berikan analisis emosional & saran hubungan yang relevan dalam Bahasa Indonesia.`;
    }

    const result = await this.askGemini(enrichedUserPrompt, systemInstruction);
    if (result && !result.error && typeof result === 'string' && result.length > 15) {
      return result;
    }

    // Local Smart Analysis Fallback
    return this.localSmartAnalysisFallback(userQuery, friendsData, diariesData, dailyJournalsData, liveTopicsData);
  },

  // Smart Contextual Local Analysis Engine (Dynamic & Adaptive)
  localSmartAnalysisFallback(userQuery, friendsData = [], diariesData = [], dailyJournalsData = [], liveTopicsData = {}) {
    const query = (userQuery || '').toLowerCase().trim();

    // 1. Handling Greetings & Casual Chat
    if (/^(halo|hai|hi|hey|hello|pagi|siang|sore|malam|assalamualaikum|tes|test)\b/i.test(query)) {
      const friendsCount = friendsData.length;
      const recentNames = friendsData.slice(0, 3).map(f => f.name).join(', ');

      return `Halo! Saya **MindVault Assistant**, asisten kecerdasan relasi pribadi Anda.
      
Ada yang bisa saya bantu hari ini? Kamu bisa bertanya tentang:
* **Profil & Minat Teman** ${friendsCount > 0 ? `(misal: *${recentNames}*)` : ''}
* **Ide Obrolan / Topik Hari Ini** (RAG Engine)
* **Analisis Jurnal Memori Percakapan**
* **Rekomendasi Kado & Persiapan Pertemuan (Meeting Prep)**

Ketik pertanyaan Anda tentang relasi dan memori pertemanan.`;
    }

    // 2. Check if user is asking about topics / starters / reflections
    if (/topik|topic|starter|pemantik|renungan|thought|ide obrolan|bahan ngobrol/i.test(query)) {
      const starters = (liveTopicsData && liveTopicsData.starters) || [];
      const reflections = (liveTopicsData && liveTopicsData.reflections) || [];

      if (starters.length === 0 && reflections.length === 0) {
        return `Belum ada topik atau renungan yang tersimpan. Buka menu **Today's Topics** dan klik **+ Tambah Topik / Renungan** untuk menambahkan yang pertama.`;
      }

      return `**Today's Topics & RAG Insights**

Berikut adalah topik & ide pemantik obrolan yang tersimpan di RAG Database kamu:

* **AI Suggested Starters:**
${starters.map(s => `  * "${s}"`).join('\n')}

* **Relationship Reflections:**
${reflections.map(r => `  * "${r}"`).join('\n')}

---
**Saran AI:** Gunakan ide pemantik di atas untuk mencairkan suasana saat mengobrol dengan teman-temanmu hari ini!`;
    }

    // 3. Match friend by name mentioned in query
    let matchedFriend = friendsData.find(f => f.name && query.includes(f.name.toLowerCase()));

    // If friend is mentioned
    if (matchedFriend) {
      const friendDiaries = diariesData.filter(d => String(d.friendId) === String(matchedFriend.id) || (d.friendName && d.friendName.toLowerCase() === matchedFriend.name.toLowerCase()));
      const milestones = matchedFriend.milestones || [];
      const likesStr = (matchedFriend.likes && matchedFriend.likes.length > 0) ? matchedFriend.likes.join(', ') : 'Belum dicatat';
      const safeStr = (matchedFriend.safeTopics && matchedFriend.safeTopics.length > 0) ? matchedFriend.safeTopics.join(', ') : 'Hobi santai, kabar sehari-hari';
      const avoidStr = (matchedFriend.avoidTopics && matchedFriend.avoidTopics.length > 0) ? matchedFriend.avoidTopics.join(', ') : 'Tidak ada catatan';

      if (/kado|hadiah|gift/i.test(query)) {
        const giftList = matchedFriend.giftIdeas || [];
        return `**Rekomendasi Hadiah untuk ${matchedFriend.name}**

Berdasarkan profil & kesukaan ${matchedFriend.name}:
* **Minat / Hal yang Disukai:** ${likesStr}
* **Ide Hadiah Tercatat:**
${giftList.length > 0 ? giftList.map(g => `  * **${g.item}** ${g.price ? `(${g.price})` : ''}`).join('\n') : '  * Belum ada ide hadiah spesifik, coba barang terkait hobinya!'}

**Tips AI:** Berikan kado yang berkaitan dengan kesukaannya atau momen spesial terdekatnya!`;
      }

      if (/ultah|ulang tahun|birthday|wisuda|lahiran|acara|momen|jadwal/i.test(query)) {
        return `**Jadwal & Momen Spesial ${matchedFriend.name}**

* **Tanggal Lahir:** ${matchedFriend.birthday || 'Belum diisi'}
* **Momen Mendatang:**
${milestones.length > 0 ? milestones.map(m => `  * ${m.type || "Momen Spesial"}: **${m.title}** (${m.date}) ${m.notes ? `- *"${m.notes}"*` : ''}`).join('\n') : '  * Belum ada momen spesial tambahan yang dicatat.'}

**Saran AI:** Anda bisa memanfaatkan fitur *Meeting Prep* untuk menyiapkan topik obrolan saat momen tersebut tiba!`;
      }

      return `**Profil Relasi: ${matchedFriend.name} (${matchedFriend.relation || 'Friend'})**

* **Skor Hubungan:** ${matchedFriend.score || 85}% (Tier: ${matchedFriend.tier || 'Friend'})
* **Kabar Terkini:** ${matchedFriend.currentLife || 'Belum ada update'}
* **Topik Obrolan Aman:** ${safeStr}
* **Topik yang Dihindari:** ${avoidStr}
* **Riwayat Percakapan Tercatat:** ${friendDiaries.length} memori log

${friendDiaries.length > 0 ? `**Log Terakhir:** "${friendDiaries[0].title}" (${friendDiaries[0].date})` : 'Belum ada catatan memori khusus dengan teman ini.'}`;
    }

    // 4. Checking general relationship questions or memory evaluation
    if (diariesData.length > 0 && (/jurnal|memori|percakapan|obrolan|terakhir|evaluasi/i.test(query))) {
      const latest = diariesData[0];
      return `**Analisis Jurnal Memori Terakhir: "${latest.title}"**

* **Teman:** ${latest.friendName || 'Teman'}
* **Tanggal:** ${latest.date || 'Tercatat'}
* **Mood:** ${latest.mood || 'Reflektif'}
* **Rangkuman Isi:** "${latest.content}"

**Saran AI:** Jaga komunikasi yang konsisten dan catat hal-hal penting berikutnya saat kamu mengobrol lagi dengan ${latest.friendName || 'mereka'}!`;
    }

    // 5. Default natural helpful response
    return `**MindVault Intelligence Assistant**

Saya siap membantu menganalisis hubungan dan memberikan saran obrolan!
Kamu dapat:
1. Menyebutkan nama teman (misal: *"${friendsData[0] ? friendsData[0].name : 'Nama Teman'}"*) untuk melihat saran topik atau ide kado.
2. Bertanya tentang *"Topik hari ini"* untuk rekomendasi ide pemantik obrolan.
3. Bertanya tentang evaluasi percakapan atau momen penting yang sedang kamu hadapi.

*Tip: Tambahkan Google Gemini API Key di **Admin Console** untuk analisis AI generatif.`;
  },

  // Simulator Roleplay Prompt for a specific friend
  async roleplayFriend(friend, userMessage) {
    const systemInstruction = `You are roleplaying as ${friend.name} (${friend.relation}).
Your bio: ${friend.bio}
Your current life update: ${friend.currentLife}
Things you like/love: ${(friend.likes || []).join(', ')}
Safe topics you enjoy: ${(friend.safeTopics || []).join(', ')}
Topics to avoid/dislike: ${(friend.avoidTopics || []).join(', ')}

Respond in character as ${friend.name} talking casually to your close friend in INDONESIAN. Be natural, warm, conversational, and stay true to your personality. Keep responses under 3 sentences.`;

    const result = await this.askGemini(userMessage, systemInstruction);
    if (result && !result.error && typeof result === 'string') return result;

    return `Hey! Senang banget bisa ngobrol lagi. Soal kabar terbaruku, ${friend.currentLife || 'lagi sibuk kegiatan sehari-hari nih'}. Gimana kabarmu?`;
  }
};
