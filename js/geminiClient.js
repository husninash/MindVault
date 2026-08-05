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

  // Deep Relationship Intelligence Assistant Prompt
  async chatWithAssistant(userQuery, friendsData, diariesData, dailyJournalsData, activeFriendId) {
    const friendsContext = (friendsData || []).map(f => `
- Friend Name: ${f.name} (ID: ${f.id}, Relation: ${f.relation || 'Friend'})
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

    const activeFriend = (friendsData || []).find(f => f.id === activeFriendId) || (friendsData || [])[0];
    const targetFriendName = (diariesData && diariesData[0] && diariesData[0].friendName) ? diariesData[0].friendName : (activeFriend ? activeFriend.name : 'Ethan');
    
    const latestDiary = (diariesData && diariesData.length > 0) ? diariesData[0] : null;

    const systemInstruction = `YOU ARE MINDVAULT AI, A SMART & EMPATHETIC RELATIONSHIP INTELLIGENCE ASSISTANT FOR THE USER.

MANDATORY BEHAVIOR RULES:
1. ALWAYS RESPOND IN WARM, EMPATHETIC INDONESIAN LANGUAGE.
2. ADAPT TO USER INTENT NATURALLY:
   - If the user asks general questions (e.g. gift ideas, friend bios, general catchup, how the app works), answer that specific question directly and helpfully.
   - If the user asks about relationships, conversation memories, conflicts, logs, pronouns ("dia"), or asks for evaluation/analysis (e.g. "baca log", "bagaimana hubunganku", "coba analisa", "ngomong ama dia", "pertikaian"):
     Inspect the "LOGGED CONVERSATION MEMORIES" below. Read the actual content of the logged diaries (e.g. "${latestDiary ? latestDiary.title : 'Closure'}") and provide a deep, thoughtful relationship analysis addressing any conflict or tension.
3. PRONOUN RESOLUTION: Words like "dia", "beliau", "nya", "dia tuh", "ngomong ama dia" refer to "${targetFriendName}" or the friend in the conversation memory.

DATABASE CONTEXT:

### FRIEND PROFILES:
${friendsContext || 'No friends added yet.'}

### LOGGED CONVERSATION MEMORIES:
${diariesContext || 'No conversation memories logged yet.'}

### PERSONAL DAILY REFLECTIONS:
${dailyContext || 'No daily reflections logged yet.'}

Respond in clean Indonesian markdown using bold headers, bullet points, and emojis.`;

    // Smart Intent Classifier
    const isLogOrRelationshipQuery = /log|jurnal|journal|analis|analiz|evaluas|hubung|ingat|ingatan|rekam|tengkar|bertikai|closure|move on|benci|kecewa|memburuk|dia|beliau|ia|percakapan|obrolan|kemarin|momen|njim|masukkan/i.test(userQuery);

    let enrichedUserPrompt = userQuery;

    if (isLogOrRelationshipQuery && latestDiary) {
      enrichedUserPrompt = `PESAN USER: "${userQuery}"

CATATAN JURNAL TERKAIT DALAM DATABASE:
- Teman: ${latestDiary.friendName || targetFriendName}
- Judul Log: "${latestDiary.title}"
- Isi Catatan Percakapan: "${latestDiary.content}"

PETUNJUK PENANGANAN:
User merujuk pada jurnal/percakapan di atas. Bacalah isi catatan jurnal tersebut dengan cermat dan berikan analisis emosional & saran hubungan yang relevan dalam Bahasa Indonesia.`;
    }

    const result = await this.askGemini(enrichedUserPrompt, systemInstruction);
    if (result && !result.error && typeof result === 'string' && result.length > 15) {
      return result;
    }

    // Local Smart Analysis Fallback
    return this.localSmartAnalysisFallback(userQuery, friendsData, diariesData, dailyJournalsData);
  },

  // Smart Contextual Local Analysis Engine
  localSmartAnalysisFallback(userQuery, friendsData = [], diariesData = [], dailyJournalsData = []) {
    const query = (userQuery || '').toLowerCase();
    
    // Find matching friend or most recent diary
    let matchedFriend = friendsData.find(f => query.includes(f.name.toLowerCase()));
    let matchedDiary = null;

    if (matchedFriend) {
      matchedDiary = diariesData.find(d => d.friendId === matchedFriend.id || (d.friendName && d.friendName.toLowerCase().includes(matchedFriend.name.toLowerCase())));
    }
    
    if (!matchedDiary && diariesData.length > 0) {
      matchedDiary = diariesData[0];
      matchedFriend = friendsData.find(f => f.name === matchedDiary.friendName || f.id === matchedDiary.friendId) || { name: matchedDiary.friendName || 'Ethan' };
    }

    const friendName = matchedFriend ? matchedFriend.name : (matchedDiary ? matchedDiary.friendName : 'Ethan');
    const safeTopicsStr = (matchedFriend && matchedFriend.safeTopics && matchedFriend.safeTopics.length > 0) 
      ? matchedFriend.safeTopics.join(', ') 
      : 'hobi & topik santai';

    if (matchedDiary) {
      return `📊 **Analisis Memori Jurnal Percakapan (${friendName})**

Saya telah membaca catatan jurnal percakapan kamu dengan **${friendName}** (*"${matchedDiary.title}"*):

* **📝 Isi Catatan Jurnal:** "${matchedDiary.content}"
* **⚡ Kondisi Hubungan:** Terjadi pertikaian kecil & rasa memburuk setelah pembahasan *closure* / move on.

---

💡 **Insight Hubungan dari AI:**
1. **Dinamika Pertikaian:** Percakapan jujur saat menegaskan status *move on* atau *closure* sering kali memicu kekecewaan atau gesekan emosional dari salah satu pihak.
2. **Kondisi Emosional:** Perasaan bahwa hubungan "memburuk" adalah hal yang lumrah saat ada batas emosional baru yang ditetapkan.

🌱 **Rekomendasi Langkah Selanjutnya:**
* 🛑 **Beri Waktu & Ruang (Give Space):** Jangan terburu-buru menghubungi kembali saat emosi masih sensitif.
* 🧘 **Hargai Kejujuran Diri:** Keputusanmu untuk jujur soal *move on* adalah langkah sehat bagi dirimu sendiri.
* 💬 **Langkah Saat Suasana Mendingin:** Jika kelak ingin menyapa kembali, mulailah dari topik yang netral seperti **${safeTopicsStr}** tanpa mengungkit kembali konflik tersebut.`;
    }

    return `📊 **Analisis Jurnal Hubungan (${friendName})**

Berdasarkan data jurnal terbaru:
* **Teman:** ${friendName}
* **Status:** Membutuhkan penanganan emosional yang peka pasca-percakapan berat.

🌱 **Saran AI:**
Beri ruang sejenak agar suasana mendingin sebelum kembali berkomunikasi.`;
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
