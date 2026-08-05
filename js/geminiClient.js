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
  Favorites: ${JSON.stringify(f.favorites || {})}
  Safe Topics: ${(f.safeTopics || []).join(', ')}
  Topics to Avoid: ${(f.avoidTopics || []).join(', ')}
  AI Memory Summary: ${f.aiSummary || '-'}
`).join('\n');

    const diariesContext = (diariesData || []).map(d => `
- [Log Date: ${d.date}] Friend: "${d.friendName}" | Title: "${d.title}"
  Mood: ${d.mood || 'Reflective'}
  Location: ${d.location || 'Log'}
  Exact Logged Content: "${d.content}"
  Tags: ${(d.tags || []).join(', ')}
`).join('\n');

    const dailyContext = (dailyJournalsData || []).map(j => `
- [Daily Reflection Date: ${j.date}] "${j.title}" (Mood: ${j.mood})
  Content: "${j.content}"
  Gratitude: "${j.gratitude || 'N/A'}"
`).join('\n');

    const activeFriend = (friendsData || []).find(f => f.id === activeFriendId) || (friendsData || [])[0];

    const systemInstruction = `YOU ARE MINDVAULT AI, A COMPASSIONATE, HIGHLY PERCEPTIVE, AND EXPERT RELATIONSHIP INTELLIGENCE ASSISTANT FOR THE USER.

CRITICAL MANDATORY INSTRUCTIONS:
1. ALWAYS RESPOND IN WARM, NATURAL, AND EMPATHETIC INDONESIAN LANGUAGE. NEVER RESPOND IN ENGLISH.
2. PRONOUN & INTENT RESOLUTION:
   - When the user says "dia", "ia", "beliau", "nya", "conversation ku dengan dia", "hubungan kami", or asks for analysis, map "dia" to:
     a) The friend in the most recent conversation diary log (e.g. ${diariesData && diariesData[0] ? diariesData[0].friendName : 'Ethan'}), OR
     b) The active friend (${activeFriend ? activeFriend.name : 'Ethan'}).
3. DIRECT CONFLICT & PERTIKAIAN ANALYSIS:
   - Carefully read the "Exact Logged Content" in the conversation memories.
   - IF A DIARY LOG DESCRIBES AN ARGUMENT, CONFLICT, PERTIKAIAN, CLOSURE, RELATIONSHIP GETTING WORSE ("memburuk", "benci", "pertikaian", "closure", "tengkar"):
     YOU MUST DIRECTLY ACKNOWLEDGE AND ANALYZE THAT SPECIFIC CONFLICT AND PERTIKAIAN!
     DO NOT GIVE GENERIC CHEERFUL "SAY HI / RECONNECT" ADVICE!
     Instead:
     - Acknowledge the conflict and tension logged in the diary (e.g., "Closure dengan Ethan").
     - Explain the emotional dynamic behind the argument/closure.
     - Offer 3 realistic, empathetic steps to handle the situation or navigate the tension.

HERE IS THE USER'S LIVE RELATIONSHIP DATABASE:

### FRIEND PROFILES:
${friendsContext || 'No friends added yet.'}

### LOGGED CONVERSATION MEMORIES (MUST READ AND ANALYZE THESE):
${diariesContext || 'No conversation memories logged yet.'}

### PERSONAL DAILY REFLECTIONS:
${dailyContext || 'No daily reflections logged yet.'}

Respond in clean, well-formatted Indonesian markdown using bold headers, bullet points, and emojis.`;

    const result = await this.askGemini(userQuery, systemInstruction);
    if (result && !result.error && typeof result === 'string' && result.length > 20) {
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
      matchedDiary = diariesData.find(d => d.friendId === matchedFriend.id || d.friendName.toLowerCase().includes(matchedFriend.name.toLowerCase()));
    } else if (diariesData.length > 0) {
      matchedDiary = diariesData[0];
      matchedFriend = friendsData.find(f => f.name === matchedDiary.friendName || f.id === matchedDiary.friendId) || { name: matchedDiary.friendName || 'Ethan' };
    }

    if (matchedDiary) {
      const friendName = matchedFriend ? matchedFriend.name : (matchedDiary.friendName || 'Ethan');
      const safeTopicsStr = (matchedFriend && matchedFriend.safeTopics && matchedFriend.safeTopics.length > 0) 
        ? matchedFriend.safeTopics.join(', ') 
        : 'hobi & topik ringan';

      const isConflict = /pertikaian|memburuk|benci|tengkar|closure|kecewa|sedih|berpisah/i.test(matchedDiary.content + ' ' + matchedDiary.title);

      if (isConflict) {
        return `📊 **Analisis Memori Percakapan & Konflik (${friendName})**

Berdasarkan catatan jurnal percakapan kamu dengan **${friendName}** (*"${matchedDiary.title}"* pada ${matchedDiary.date}):

* **📝 Catatan Percakapan:** "${matchedDiary.content}"
* **⚡ Status Emosional:** Terjadi pertikaian kecil & ketegangan hubungan pasca-pembahasan *closure* / penegasan posisi.

---

💡 **Insight Psikologis AI:**
1. **Dinamika Pertikaian:** Percakapan berat seperti menegaskan sudah *move on* atau batasan baru sering memicu gesekan emosional karena adanya harapan atau perasaan yang belum selaras.
2. **Kondisi Hubungan:** Perasaan bahwa hubungan "memburuk" adalah reaksi wajar saat salah satu pihak masih memproses emosi atau rasa kecewa.

🌱 **Saran & Langkah Selanjutnya:**
* 🛑 **Beri Ruang Emosional (Space):** Jangan terburu-buru menghubungi untuk meminta maaf atau meluruskan saat emosi masih hangat.
* 🧘 **Fokus pada Ketenangan Diri:** Terima bahwa pertikaian ini terjadi sebagai bagian dari proses pendewasaan hubungan.
* 💬 **Langkah Saat Suasana Mendingin:** Jika nanti ingin menyapa kembali, mulailah dengan topik netral seperti **${safeTopicsStr}** tanpa mengungkit pertikaian lalu.`;
      }

      return `📊 **Analisis Hubungan & Catatan Memori (${friendName})**

Berdasarkan jurnal percakapan terbaru kamu dengan **${friendName}** (*"${matchedDiary.title}"* pada ${matchedDiary.date}):

* **📝 Ringkasan Catatan:** "${matchedDiary.content}"
* **🎭 Mood & Suasana:** ${matchedDiary.mood || 'Reflektif'}

---

💡 **Insight Hubungan dari AI:**
1. **Kualitas Interaksi:** Catatan percakapan ini menunjukkan dinamika komunikasi yang aktif antara kamu dan ${friendName}.
2. **Potensi Hubungan:** Menjaga ritme komunikasi dan mendengarkan akan semakin mempererat persahabatan kalian.

🌱 **Rekomendasi Langkah Selanjutnya:**
* 💬 **Bicara Topik Disukai:** Bawakan topik aman favorit ${friendName} yaitu **${safeTopicsStr}**.`;
    }

    return `✨ **MindVault AI Relationship Overview**

Saat ini kamu memiliki **${friendsData.length} teman** di direktori dan **${diariesData.length} catatan memori**. 

💡 **Saran AI:**
* Catat percakapan di menu **Conversation Diary** agar saya dapat menganalisis dinamika hubunganmu secara otomatis!`;
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
