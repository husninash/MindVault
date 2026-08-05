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
    
    // Primary model: gemini-2.5-flash, Fallback model: gemini-2.0-flash
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
      return text || "Maaf, saya tidak dapat memproses tanggapan tersebut. Silakan coba lagi!";
    } catch (err) {
      console.warn('Gemini fetch failed:', err);
      return { error: true, message: err.message || "Gagal menghubungi endpoint Gemini API." };
    }
  },

  // Deep Relationship Intelligence Assistant Prompt
  async chatWithAssistant(userQuery, friendsData, diariesData, dailyJournalsData) {
    const friendsContext = (friendsData || []).map(f => `
- Friend: ${f.name} (${f.relation || 'Friend'})
  Intimacy Score: ${f.score || 85}%
  Bio: ${f.bio || '-'}
  Current Life Status: ${f.currentLife || '-'}
  Favorites: ${JSON.stringify(f.favorites || {})}
  Safe Topics: ${(f.safeTopics || []).join(', ')}
  Topics to Avoid: ${(f.avoidTopics || []).join(', ')}
  AI Memory Summary: ${f.aiSummary || '-'}
`).join('\n');

    const diariesContext = (diariesData || []).map(d => `
- [Memory Date: ${d.date}] With ${d.friendName || 'Friend'}: "${d.title}"
  Mood: ${d.mood || 'Reflective'}
  Location: ${d.location || 'Log'}
  Content: "${d.content}"
  Tags: ${(d.tags || []).join(', ')}
`).join('\n');

    const dailyContext = (dailyJournalsData || []).map(j => `
- [Daily Reflection Date: ${j.date}] "${j.title}" (Mood: ${j.mood})
  Content: "${j.content}"
  Gratitude: "${j.gratitude || 'N/A'}"
`).join('\n');

    const systemInstruction = `You are MindVault AI, a compassionate, highly perceptive, and expert Relationship Intelligence Assistant.

Here is the user's LIVE relationship memory database:

### FRIEND PROFILES:
${friendsContext || 'No friends added yet.'}

### LOGGED CONVERSATION MEMORIES (VERY IMPORTANT - ANALYZE THESE DIRECTLY):
${diariesContext || 'No conversation memories logged yet.'}

### PERSONAL DAILY REFLECTIONS:
${dailyContext || 'No daily reflections logged yet.'}

CRITICAL INSTRUCTIONS FOR RESPONDING:
1. When the user asks to analyze, evaluate, or give advice (e.g. "analisa", "coba analisa", "bagaimana", "saran", or names a friend like Ethan), DO NOT ask generic clarifying questions back! IMMEDIATELY analyze the actual logged conversation memories and friend details provided above.
2. Reference specific diary entry titles, dates, contents, and emotional moods (for example: if there is a log with Ethan titled "Closure" about a minor conflict, directly summarize that event, analyze the emotional dynamic, and offer 3 practical empathetic next steps).
3. Always respond in warm, clear, empathetic Indonesian. Use clean markdown formatting (bold headers, bullet points, emojis).`;

    const result = await this.askGemini(userQuery, systemInstruction);
    if (result && !result.error) {
      return result;
    }

    // Local Smart Analysis Fallback if Gemini key is missing or offline
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
      matchedFriend = friendsData.find(f => f.name === matchedDiary.friendName || f.id === matchedDiary.friendId) || { name: matchedDiary.friendName || 'Teman' };
    }

    if (matchedDiary) {
      const friendName = matchedFriend ? matchedFriend.name : (matchedDiary.friendName || 'Teman');
      const safeTopicsStr = (matchedFriend && matchedFriend.safeTopics && matchedFriend.safeTopics.length > 0) 
        ? matchedFriend.safeTopics.join(', ') 
        : 'hobi & kabar terbaru';

      return `📊 **Analisis Hubungan & Catatan Memori (${friendName})**

Berdasarkan jurnal percakapan terbaru kamu dengan **${friendName}** (*"${matchedDiary.title}"* pada ${matchedDiary.date}):

* **📝 Ringkasan Catatan:** "${matchedDiary.content}"
* **🎭 Mood & Suasana:** ${matchedDiary.mood || 'Reflektif'}

---

💡 **Insight Hubungan dari AI:**
1. **Dinamika Emosional:** Percakapan ini menyentuh topik sensitif. Ketegangan atau pertikaian kecil pasca-percakapan jujur adalah hal wajar ketika ada penyesuaian ekspektasi atau batasan personal.
2. **Kualitas Hubungan:** Adanya keterbukaan untuk menyampaikan isi hati menunjukkan hubungan kalian memiliki fondasi kejujuran yang kuat.

🌱 **Rekomendasi Langkah Selanjutnya:**
* ⏳ **Beri Waktu Sejenak:** Biarkan suasana mendingin selama 1-2 hari agar emosi mereda.
* 💬 **Pesan Ringan & Netral:** Sapa kembali dengan topik santai tanpa membahas konflik lalu.
* 🎯 **Topik Aman yang Disukai ${friendName}:** ${safeTopicsStr}.`;
    }

    // General Summary Fallback if no diaries exist
    return `✨ **MindVault AI Relationship Overview**

Saat ini kamu memiliki **${friendsData.length} teman** di direktori dan **${diariesData.length} catatan memori**. 

💡 **Saran AI:**
* Tambahkan catatan percakapan baru di menu **Conversation Diary** agar saya dapat memberikan analisis mendalam tentang dinamika hubunganmu secara otomatis!`;
  },

  // Simulator Roleplay Prompt for a specific friend
  async roleplayFriend(friend, userMessage) {
    const systemInstruction = `You are roleplaying as ${friend.name} (${friend.relation}).
Your bio: ${friend.bio}
Your current life update: ${friend.currentLife}
Things you like/love: ${(friend.likes || []).join(', ')}
Safe topics you enjoy: ${(friend.safeTopics || []).join(', ')}
Topics to avoid/dislike: ${(friend.avoidTopics || []).join(', ')}

Respond in character as ${friend.name} talking casually to your close friend. Be natural, warm, conversational, and stay true to your personality and current life updates. Keep responses under 3 sentences.`;

    const result = await this.askGemini(userMessage, systemInstruction);
    if (result && !result.error) return result;

    // Fallback roleplay
    return `Hey! Senang banget bisa ngobrol lagi. Soal kabar terbaruku, ${friend.currentLife || 'lagi sibuk kegiatan sehari-hari nih'}. Gimana kabarmu?`;
  }
};
