// MindVault Supabase Client & Data Synchronization Layer
const MindVaultSupabase = {
  client: null,
  isConfigured: false,

  init(force = false) {
    // Already connected: avoid creating a second client (duplicate auth/realtime listeners)
    if (this.client && !force) return;
    if (this.realtimeChannel) this.client.removeChannel(this.realtimeChannel);
    this.realtimeChannel = null;
    this.userId = null;

    // Default Supabase Cloud Project Credentials
    const defaultUrl = 'https://dlryqgpucgkcgnocnvqn.supabase.co';
    const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscnlxZ3B1Y2drY2dub2NudnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTExNTIsImV4cCI6MjEwMTM2NzE1Mn0.PmFztvjPlmUI2nTVHpDJnOKF_wVN0GtydjdJy79vhEA';

    // Read credentials from window.ENV, localStorage, or fallback to default cloud credentials
    const supabaseUrl = (window.ENV && window.ENV.SUPABASE_URL) || localStorage.getItem('MINDVAULT_SUPABASE_URL') || defaultUrl;
    const supabaseKey = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || localStorage.getItem('MINDVAULT_SUPABASE_ANON_KEY') || defaultKey;

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
    this.init(true);
    return this.isConfigured;
  },

  // Supabase Auth Integration
  // Id of the signed-in Supabase Auth user. Row Level Security only lets this user
  // read/write their own rows, so cloud sync runs only while someone is signed in.
  userId: null,

  canSync() {
    return this.isConfigured && !!this.client && !!this.userId;
  },

  async signUp(email, password, fullName) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    const result = await this.client.auth.signUp({
      email,
      password,
      // Send the confirmation link back to the site the user signed up on
      // (must also be listed under Authentication > URL Configuration > Redirect URLs)
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin }
    });
    // No session yet when the project requires email confirmation
    this.userId = result.data?.session?.user?.id || null;
    return result;
  },

  async signIn(email, password) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    const result = await this.client.auth.signInWithPassword({ email, password });
    this.userId = result.data?.user?.id || null;
    return result;
  },

  async signOut() {
    if (this.isConfigured && this.client) {
      await this.client.auth.signOut();
    }
    if (this.userId) {
      // Don't leave this account's cached cloud data for the next person on this browser
      ['MINDVAULT_LOCAL_FRIENDS', 'MINDVAULT_LOCAL_DIARIES', 'MINDVAULT_LOCAL_REMINDERS', 'MINDVAULT_LOCAL_DAILY_JOURNALS',
        'MINDVAULT_DREAM_JOURNALS', 'MINDVAULT_LOCAL_TOPIC_STARTERS', 'MINDVAULT_LOCAL_TOPIC_REFLECTIONS',
        'MINDVAULT_USER_PROFILE', 'MINDVAULT_GEMINI_KEY', 'MINDVAULT_NEWS_TOPICS'].forEach(k => localStorage.removeItem(k));
    }
    this.userId = null;
    if (this.realtimeChannel) {
      this.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  },

  async getSessionUser() {
    if (this.isConfigured && this.client) {
      const { data } = await this.client.auth.getUser();
      this.userId = data?.user?.id || null;
      return data?.user || null;
    }
    return null;
  },

  // Async query wrappers (Pure Live Database Mode when Supabase is configured, LocalStorage Fallback when offline)
  async fetchFriends() {
    if (!this.canSync()) {
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
        giftIdeas: f.gift_ideas || [],
        milestones: f.milestones || []
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
    if (!this.canSync()) {
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
    if (!MindVaultData.diaries) MindVaultData.diaries = [];
    MindVaultData.diaries.unshift(diaryObj);
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    if (this.canSync()) {
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
        } else if (data && data[0]) {
          // Adopt the database id so later edits/deletes hit the same row
          diaryObj.id = data[0].id;
          localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));
        }
      } catch (err) {
        console.error('Insert diary exception:', err);
      }
    }
    return diaryObj;
  },

  async updateDiary(diaryObj) {
    if (!MindVaultData.diaries) MindVaultData.diaries = [];
    const index = MindVaultData.diaries.findIndex(d => String(d.id) === String(diaryObj.id));
    if (index !== -1) {
      MindVaultData.diaries[index] = diaryObj;
    } else {
      MindVaultData.diaries.unshift(diaryObj);
    }
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    if (this.canSync() && diaryObj.id) {
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
        await this.client.from('diaries').update(payload).eq('id', diaryObj.id);
      } catch (err) {
        console.error('Update diary exception:', err);
      }
    }
    return diaryObj;
  },

  async deleteDiary(diaryId) {
    if (!MindVaultData.diaries) MindVaultData.diaries = [];
    MindVaultData.diaries = MindVaultData.diaries.filter(d => String(d.id) !== String(diaryId));
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    if (this.canSync()) {
      try {
        await this.client.from('diaries').delete().eq('id', diaryId);
      } catch (err) {
        console.error('Delete diary exception:', err);
      }
    }
    return true;
  },

  async deleteFriend(friendId) {
    if (!MindVaultData.friends) MindVaultData.friends = [];
    MindVaultData.friends = MindVaultData.friends.filter(f => String(f.id) !== String(friendId));
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    // Also remove associated diaries & reminders locally
    if (MindVaultData.diaries) {
      MindVaultData.diaries = MindVaultData.diaries.filter(d => String(d.friendId) !== String(friendId));
      localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));
    }
    if (MindVaultData.reminders) {
      MindVaultData.reminders = MindVaultData.reminders.filter(r => String(r.friendId) !== String(friendId));
      localStorage.setItem('MINDVAULT_LOCAL_REMINDERS', JSON.stringify(MindVaultData.reminders));
    }

    if (this.canSync()) {
      try {
        const numId = Number(friendId);
        const matchFilter = isNaN(numId) ? `friend_id.eq.${friendId}` : `friend_id.eq.${numId}`;
        const matchIdFilter = isNaN(numId) ? `id.eq.${friendId}` : `id.eq.${numId}`;

        // Clean up linked rows to ensure no FK block
        try { await this.client.from('diaries').delete().or(matchFilter); } catch (e) {}
        try { await this.client.from('reminders').delete().or(matchFilter); } catch (e) {}
        try { await this.client.from('todays_topics').delete().or(matchFilter); } catch (e) {}

        const { error } = await this.client.from('friends').delete().or(matchIdFilter);
        if (error) console.error('Delete friend error from Supabase:', error);
      } catch (err) {
        console.error('Delete friend exception:', err);
      }
    }
    return true;
  },

  async insertFriend(friendObj) {
    if (!friendObj.id) friendObj.id = Date.now();
    if (!MindVaultData.friends) MindVaultData.friends = [];
    MindVaultData.friends.push(friendObj);
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    if (this.canSync()) {
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
          gift_ideas: friendObj.giftIdeas || [],
          milestones: friendObj.milestones || []
        };
        let { data, error } = await this.client.from('friends').insert([payload]).select();
        if (error && error.code === 'PGRST204') {
          // Older schema without the milestones column
          delete payload.milestones;
          ({ data, error } = await this.client.from('friends').insert([payload]).select());
        }
        if (error) {
          console.error('Insert friend error from Supabase:', error);
        } else if (data && data[0]) {
          // Adopt the database id so later edits/deletes hit the same row
          friendObj.id = data[0].id;
          localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));
        }
      } catch (err) {
        console.error('Insert friend exception:', err);
      }
    }
    return friendObj;
  },

  async updateFriend(friendObj) {
    if (!MindVaultData.friends) MindVaultData.friends = [];
    const index = MindVaultData.friends.findIndex(f => String(f.id) === String(friendObj.id));
    if (index !== -1) {
      MindVaultData.friends[index] = friendObj;
    }
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    if (this.canSync()) {
      try {
        const payload = {
          name: friendObj.name,
          relation: friendObj.relation,
          avatar: friendObj.avatar,
          tier: friendObj.tier,
          birthday: friendObj.birthday,
          score: friendObj.score,
          bio: friendObj.bio,
          favorites: friendObj.favorites,
          likes: friendObj.likes,
          dislikes: friendObj.dislikes,
          safe_topics: friendObj.safeTopics,
          avoid_topics: friendObj.avoidTopics,
          current_life: friendObj.currentLife,
          ai_summary: friendObj.aiSummary,
          gift_ideas: friendObj.giftIdeas,
          milestones: friendObj.milestones || []
        };
        let { error } = await this.client.from('friends').update(payload).eq('id', friendObj.id);
        if (error && error.code === 'PGRST204') {
          // Older schema without the milestones column
          delete payload.milestones;
          ({ error } = await this.client.from('friends').update(payload).eq('id', friendObj.id));
        }
        if (error) console.error('Update friend error from Supabase:', error);
      } catch (err) {
        console.error('Update friend exception:', err);
      }
    }
    return friendObj;
  },

  async fetchUserProfile() {
    if (!this.canSync()) {
      const local = localStorage.getItem('MINDVAULT_USER_PROFILE');
      return local ? JSON.parse(local) : MindVaultData.user;
    }
    try {
      const { data, error } = await this.client.from('user_profiles').select('*').eq('user_id', this.userId).maybeSingle();
      if (!error && data) {
        if (data.gemini_key && !localStorage.getItem('MINDVAULT_GEMINI_KEY')) {
          localStorage.setItem('MINDVAULT_GEMINI_KEY', data.gemini_key);
        }
        return {
          name: data.name || MindVaultData.user.name,
          email: data.email || MindVaultData.user.email,
          quote: data.quote || MindVaultData.user.quote,
          avatar: data.avatar || MindVaultData.user.avatar,
          geminiKey: data.gemini_key || '',
          topicStarters: Array.isArray(data.topic_starters) ? data.topic_starters : null,
          topicReflections: Array.isArray(data.topic_reflections) ? data.topic_reflections : null
        };
      }
    } catch (e) {}
    const local = localStorage.getItem('MINDVAULT_USER_PROFILE');
    return local ? JSON.parse(local) : MindVaultData.user;
  },

  async saveUserProfile(userObj) {
    if (!userObj) return;
    localStorage.setItem('MINDVAULT_USER_PROFILE', JSON.stringify(userObj));
    if (this.canSync()) {
      try {
        const payload = {
          user_id: this.userId,
          name: userObj.name || 'User',
          email: userObj.email || '',
          quote: userObj.quote || '',
          avatar: userObj.avatar || '',
          updated_at: new Date().toISOString()
        };
        await this.client.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('Sync user profile exception:', e);
      }
    }
  },

  async fetchGeminiKey() {
    if (!this.canSync()) {
      return localStorage.getItem('MINDVAULT_GEMINI_KEY') || '';
    }
    try {
      const { data, error } = await this.client.from('user_profiles').select('gemini_key').eq('user_id', this.userId).maybeSingle();
      if (!error && data && data.gemini_key) {
        localStorage.setItem('MINDVAULT_GEMINI_KEY', data.gemini_key);
        return data.gemini_key;
      }
    } catch (e) {}
    return localStorage.getItem('MINDVAULT_GEMINI_KEY') || '';
  },

  async saveGeminiKey(key) {
    if (!key) return;
    localStorage.setItem('MINDVAULT_GEMINI_KEY', key.trim());
    if (this.canSync()) {
      try {
        const payload = {
          user_id: this.userId,
          name: MindVaultData.user.name || 'User',
          gemini_key: key.trim(),
          updated_at: new Date().toISOString()
        };
        await this.client.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('Sync gemini key exception:', e);
      }
    }
  },

  async saveTopics(starters, reflections) {
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(starters));
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
    if (this.canSync()) {
      try {
        const payload = {
          user_id: this.userId,
          name: MindVaultData.user.name || 'User',
          topic_starters: starters,
          topic_reflections: reflections,
          updated_at: new Date().toISOString()
        };
        const { error } = await this.client.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
        if (error) console.warn('Sync topics error:', error);
      } catch (e) {
        console.warn('Sync topics exception:', e);
      }
    }
  },

  async fetchReminders() {
    return MindVaultData.reminders || [];
  },

  async fetchTopics() {
    return MindVaultData.todaysTopics || [];
  },

  // Journal tables share their row shape with the app objects, and ids are generated client-side
  journalTables: {
    daily_journals: { localKey: 'MINDVAULT_LOCAL_DAILY_JOURNALS', columns: ['id', 'title', 'date', 'mood', 'content', 'gratitude'] },
    dream_journals: { localKey: 'MINDVAULT_DREAM_JOURNALS', columns: ['id', 'title', 'date', 'type', 'characters', 'content', 'reflection'] }
  },

  async fetchJournalRows(table) {
    const { localKey } = this.journalTables[table];
    const readLocal = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(localKey) || 'null');
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    };
    if (!this.canSync()) return readLocal();
    try {
      const { data, error } = await this.client.from(table).select('*').order('date', { ascending: false });
      if (error) {
        console.warn(`Supabase fetch ${table} error:`, error);
        return readLocal();
      }
      const local = readLocal();
      if ((!data || data.length === 0) && local && local.length > 0) {
        // First sync from a device that only had local entries: upload them instead of wiping them
        await Promise.all(local.map(row => this.upsertJournalRow(table, row)));
        return local;
      }
      localStorage.setItem(localKey, JSON.stringify(data || []));
      return data || [];
    } catch (e) {
      return readLocal();
    }
  },

  async upsertJournalRow(table, row) {
    if (!this.canSync() || !row) return;
    const payload = {};
    this.journalTables[table].columns.forEach(c => { payload[c] = row[c] ?? null; });
    payload.id = Math.floor(Number(row.id));
    try {
      const { error } = await this.client.from(table).upsert(payload, { onConflict: 'id' });
      if (error) console.warn(`Sync ${table} error:`, error);
    } catch (e) {
      console.warn(`Sync ${table} exception:`, e);
    }
  },

  async deleteJournalRow(table, id) {
    if (!this.canSync()) return;
    try {
      const { error } = await this.client.from(table).delete().eq('id', Math.floor(Number(id)));
      if (error) console.warn(`Delete ${table} error:`, error);
    } catch (e) {
      console.warn(`Delete ${table} exception:`, e);
    }
  },

  async fetchDailyJournals() {
    return (await this.fetchJournalRows('daily_journals')) || MindVaultData.dailyJournals || [];
  },

  async fetchDreamJournals() {
    // null means "nothing stored yet", letting the app seed its sample dream
    return await this.fetchJournalRows('dream_journals');
  },

  async fetchKnowledgeGraph() {
    return MindVaultData.knowledgeGraph || { nodes: [], edges: [] };
  },

  // Realtime Supabase Database Sync across all tabs & devices
  subscribeRealtime(onUpdateCallback) {
    if (!this.canSync() || this.realtimeChannel) return;
    try {
      this.realtimeChannel = this.client
        .channel('mindvault-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friends' },
          async (payload) => {
            console.log('⚡ [Realtime] Friends table updated:', payload);
            await MindVaultSupabase.fetchFriends();
            if (onUpdateCallback) onUpdateCallback('friends', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'diaries' },
          async (payload) => {
            console.log('⚡ [Realtime] Diaries table updated:', payload);
            await MindVaultSupabase.fetchDiaries();
            if (onUpdateCallback) onUpdateCallback('diaries', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'daily_journals' },
          async (payload) => {
            MindVaultData.dailyJournals = await MindVaultSupabase.fetchDailyJournals();
            if (onUpdateCallback) onUpdateCallback('daily_journals', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dream_journals' },
          async (payload) => {
            MindVaultData.dreamJournals = (await MindVaultSupabase.fetchDreamJournals()) || [];
            if (onUpdateCallback) onUpdateCallback('dream_journals', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_profiles' },
          async (payload) => {
            const row = payload.new || {};
            if (Array.isArray(row.topic_starters)) localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(row.topic_starters));
            if (Array.isArray(row.topic_reflections)) localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(row.topic_reflections));
            if (onUpdateCallback) onUpdateCallback('user_profiles', payload);
          }
        )
        .subscribe((status) => {
          console.log('⚡ Realtime subscription status:', status);
        });
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  }
};

// Auto-initialize immediately on script load
MindVaultSupabase.init();
