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
      return text || "I couldn't process that response. Please try again!";
    } catch (err) {
      console.warn('Gemini fetch failed:', err);
      return { error: true, message: err.message || "Failed to reach Gemini API endpoint." };
    }
  },

  // Relationship Intelligence Assistant Prompt
  async chatWithAssistant(userQuery, friendsData, diariesData) {
    const contextSummary = (friendsData || []).map(f => `
- Name: ${f.name} (${f.relation})
  Bio: ${f.bio}
  Current Life: ${f.currentLife}
  Safe Topics: ${(f.safeTopics || []).join(', ')}
  Topics to Avoid: ${(f.avoidTopics || []).join(', ')}
  AI Summary: ${f.aiSummary}
`).join('\n');

    const systemInstruction = `You are MindVault AI, a warm, perceptive, and highly intelligent Relationship Intelligence Assistant for Aria Chen.
You have complete knowledge of Aria's friends and relationship history:
${contextSummary}

Your goal is to provide insightful, friendly, empathetic, and actionable advice to help Aria nurture her friendships, remember key details, plan meeting icebreakers, and choose thoughtful gifts. Keep your responses concise (2-4 sentences max), warm, and engaging.`;

    const result = await this.askGemini(userQuery, systemInstruction);
    return result;
  },

  // Simulator Roleplay Prompt for a specific friend
  async roleplayFriend(friend, userMessage) {
    const systemInstruction = `You are roleplaying as ${friend.name} (${friend.relation}).
Your bio: ${friend.bio}
Your current life update: ${friend.currentLife}
Things you like/love: ${(friend.likes || []).join(', ')}
Safe topics you enjoy: ${(friend.safeTopics || []).join(', ')}
Topics to avoid/dislike: ${(friend.avoidTopics || []).join(', ')}

Respond in character as ${friend.name} talking casually to your close friend Aria. Be natural, warm, conversational, and stay true to your personality and current life updates. Keep responses under 3 sentences.`;

    const result = await this.askGemini(userMessage, systemInstruction);
    return result;
  }
};
