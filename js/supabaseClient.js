// MindVault Supabase Client & Data Synchronization Layer
const MindVaultSupabase = {
  client: null,
  isConfigured: false,
  // A password-reset link lands here with type=recovery in the URL hash
  isPasswordRecovery: /type=recovery/.test(window.location.hash),

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
        this.client = window.supabase.createClient(supabaseUrl, supabaseKey, {
          global: { fetch: (input, init) => this.fetchWithTimeout(input, init) }
        });
        this.isConfigured = true;
        // Opening a password-reset link signs the user in with a recovery session
        this.client.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            this.isPasswordRecovery = true;
            window.dispatchEvent(new Event('mindvault:password-recovery'));
          }
        });
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

  async requestPasswordReset(email) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    // The link returns to this site (must be listed under Authentication > URL Configuration > Redirect URLs)
    return await this.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  },

  async updatePassword(newPassword) {
    if (!this.isConfigured || !this.client) return { data: null, error: { message: "Supabase not configured." } };
    const result = await this.client.auth.updateUser({ password: newPassword });
    if (!result.error) this.isPasswordRecovery = false;
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
        'MINDVAULT_USER_PROFILE', 'MINDVAULT_GEMINI_KEY', 'MINDVAULT_NEWS_TOPICS', 'MINDVAULT_VOCAB_WORDS', 'MINDVAULT_SYNC_QUEUE'].forEach(k => localStorage.removeItem(k));
    }
    this.userId = null;
    if (this.realtimeChannel) {
      this.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  },

  async getSessionUser() {
    if (this.isConfigured && this.client) {
      let user = null;
      if (this.isOffline()) {
        // No point asking the server: use the session saved on this device straight away
        user = this.readStoredUser();
      } else {
        // getUser() needs the network and the client keeps retrying a token refresh with growing
        // delays when the connection is bad, so don't let startup wait on it for more than a few seconds
        const outcome = await Promise.race([
          this.client.auth.getUser().then(r => ({ r }), e => ({ e })),
          new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 4000))
        ]);
        if (outcome.timeout) {
          this.networkDown = true;
          window.dispatchEvent(new Event('mindvault:network-down'));
          user = this.readStoredUser();
        } else if (outcome.e) {
          user = this.isNetworkFailure(outcome.e) ? this.readStoredUser() : null;
        } else {
          user = outcome.r?.data?.user || null;
          if (!user && outcome.r?.error && this.isNetworkFailure({ error: outcome.r.error })) user = this.readStoredUser();
        }
      }
      this.userId = user?.id || null;
      return user;
    }
    return null;
  },

  // The user from the session Supabase saved on this device. Read directly from storage because the
  // client's own getSession() waits on a token refresh that can't finish offline. Only used to show
  // this device's offline copy; syncing re-checks the token with the server once back online.
  readStoredUser() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!/^sb-.+-auth-token$/.test(key)) continue;
        const stored = JSON.parse(localStorage.getItem(key) || 'null');
        const user = stored?.user || stored?.currentSession?.user;
        if (user && user.id) return user;
      }
    } catch (e) {}
    return null;
  },

  // Requests on a connection without real internet (weak signal, Wi-Fi with no internet) can hang forever.
  // Give up after a few seconds and treat the network as down until it comes back.
  networkDown: false,
  requestTimeoutMs: 6000,

  async fetchWithTimeout(input, init = {}) {
    if (this.networkDown) throw new TypeError('Failed to fetch (offline)');
    const controller = new AbortController();
    if (init.signal) {
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.requestTimeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      this.networkDown = false;
      return res;
    } catch (err) {
      if (timedOut || this.isNetworkFailure(err)) {
        this.networkDown = true;
        window.dispatchEvent(new Event('mindvault:network-down'));
        throw new TypeError('Failed to fetch (timeout)');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  isOffline() {
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || this.networkDown;
  },

  // ---------- Offline support: queue writes made without internet and send them later ----------
  isNetworkFailure(res) {
    if (this.isOffline && this.isOffline()) return true;
    if (res && res.status === 0) return true;
    const msg = String(res?.error?.message || res?.message || res || '');
    return /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed|ERR_INTERNET|ERR_NAME_NOT_RESOLVED/i.test(msg);
  },

  readQueue() {
    try {
      const q = JSON.parse(localStorage.getItem('MINDVAULT_SYNC_QUEUE') || '[]');
      return Array.isArray(q) ? q : [];
    } catch (e) {
      return [];
    }
  },

  writeQueue(q) {
    localStorage.setItem('MINDVAULT_SYNC_QUEUE', JSON.stringify(q));
    window.dispatchEvent(new CustomEvent('mindvault:sync-queue', { detail: { pending: q.length } }));
  },

  pendingCount() {
    return this.readQueue().length;
  },

  hasPending(type) {
    return this.readQueue().some(e => e.type === type);
  },

  // One entry per record; later changes to the same record are merged into it
  enqueue(type, action, id) {
    const q = this.readQueue();
    const i = q.findIndex(e => e.type === type && String(e.id) === String(id));
    if (i === -1) {
      q.push({ type, action, id });
    } else {
      const prev = q[i].action;
      if (prev === 'insert' && action === 'update') {
        // still a new record: the insert will send its latest state
      } else if (prev === 'insert' && action === 'delete') {
        q.splice(i, 1); // never reached the cloud, nothing to delete there
      } else {
        q[i].action = action;
      }
    }
    this.writeQueue(q);
  },

  // Runs a cloud write now, or queues it when offline. Returns the Supabase result or null.
  async runRemote(type, action, id, fn) {
    if (!this.canSync()) return null; // local-only / demo mode: nothing to sync
    if (this.isOffline()) {
      this.enqueue(type, action, id);
      return null;
    }
    try {
      const res = await fn();
      if (res && res.error) {
        if (this.isNetworkFailure(res)) {
          this.enqueue(type, action, id);
          return null;
        }
        console.warn(`Sync ${type} ${action} error:`, res.error);
      }
      return res;
    } catch (e) {
      if (this.isNetworkFailure(e)) this.enqueue(type, action, id);
      else console.warn(`Sync ${type} ${action} exception:`, e);
      return null;
    }
  },

  readLocalArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  },

  // Sends queued changes in order. Stops at the first network failure and keeps the rest.
  async flushQueue() {
    if (!this.canSync() || this.flushing) return this.pendingCount();
    if (this.isOffline()) return this.pendingCount();
    this.flushing = true;
    try {
      for (const entry of this.readQueue()) {
        let outcome;
        try {
          outcome = await this.replayEntry(entry);
        } catch (e) {
          outcome = this.isNetworkFailure(e) ? 'network' : 'done';
          if (outcome === 'done') console.warn('Dropping queued change after error:', entry, e);
        }
        if (outcome === 'network') break;
        // Ids may have been remapped during replay, so match on the entry's current id
        const q = this.readQueue();
        const i = q.findIndex(e => e.type === entry.type && e.action === entry.action && String(e.id) === String(entry.remappedId ?? entry.id));
        if (i !== -1) q.splice(i, 1);
        this.writeQueue(q);
      }
    } finally {
      this.flushing = false;
    }
    return this.pendingCount();
  },

  async replayEntry(entry) {
    const failed = (res) => (res && res.error ? (this.isNetworkFailure(res) ? 'network' : 'done') : null);
    const { type, action, id } = entry;

    if (type === 'friends' || type === 'diaries') {
      const list = (type === 'friends' ? MindVaultData.friends : MindVaultData.diaries)
        || this.readLocalArray(type === 'friends' ? 'MINDVAULT_LOCAL_FRIENDS' : 'MINDVAULT_LOCAL_DIARIES') || [];
      const obj = list.find(x => String(x.id) === String(id));
      if (action === 'delete') {
        return failed(type === 'friends' ? await this.remoteDeleteFriend(id) : await this.remoteDeleteDiary(id)) || 'done';
      }
      if (!obj) return 'done';
      if (action === 'insert') {
        const res = type === 'friends' ? await this.remoteInsertFriend(obj) : await this.remoteInsertDiary(obj);
        const f = failed(res);
        if (f) return f;
        const newId = res?.data?.[0]?.id;
        if (newId !== undefined && String(newId) !== String(id)) {
          if (type === 'friends') this.remapFriendId(id, newId);
          else this.remapDiaryId(id, newId);
          entry.remappedId = newId;
        }
        return 'done';
      }
      return failed(type === 'friends' ? await this.remoteUpdateFriend(obj) : await this.remoteUpdateDiary(obj)) || 'done';
    }

    if (this.journalTables[type]) {
      if (action === 'delete') return failed(await this.remoteDeleteJournal(type, id)) || 'done';
      const row = (this.readLocalArray(this.journalTables[type].localKey) || []).find(r => String(r.id) === String(id));
      if (!row) return 'done';
      return failed(await this.remoteUpsertJournal(type, row)) || 'done';
    }

    if (type === 'topics') {
      const starters = this.readLocalArray('MINDVAULT_LOCAL_TOPIC_STARTERS') || [];
      const reflections = this.readLocalArray('MINDVAULT_LOCAL_TOPIC_REFLECTIONS') || [];
      return failed(await this.remoteSaveTopics(starters, reflections)) || 'done';
    }

    if (type === 'profile') {
      let profile = null;
      try { profile = JSON.parse(localStorage.getItem('MINDVAULT_USER_PROFILE') || 'null'); } catch (e) {}
      if (!profile) return 'done';
      return failed(await this.remoteSaveProfile(profile)) || 'done';
    }

    return 'done';
  },

  remapFriendId(oldId, newId) {
    (MindVaultData.friends || []).forEach(f => { if (String(f.id) === String(oldId)) f.id = newId; });
    (MindVaultData.diaries || []).forEach(d => { if (String(d.friendId) === String(oldId)) d.friendId = newId; });
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends || []));
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries || []));
    const q = this.readQueue();
    q.forEach(e => { if (e.type === 'friends' && String(e.id) === String(oldId)) e.id = newId; });
    this.writeQueue(q);
    if (typeof MindVaultApp !== 'undefined' && String(MindVaultApp.selectedFriendId) === String(oldId)) MindVaultApp.selectedFriendId = newId;
  },

  remapDiaryId(oldId, newId) {
    (MindVaultData.diaries || []).forEach(d => { if (String(d.id) === String(oldId)) d.id = newId; });
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries || []));
    const q = this.readQueue();
    q.forEach(e => { if (e.type === 'diaries' && String(e.id) === String(oldId)) e.id = newId; });
    this.writeQueue(q);
  },

  // Async query wrappers (Pure Live Database Mode when Supabase is configured, LocalStorage Fallback when offline)
  async fetchFriends() {
    if (!this.canSync() || this.isOffline()) {
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
    const localFriends = () => {
      const local = this.readLocalArray('MINDVAULT_LOCAL_FRIENDS');
      if (local) MindVaultData.friends = local;
      return MindVaultData.friends || [];
    };
    if (this.hasPending('friends')) return localFriends(); // unsent offline changes win until they're synced
    try {
      const { data, error } = await this.client.from('friends').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Supabase fetchFriends error:', error);
        return localFriends();
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
        contact: f.contact || (f.favorites && f.favorites._contact) || {},
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
      return localFriends();
    }
  },

  async fetchDiaries() {
    if (!this.canSync() || this.isOffline()) {
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
    const localDiaries = () => {
      const local = this.readLocalArray('MINDVAULT_LOCAL_DIARIES');
      if (local) MindVaultData.diaries = local;
      return MindVaultData.diaries || [];
    };
    if (this.hasPending('diaries')) return localDiaries();
    try {
      const { data, error } = await this.client.from('diaries').select('*').order('date', { ascending: false });
      if (error) return localDiaries();
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
      return localDiaries();
    }
  },

  diaryPayload(d) {
    return {
      friend_id: d.friendId,
      friend_name: d.friendName,
      date: d.date,
      title: d.title,
      location: d.location,
      mood: d.mood,
      content: d.content,
      tags: d.tags
    };
  },

  friendPayload(f, { defaults = false } = {}) {
    return {
      name: f.name,
      relation: f.relation || (defaults ? 'Teman' : f.relation),
      avatar: f.avatar || (defaults ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80' : f.avatar),
      tier: f.tier || (defaults ? 'Teman' : f.tier),
      birthday: f.birthday || null,
      score: f.score || (defaults ? 85 : f.score),
      bio: f.bio || '',
      favorites: f.favorites || {},
      contact: f.contact || {},
      likes: f.likes || [],
      dislikes: f.dislikes || [],
      safe_topics: f.safeTopics || [],
      avoid_topics: f.avoidTopics || [],
      current_life: f.currentLife || '',
      ai_summary: f.aiSummary || '',
      gift_ideas: f.giftIdeas || [],
      milestones: f.milestones || []
    };
  },

  async remoteInsertDiary(d) {
    return await this.client.from('diaries').insert([this.diaryPayload(d)]).select();
  },

  async remoteUpdateDiary(d) {
    return await this.client.from('diaries').update(this.diaryPayload(d)).eq('id', d.id);
  },

  async remoteDeleteDiary(id) {
    return await this.client.from('diaries').delete().eq('id', id);
  },

  // Until the schema update is run, keep contact details inside favorites so nothing is lost
  stripNewFriendColumns(payload) {
    delete payload.milestones;
    if ('contact' in payload) {
      const contact = payload.contact || {};
      delete payload.contact;
      payload.favorites = { ...(payload.favorites || {}) };
      if (Object.keys(contact).length) payload.favorites._contact = contact;
      else delete payload.favorites._contact;
    }
  },

  async remoteInsertFriend(f) {
    const payload = this.friendPayload(f, { defaults: true });
    let res = await this.client.from('friends').insert([payload]).select();
    if (res.error && res.error.code === 'PGRST204') {
      // Older schema without the milestones/contact columns
      this.stripNewFriendColumns(payload);
      res = await this.client.from('friends').insert([payload]).select();
    }
    return res;
  },

  async remoteUpdateFriend(f) {
    const payload = this.friendPayload(f);
    let res = await this.client.from('friends').update(payload).eq('id', f.id);
    if (res.error && res.error.code === 'PGRST204') {
      this.stripNewFriendColumns(payload);
      res = await this.client.from('friends').update(payload).eq('id', f.id);
    }
    return res;
  },

  async remoteDeleteFriend(friendId) {
    const numId = Number(friendId);
    const matchFilter = isNaN(numId) ? `friend_id.eq.${friendId}` : `friend_id.eq.${numId}`;
    const matchIdFilter = isNaN(numId) ? `id.eq.${friendId}` : `id.eq.${numId}`;
    // Clean up linked rows to ensure no FK block
    try { await this.client.from('diaries').delete().or(matchFilter); } catch (e) {}
    try { await this.client.from('reminders').delete().or(matchFilter); } catch (e) {}
    try { await this.client.from('todays_topics').delete().or(matchFilter); } catch (e) {}
    return await this.client.from('friends').delete().or(matchIdFilter);
  },

  async insertDiary(diaryObj) {
    if (!diaryObj.id) diaryObj.id = Date.now();
    if (!MindVaultData.diaries) MindVaultData.diaries = [];
    MindVaultData.diaries.unshift(diaryObj);
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    const res = await this.runRemote('diaries', 'insert', diaryObj.id, () => this.remoteInsertDiary(diaryObj));
    if (res && !res.error && res.data && res.data[0]) {
      // Adopt the database id so later edits/deletes hit the same row
      diaryObj.id = res.data[0].id;
      localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));
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

    if (diaryObj.id) await this.runRemote('diaries', 'update', diaryObj.id, () => this.remoteUpdateDiary(diaryObj));
    return diaryObj;
  },

  async deleteDiary(diaryId) {
    if (!MindVaultData.diaries) MindVaultData.diaries = [];
    MindVaultData.diaries = MindVaultData.diaries.filter(d => String(d.id) !== String(diaryId));
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(MindVaultData.diaries));

    await this.runRemote('diaries', 'delete', diaryId, () => this.remoteDeleteDiary(diaryId));
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

    await this.runRemote('friends', 'delete', friendId, () => this.remoteDeleteFriend(friendId));
    return true;
  },

  async insertFriend(friendObj) {
    if (!friendObj.id) friendObj.id = Date.now();
    if (!MindVaultData.friends) MindVaultData.friends = [];
    MindVaultData.friends.push(friendObj);
    localStorage.setItem('MINDVAULT_LOCAL_FRIENDS', JSON.stringify(MindVaultData.friends));

    const tempId = friendObj.id;
    const res = await this.runRemote('friends', 'insert', tempId, () => this.remoteInsertFriend(friendObj));
    if (res && !res.error && res.data && res.data[0]) {
      // Adopt the database id so later edits/deletes hit the same row
      this.remapFriendId(tempId, res.data[0].id);
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

    await this.runRemote('friends', 'update', friendObj.id, () => this.remoteUpdateFriend(friendObj));
    return friendObj;
  },

  async fetchUserProfile() {
    if (!this.canSync() || this.isOffline()) {
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

  async remoteSaveProfile(userObj) {
    const payload = {
      user_id: this.userId,
      name: userObj.name || 'User',
      email: userObj.email || '',
      quote: userObj.quote || '',
      avatar: userObj.avatar || '',
      updated_at: new Date().toISOString()
    };
    return await this.client.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  },

  async saveUserProfile(userObj) {
    if (!userObj) return;
    localStorage.setItem('MINDVAULT_USER_PROFILE', JSON.stringify(userObj));
    await this.runRemote('profile', 'upsert', 'me', () => this.remoteSaveProfile(userObj));
  },

  async fetchGeminiKey() {
    if (!this.canSync() || this.isOffline()) {
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

  async remoteSaveTopics(starters, reflections) {
    const payload = {
      user_id: this.userId,
      name: MindVaultData.user.name || 'User',
      topic_starters: starters,
      topic_reflections: reflections,
      updated_at: new Date().toISOString()
    };
    return await this.client.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  },

  async saveTopics(starters, reflections) {
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(starters));
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
    await this.runRemote('topics', 'upsert', 'me', () => this.remoteSaveTopics(starters, reflections));
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
    dream_journals: { localKey: 'MINDVAULT_DREAM_JOURNALS', columns: ['id', 'title', 'date', 'type', 'characters', 'content', 'reflection'] },
    vocab_words: { localKey: 'MINDVAULT_VOCAB_WORDS', columns: ['id', 'word', 'date', 'data', 'mastered'] }
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
    if (!this.canSync() || this.isOffline()) return readLocal();
    if (this.hasPending(table)) return readLocal(); // unsent offline changes win until they're synced
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

  async remoteUpsertJournal(table, row) {
    const payload = {};
    this.journalTables[table].columns.forEach(c => { payload[c] = row[c] ?? null; });
    payload.id = Math.floor(Number(row.id));
    return await this.client.from(table).upsert(payload, { onConflict: 'id' });
  },

  async remoteDeleteJournal(table, id) {
    return await this.client.from(table).delete().eq('id', Math.floor(Number(id)));
  },

  async upsertJournalRow(table, row) {
    if (!row) return;
    await this.runRemote(table, 'upsert', row.id, () => this.remoteUpsertJournal(table, row));
  },

  async deleteJournalRow(table, id) {
    await this.runRemote(table, 'delete', id, () => this.remoteDeleteJournal(table, id));
  },

  async fetchVocabWords() {
    return (await this.fetchJournalRows('vocab_words')) || [];
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
          { event: '*', schema: 'public', table: 'vocab_words' },
          async (payload) => {
            MindVaultData.vocabWords = await MindVaultSupabase.fetchVocabWords();
            if (onUpdateCallback) onUpdateCallback('vocab_words', payload);
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
