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

  // Async query wrappers (Pure Live Database Mode when Supabase is configured)
  async fetchFriends() {
    if (!this.isConfigured || !this.client) {
      return MindVaultData.friends;
    }
    try {
      const { data, error } = await this.client.from('friends').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Supabase fetchFriends error:', error);
        return [];
      }
      return (data || []).map(f => ({
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
    } catch (e) {
      console.error('Fetch friends exception:', e);
      return [];
    }
  },

  async fetchDiaries() {
    if (!this.isConfigured || !this.client) {
      return MindVaultData.diaries;
    }
    try {
      const { data, error } = await this.client.from('diaries').select('*').order('date', { ascending: false });
      if (error) {
        console.error('Supabase fetchDiaries error:', error);
        return [];
      }
      return (data || []).map(d => ({
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
    } catch (e) {
      return [];
    }
  },

  async insertDiary(diaryObj) {
    if (!this.isConfigured || !this.client) {
      MindVaultData.diaries.unshift(diaryObj);
      return diaryObj;
    }
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
      if (error) {
        console.error('Failed inserting diary to Supabase:', error);
        return null;
      }
      const inserted = data[0];
      const result = {
        id: inserted.id,
        friendId: inserted.friend_id,
        friendName: inserted.friend_name,
        date: inserted.date,
        title: inserted.title,
        location: inserted.location,
        mood: inserted.mood,
        content: inserted.content,
        tags: inserted.tags || []
      };
      MindVaultData.diaries.unshift(result);
      return result;
    } catch (err) {
      console.error('Insert diary exception:', err);
      return null;
    }
  },

  async insertFriend(friendObj) {
    if (!this.isConfigured || !this.client) {
      MindVaultData.friends.push(friendObj);
      return friendObj;
    }
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

      const { data, error } = await this.client.from('friends').insert([payload]).select();
      if (error) {
        console.error('Error inserting friend to Supabase:', error);
        return null;
      }
      const inserted = data[0];
      const result = {
        id: inserted.id,
        name: inserted.name,
        relation: inserted.relation,
        avatar: inserted.avatar,
        tier: inserted.tier,
        birthday: inserted.birthday,
        score: inserted.score,
        bio: inserted.bio,
        favorites: inserted.favorites || {},
        likes: inserted.likes || [],
        dislikes: inserted.dislikes || [],
        safeTopics: inserted.safe_topics || [],
        avoidTopics: inserted.avoid_topics || [],
        currentLife: inserted.current_life || '',
        aiSummary: inserted.ai_summary || '',
        giftIdeas: inserted.gift_ideas || []
      };
      MindVaultData.friends.push(result);
      return result;
    } catch (e) {
      console.error('Insert friend exception:', e);
      return null;
    }
  },

  async fetchReminders() {
    if (!this.isConfigured || !this.client) return MindVaultData.reminders;
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
    if (!this.isConfigured || !this.client) {
      MindVaultData.friends = MindVaultData.friends.filter(f => f.id !== friendId);
      return true;
    }
    try {
      const { error } = await this.client.from('friends').delete().eq('id', friendId);
      if (error) {
        console.error('Delete friend error:', error);
        return false;
      }
      MindVaultData.friends = MindVaultData.friends.filter(f => f.id !== friendId);
      return true;
    } catch (e) {
      return false;
    }
  }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MindVaultSupabase.init();
});
