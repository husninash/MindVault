// MindVault Google Gemini AI Integration Client
const MindVaultGemini = {
  getApiKey() {
    return (window.ENV && window.ENV.GEMINI_API_KEY) ||
      localStorage.getItem('MINDVAULT_GEMINI_KEY') ||
      '';
  },

  async askGemini(prompt, systemInstruction = '') {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.log('ℹ️ Gemini API key not configured. Using local intelligence fallback.');
      return null;
    }

    // Primary model: gemini-2.5-flash
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${response.status}`;
        console.warn('Gemini API Error:', response.status, errJson);
        return { error: true, message: errMsg };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || null;
    } catch (err) {
      console.warn('Gemini fetch failed:', err);
      return { error: true, message: err.message || "Gagal menghubungi endpoint Gemini API." };
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

      return `Halo! 👋 Saya **MindVault Assistant**, asisten kecerdasan relasi pribadi Anda.
      
Ada yang bisa saya bantu hari ini? Kamu bisa bertanya tentang:
* 👥 **Profil & Minat Teman** ${friendsCount > 0 ? `(misal: *${recentNames}*)` : ''}
* 💡 **Ide Obrolan / Topik Hari Ini** (RAG Engine)
* 📖 **Analisis Jurnal Memori Percakapan**
* 🎁 **Rekomendasi Kado & Persiapan Pertemuan (Meeting Prep)**

Ketik pertanyaanmu dengan santai! 😊✨`;
    }

    // 2. Check if user is asking about topics / starters / reflections
    if (/topik|topic|starter|pemantik|renungan|thought|ide obrolan|bahan ngobrol/i.test(query)) {
      const starters = (liveTopicsData && liveTopicsData.starters && liveTopicsData.starters.length > 0)
        ? liveTopicsData.starters
        : ["Ask Sophia about Mochi's Friday vet checkup", "Congratulate Liam on his 45km marathon training run"];
      const reflections = (liveTopicsData && liveTopicsData.reflections && liveTopicsData.reflections.length > 0)
        ? liveTopicsData.reflections
        : ["Great relationships aren't built on grand gestures, but on remembering the small details that matter."];

      return `💡 **Today's Topics & RAG Insights**

Berikut adalah topik & ide pemantik obrolan yang tersimpan di RAG Database kamu:

* **💡 AI Suggested Starters:**
${starters.map(s => `  * "${s}"`).join('\n')}

* **📝 Relationship Reflections:**
${reflections.map(r => `  * "${r}"`).join('\n')}

---
🌱 **Saran AI:** Gunakan ide pemantik di atas untuk mencairkan suasana saat mengobrol dengan teman-temanmu hari ini!`;
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
        return `🎁 **Rekomendasi Hadiah untuk ${matchedFriend.name}**

Berdasarkan profil & kesukaan ${matchedFriend.name}:
* **Minat / Hal yang Disukai:** ${likesStr}
* **Ide Hadiah Tercatat:**
${giftList.length > 0 ? giftList.map(g => `  * 🎁 **${g.item}** ${g.price ? `(${g.price})` : ''}`).join('\n') : '  * Belum ada ide hadiah spesifik, coba barang terkait hobinya!'}

💡 **Tips AI:** Berikan kado yang berkaitan dengan kesukaannya atau momen spesial terdekatnya!`;
      }

      if (/ultah|ulang tahun|birthday|wisuda|lahiran|acara|momen|jadwal/i.test(query)) {
        return `📅 **Jadwal & Momen Spesial ${matchedFriend.name}**

* **Tanggal Lahir:** ${matchedFriend.birthday || 'Belum diisi'}
* **Momen Mendatang:**
${milestones.length > 0 ? milestones.map(m => `  * ${m.type || '✨'}: **${m.title}** (📅 ${m.date}) ${m.notes ? `- *"${m.notes}"*` : ''}`).join('\n') : '  * Belum ada momen spesial tambahan yang dicatat.'}

🌱 **Saran AI:** Kamu bisa memanfaatkan fitur *Meeting Prep* untuk menyiapkan topik obrolan saat momen tersebut tiba!`;
      }

      return `👤 **Profil Relasi: ${matchedFriend.name} (${matchedFriend.relation || 'Friend'})**

* **Skor Hubungan:** ${matchedFriend.score || 85}% (Tier: ${matchedFriend.tier || 'Friend'})
* **Kabar Terkini:** ${matchedFriend.currentLife || 'Belum ada update'}
* **Topik Obrolan Aman 🟢:** ${safeStr}
* **Topik yang Dihindari 🔴:** ${avoidStr}
* **Riwayat Percakapan Tercatat:** ${friendDiaries.length} memori log

${friendDiaries.length > 0 ? `📖 **Log Terakhir:** "${friendDiaries[0].title}" (${friendDiaries[0].date})` : 'Belum ada catatan memori khusus dengan teman ini.'}`;
    }

    // 4. Checking general relationship questions or memory evaluation
    if (diariesData.length > 0 && (/jurnal|memori|percakapan|obrolan|terakhir|evaluasi/i.test(query))) {
      const latest = diariesData[0];
      return `📖 **Analisis Jurnal Memori Terakhir: "${latest.title}"**

* **Teman:** ${latest.friendName || 'Teman'}
* **Tanggal:** ${latest.date || 'Tercatat'}
* **Mood:** ${latest.mood || 'Reflektif'}
* **Rangkuman Isi:** "${latest.content}"

💡 **Saran AI:** Jaga komunikasi yang konsisten dan catat hal-hal penting berikutnya saat kamu mengobrol lagi dengan ${latest.friendName || 'mereka'}!`;
    }

    // 5. Default natural helpful response
    return `✨ **MindVault Intelligence Assistant**

Saya siap membantu menganalisis hubungan dan memberikan saran obrolan!
Kamu dapat:
1. Menyebutkan nama teman (misal: *"${friendsData[0] ? friendsData[0].name : 'Nama Teman'}"*) untuk melihat saran topik atau ide kado.
2. Bertanya tentang *"Topik hari ini"* untuk rekomendasi ide pemantik obrolan.
3. Bertanya tentang evaluasi percakapan atau momen penting yang sedang kamu hadapi.

*Tip: Tambahkan Google Gemini API Key di **Admin Console** untuk analisis AI generatif ultra-cerdas tanpa batas!* 🚀`;
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
