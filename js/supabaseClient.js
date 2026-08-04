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

  // Async query wrappers with seamless local fallback
  async fetchFriends() {
    if (!this.isConfigured || !this.client) {
      return MindVaultData.friends;
    }
    try {
      const { data, error } = await this.client.from('friends').select('*').order('id', { ascending: true });
      if (error || !data || data.length === 0) {
        console.warn('Supabase fetchFriends error/empty, using local fallback:', error);
        return MindVaultData.friends;
      }
      return data.map(f => ({
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
      return MindVaultData.friends;
    }
  },

  async fetchDiaries() {
    if (!this.isConfigured || !this.client) {
      return MindVaultData.diaries;
    }
    try {
      const { data, error } = await this.client.from('diaries').select('*').order('date', { ascending: false });
      if (error || !data || data.length === 0) return MindVaultData.diaries;
      return data.map(d => ({
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
      return MindVaultData.diaries;
    }
  },

  async insertDiary(diaryObj) {
    if (!this.isConfigured || !this.client) {
      // Local push fallback
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
        MindVaultData.diaries.unshift(diaryObj);
        return diaryObj;
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
      MindVaultData.diaries.unshift(diaryObj);
      return diaryObj;
    }
  }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MindVaultSupabase.init();
});
