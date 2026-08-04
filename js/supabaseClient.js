// MindVault Supabase Client & Data Synchronization Layer
const MindVaultSupabase = {
  client: null,
  isConfigured: false,

  init() {
    // Read credentials from window.ENV, localStorage, or custom config
    const supabaseUrl = (window.ENV && window.ENV.SUPABASE_URL) || localStorage.getItem('MINDVAULT_SUPABASE_URL') || 'https://dlryqgpucgkcgnocnvqn.supabase.co';
    const supabaseKey = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || localStorage.getItem('MINDVAULT_SUPABASE_ANON_KEY');

    if (window.supabase && supabaseUrl && supabaseKey) {
      try {
        this.client = window.supabase.createClient(supabaseUrl, supabaseKey);
        this.isConfigured = true;
        console.log('✅ Supabase Client initialized successfully.');
      } catch (err) {
        console.warn('⚠️ Supabase initialization error:', err);
        this.isConfigured = false;
      }
    } else {
      console.log('ℹ️ Supabase credentials not found. Operating in local mode with fallback MindVaultData.');
    }
  },

  // Save Supabase credentials to localStorage for easy setup
  setCredentials(url, key) {
    if (!url || !key) return false;
    localStorage.setItem('MINDVAULT_SUPABASE_URL', url.trim());
    localStorage.setItem('MINDVAULT_SUPABASE_ANON_KEY', key.trim());
    this.init();
    return this.isConfigured;
  },

  // Supabase Auth Integration
  async signUp(email, password, fullName) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    return await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
  },

  async signIn(email, password) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    return await this.client.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    if (this.isConfigured && this.client) {
      await this.client.auth.signOut();
    }
  },

  async getSessionUser() {
    if (this.isConfigured && this.client) {
      const { data } = await this.client.auth.getUser();
      return data?.user || null;
    }
    return null;
  },

  // Async query wrappers (Pure Live Database Mode when Supabase is configured, LocalStorage Fallback when offline)
  async fetchFriends() {
    if (!this.isConfigured || !this.client) {
      const local = localStorage.getItem('MINDVAULT_LOCAL_FRIENDS');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            MindVaultData.friends = parsed;
            return parsed;
          }
        } catch (e) {
          console.warn('Error parsing local friends:', e);
        }
      }
      return MindVaultData.friends || [];
    }
    try {
      const { data, error } = await this.client.from('friends').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Supabase fetchFriends error:', error);
        return MindVaultData.friends || [];
      }
      const friends = (data || []).map(f => ({
        id: f.id,
        name: f.name,
        relation: f.relation,
        avatar: f.avatar,
        tier: f.tier,
        birthday: f.birthday,
        score: f.score,
        bio: f.bio,
        favorites: f.favorites || {},
        likes: f.likes || [],
        dislikes: f.dislikes || [],
        safeTopics: f.safe_topics || [],
        avoidTopics: f.avoid_topics || [],
        currentLife: f.current_life || '',
        aiSummary: f.ai_summary || '',
        giftIdeas: f.gift_ideas || []
      }));
      MindVaultData.friends = friends;
      localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(friends));
      return friends;
    } catch (e) {
      console.error('Fetch friends exception:', e);
      return MindVaultData.friends || [];
    }
  },

  async fetchDiaries() {
    if (!this.isConfigured || !this.client) {
      const local = localStorage.getItem('MINDVAULT_LOCAL_DIARIES');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            MindVaultData.diaries = parsed;
            return parsed;
          }
        } catch (e) {}
      }
      return MindVaultData.diaries || [];
    }
    try {
      const { data, error } = await this.client.from('diaries').select('*').order('date', { ascending: false });
      if (error) return MindVaultData.diaries || [];
      const diaries = (data || []).map(d => ({
        id: d.id,
        friendId: d.friend_id,
        friendName: d.friend_name,
        date: d.date,
        title: d.title,
        location: d.location,
        mood: d.mood,
        content: d.content,
        tags: d.tags || []
      }));
      MindVaultData.diaries = diaries;
      localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(diaries));
      return diaries;
    } catch (e) {
      return MindVaultData.diaries || [];
    }
  },

  async insertDiary(diaryObj) {
    if (!diaryObj.id) diaryObj.id = Date.now();
    MindVaultData.diaries.unshift(diaryObj);
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    if (this.isConfigured && this.client) {
      try {
        const payload = {
          friend_id: diaryObj.friendId,
          friend_name: diaryObj.friendName,
          date: diaryObj.date,
          title: diaryObj.title,
          location: diaryObj.location,
          mood: diaryObj.mood,
          content: diaryObj.content,
          tags: diaryObj.tags
        };
        const { data, error } = await this.client.from('diaries').insert([payload]).select();
        if (error) console.error('Failed inserting diary to Supabase:', error);
      } catch (err) {
        console.error('Insert diary exception:', err);
      }
    }
    return diaryObj;
  },

  async insertFriend(friendObj) {
    if (!friendObj.id) friendObj.id = Date.now();
    MindVaultData.friends.push(friendObj);
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    if (this.isConfigured && this.client) {
      try {
        const payload = {
          name: friendObj.name,
          relation: friendObj.relation || 'Friend',
          avatar: friendObj.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
          tier: friendObj.tier || 'Close Circle',
          birthday: friendObj.birthday || null,
          score: friendObj.score || 85,
          bio: friendObj.bio || '',
          favorites: friendObj.favorites || {},
          likes: friendObj.likes || [],
          dislikes: friendObj.dislikes || [],
          safe_topics: friendObj.safeTopics || [],
          avoid_topics: friendObj.avoidTopics || [],
          current_life: friendObj.currentLife || '',
          ai_summary: friendObj.aiSummary || '',
          gift_ideas: friendObj.giftIdeas || []
        };

        const { error } = await this.client.from('friends').insert([payload]);
        if (error) console.error('Error inserting friend to Supabase:', error);
      } catch (e) {
        console.error('Insert friend exception:', e);
      }
    }
    return friendObj;
  },

  async updateFriend(friendObj) {
    const idx = MindVaultData.friends.findIndex(f => f.id === friendObj.id);
    if (idx !== -1) {
      MindVaultData.friends[idx] = { ...MindVaultData.friends[idx], ...friendObj };
    } else {
      MindVaultData.friends.push(friendObj);
    }
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    if (this.isConfigured && this.client) {
      try {
        const payload = {
          name: friendObj.name,
          relation: friendObj.relation || 'Friend',
          avatar: friendObj.avatar,
          tier: friendObj.tier || 'Close Circle',
          birthday: friendObj.birthday || null,
          bio: friendObj.bio || '',
          favorites: friendObj.favorites || {},
          likes: friendObj.likes || [],
          dislikes: friendObj.dislikes || [],
          safe_topics: friendObj.safeTopics || [],
          avoid_topics: friendObj.avoidTopics || [],
          current_life: friendObj.currentLife || '',
          gift_ideas: friendObj.giftIdeas || []
        };

        const { error } = await this.client.from('friends').update(payload).eq('id', friendObj.id);
        if (error) console.error('Error updating friend in Supabase:', error);
      } catch (e) {
        console.error('Update friend exception:', e);
      }
    }
    return friendObj;
  },

  async fetchReminders() {
    if (!this.isConfigured || !this.client) {
      const local = localStorage.getItem('MINDVAULT_LOCAL_REMINDERS');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
      }
      return MindVaultData.reminders || [];
    }
    try {
      const { data, error } = await this.client.from('reminders').select('*').order('date', { ascending: true });
      if (error) return [];
      return (data || []).map(r => ({
        id: r.id,
        date: r.date,
        title: r.title,
        friendId: r.friend_id,
        type: r.type
      }));
    } catch (e) {
      return [];
    }
  },

  async fetchTopics() {
    if (!this.isConfigured || !this.client) return MindVaultData.todaysTopics;
    try {
      const { data, error } = await this.client.from('todays_topics').select('*');
      if (error) return [];
      return (data || []).map(t => ({
        id: t.id,
        text: t.text,
        friendId: t.friend_id,
        priority: t.priority
      }));
    } catch (e) {
      return [];
    }
  },

  async fetchKnowledgeGraph() {
    if (!this.isConfigured || !this.client) return MindVaultData.knowledgeGraph;
    try {
      const { data: nodes, error: err1 } = await this.client.from('knowledge_nodes').select('*');
      const { data: edges, error: err2 } = await this.client.from('knowledge_edges').select('*');
      if (err1 || !nodes) return { nodes: [], edges: [] };
      return {
        nodes: nodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
        edges: (edges || []).map(e => ({ from: e.from_node, to: e.to_node, label: e.label }))
      };
    } catch (e) {
      return { nodes: [], edges: [] };
    }
  },

  async deleteFriend(friendId) {
    MindVaultData.friends = MindVaultData.friends.filter(f => f.id !== friendId);
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    if (this.isConfigured && this.client) {
      try {
        const { error } = await this.client.from('friends').delete().eq('id', friendId);
        if (error) console.error('Delete friend error:', error);
      } catch (e) {}
    }
    return true;
  }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MindVaultSupabase.init();
});
