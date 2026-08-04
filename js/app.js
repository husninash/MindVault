// MindVault Master Application Controller
document.addEventListener('DOMContentLoaded', () => {
  MindVaultApp.init();
});

const MindVaultApp = {
  activeView: 'dashboard',
  selectedFriendId: 1,
  graphEngine: null,
  authMode: 'login',
  currentUser: null,

  async init() {
    this.bindNavigation();
    this.bindModals();
    this.bindAIChat();
    
    // Async fetch from Supabase if connected
    if (typeof MindVaultSupabase !== 'undefined') {
      MindVaultData.friends = await MindVaultSupabase.fetchFriends();
      MindVaultData.diaries = await MindVaultSupabase.fetchDiaries();
      MindVaultData.reminders = await MindVaultSupabase.fetchReminders();
      MindVaultData.todaysTopics = await MindVaultSupabase.fetchTopics();
      MindVaultData.knowledgeGraph = await MindVaultSupabase.fetchKnowledgeGraph();
    }

    await this.checkAuthSession();
    this.renderDashboard();
    this.renderFriendsGrid();
    this.renderDiariesList();
    this.renderRemindersList();
    this.populateDiaryFriendOptions();
    this.updateSupabaseStatusUI();
  },

  async checkAuthSession() {
    const localSession = localStorage.getItem('MINDVAULT_AUTH_SESSION');
    let supabaseUser = null;
    if (typeof MindVaultSupabase !== 'undefined') {
      supabaseUser = await MindVaultSupabase.getSessionUser();
    }

    if (supabaseUser) {
      this.currentUser = {
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
        email: supabaseUser.email,
        avatar: MindVaultData.user.avatar
      };
      this.hideAuthScreen();
    } else if (localSession) {
      try {
        this.currentUser = JSON.parse(localSession);
        this.hideAuthScreen();
      } catch (e) {
        this.showAuthScreen();
      }
    } else {
      this.showAuthScreen();
    }
  },

  showAuthScreen() {
    const modal = document.getElementById('auth-modal-screen');
    if (modal) modal.classList.add('active');
  },

  hideAuthScreen() {
    const modal = document.getElementById('auth-modal-screen');
    if (modal) modal.classList.remove('active');
    this.updateUserSidebar();
  },

  updateUserSidebar() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.innerText = this.currentUser.name;
    if (roleEl) roleEl.innerText = this.currentUser.email || 'Pro Member ✨';
    if (avatarEl && this.currentUser.avatar) avatarEl.src = this.currentUser.avatar;
  },

  switchAuthTab(tab) {
    this.authMode = tab;
    const loginBtn = document.getElementById('auth-tab-login');
    const regBtn = document.getElementById('auth-tab-register');
    const nameGroup = document.getElementById('auth-name-group');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (tab === 'login') {
      if (loginBtn) loginBtn.classList.add('active');
      if (regBtn) regBtn.classList.remove('active');
      if (nameGroup) nameGroup.style.display = 'none';
      if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Log In to MindVault`;
    } else {
      if (regBtn) regBtn.classList.add('active');
      if (loginBtn) loginBtn.classList.remove('active');
      if (nameGroup) nameGroup.style.display = 'block';
      if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Create Account`;
    }
  },

  async handleAuthSubmit() {
    const email = document.getElementById('auth-input-email')?.value.trim();
    const password = document.getElementById('auth-input-password')?.value.trim();
    const name = document.getElementById('auth-input-name')?.value.trim();

    if (!email || !password) {
      alert('Please fill in your email and password.');
      return;
    }

    if (this.authMode === 'register') {
      if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
        const { data, error } = await MindVaultSupabase.signUp(email, password, name || 'User');
        if (error) {
          alert('Sign Up Error: ' + error.message);
          return;
        }
        alert('🎉 Account created! Check your email to confirm registration.');
      }
      this.currentUser = { name: name || email.split('@')[0], email: email, avatar: MindVaultData.user.avatar };
    } else {
      if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
        const { data, error } = await MindVaultSupabase.signIn(email, password);
        if (error) {
          alert('Login Failed: ' + error.message);
          return;
        }
        const user = data.user;
        this.currentUser = { name: user.user_metadata?.full_name || email.split('@')[0], email: email, avatar: MindVaultData.user.avatar };
      } else {
        this.currentUser = { name: email.split('@')[0], email: email, avatar: MindVaultData.user.avatar };
      }
    }

    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    alert(`👋 Welcome back, ${this.currentUser.name}!`);
    this.hideAuthScreen();
  },

  demoLogin() {
    this.currentUser = {
      name: MindVaultData.user.name,
      email: MindVaultData.user.email,
      avatar: MindVaultData.user.avatar
    };
    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    this.hideAuthScreen();
  },

  async handleLogout() {
    if (confirm('Are you sure you want to log out of MindVault?')) {
      if (typeof MindVaultSupabase !== 'undefined') {
        await MindVaultSupabase.signOut();
      }
      localStorage.removeItem('MINDVAULT_AUTH_SESSION');
      this.currentUser = null;
      this.showAuthScreen();
    }
  },

  async saveNewFriend() {
    const name = document.getElementById('add-friend-name')?.value.trim();
    const relation = document.getElementById('add-friend-relation')?.value.trim();
    const currentLife = document.getElementById('add-friend-life')?.value.trim();

    if (!name) {
      alert('Please enter a friend name.');
      return;
    }

    const newFriend = {
      name: name,
      relation: relation || 'Friend',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      tier: 'Close Circle',
      score: 85,
      currentLife: currentLife || 'Recently added to MindVault.',
      safeTopics: ['Recent life updates', 'Hobbies & interests'],
      avoidTopics: [],
      likes: ['Coffee', 'Travel'],
      dislikes: [],
      aiSummary: `${name} is a valued connection in your network.`,
      favorites: {},
      giftIdeas: []
    };

    await MindVaultSupabase.insertFriend(newFriend);
    alert(`🎉 ${name} has been added to your Supabase database!`);
    document.getElementById('modal-add-friend')?.classList.remove('active');

    // Clear form inputs
    if (document.getElementById('add-friend-name')) document.getElementById('add-friend-name').value = '';
    if (document.getElementById('add-friend-relation')) document.getElementById('add-friend-relation').value = '';
    if (document.getElementById('add-friend-life')) document.getElementById('add-friend-life').value = '';

    this.renderFriendsGrid();
    this.populateDiaryFriendOptions();
  },

  async saveNewDiary() {
    const title = document.getElementById('add-diary-title')?.value.trim();
    const friendName = document.getElementById('add-diary-friend')?.value;
    const content = document.getElementById('add-diary-content')?.value.trim();

    if (!title || !content) {
      alert('Please enter both a title and memory details.');
      return;
    }

    const matchedFriend = MindVaultData.friends.find(f => f.name === friendName) || MindVaultData.friends[0];
    const today = new Date().toISOString().split('T')[0];

    const newDiary = {
      friendId: matchedFriend ? matchedFriend.id : 1,
      friendName: friendName || 'Sophia Martinez',
      date: today,
      title: title,
      location: 'Personal Log',
      mood: '😊 Energetic & Inspired',
      content: content,
      tags: ['Memory', 'Log']
    };

    await MindVaultSupabase.insertDiary(newDiary);
    alert('📖 Memory log saved to Supabase successfully!');
    document.getElementById('modal-add-diary')?.classList.remove('active');

    // Clear form inputs
    if (document.getElementById('add-diary-title')) document.getElementById('add-diary-title').value = '';
    if (document.getElementById('add-diary-content')) document.getElementById('add-diary-content').value = '';

    this.renderDiariesList();
    this.renderDashboard();
  },

  populateDiaryFriendOptions() {
    const select = document.getElementById('add-diary-friend');
    if (!select || !MindVaultData.friends) return;
    select.innerHTML = MindVaultData.friends.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
  },

  saveSupabaseConfig() {
    const url = document.getElementById('setting-supabase-url')?.value;
    const key = document.getElementById('setting-supabase-key')?.value;
    if (!url || !key) {
      alert('Please enter both Supabase URL and Anon Key.');
      return;
    }
    const success = MindVaultSupabase.setCredentials(url, key);
    if (success) {
      alert('🎉 Connected to Supabase successfully! Reloading data...');
      this.init();
    } else {
      alert('❌ Could not connect to Supabase. Please verify your Project URL and Anon Key.');
    }
  },

  saveGeminiConfig() {
    const key = document.getElementById('setting-gemini-key')?.value;
    if (!key) {
      alert('Please enter a valid Gemini API Key.');
      return;
    }
    localStorage.setItem('MINDVAULT_GEMINI_KEY', key.trim());
    alert('✨ Google Gemini API Key saved successfully!');
  },

  updateSupabaseStatusUI() {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;
    if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
      badge.innerHTML = `<span style="color: #059669; background: #ECFDF5; padding: 6px 14px; border-radius: 12px; display: inline-block;">🟢 Connected to Supabase Live Backend</span>`;
    } else {
      badge.innerHTML = `<span style="color: #D97706; background: #FFFBEB; padding: 6px 14px; border-radius: 12px; display: inline-block;">🟡 Offline Mode (Local Fallback Data Active)</span>`;
    }
  },

  // View Router / Tab Switching
  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-item button[data-view]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetView = btn.getAttribute('data-view');
        this.switchView(targetView);
      });
    });
  },

  switchView(viewName) {
    this.activeView = viewName;
    
    // Update nav active styles
    document.querySelectorAll('.nav-item button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Update view visibility
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetElement = document.getElementById(`view-${viewName}`);
    if (targetElement) {
      targetElement.classList.add('active');
    }

    // Special view handlers
    if (viewName === 'graph') {
      setTimeout(() => {
        if (!this.graphEngine) {
          this.graphEngine = new KnowledgeGraphEngine('knowledge-graph-canvas', MindVaultData.knowledgeGraph);
        }
      }, 100);
    } else if (viewName === 'profile') {
      this.renderFriendProfile(this.selectedFriendId);
    }
  },

  // Render Dashboard Widgets
  renderDashboard() {
    // Health score gauge animation
    const scoreVal = document.getElementById('dash-health-score');
    if (scoreVal) scoreVal.innerText = `${MindVaultData.user.healthScore}%`;

    // Today's topics list
    const topicsContainer = document.getElementById('dash-topics-list');
    if (topicsContainer) {
      topicsContainer.innerHTML = MindVaultData.todaysTopics.map(topic => `
        <div style="padding: 12px 14px; background: rgba(255,255,255,0.7); border-radius: 12px; margin-bottom: 8px; border: 1px solid rgba(248,187,217,0.3); display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; font-weight: 600;">✨ ${topic.text}</span>
          <span style="font-size: 10px; font-weight: 700; background: var(--secondary); color: var(--accent-hover); padding: 4px 10px; border-radius: 10px;">${topic.priority}</span>
        </div>
      `).join('');
    }

    // Recent Diary Logs
    const dashDiaryContainer = document.getElementById('dash-recent-diaries');
    if (dashDiaryContainer) {
      dashDiaryContainer.innerHTML = MindVaultData.diaries.slice(0, 2).map(diary => `
        <div style="background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px; border: 1px solid var(--card-border); box-shadow: 0 4px 12px rgba(248,187,217,0.1);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong style="font-size: 14px; color: var(--text-dark);">${diary.title}</strong>
            <span style="font-size: 11px; color: var(--text-muted);">${diary.date}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-medium); margin-bottom: 10px;">${diary.content}</p>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${diary.tags.map(t => `<span class="tag-chip">#${t}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }
  },

  // Render Friends Grid Directory
  renderFriendsGrid() {
    const grid = document.getElementById('friends-grid-container');
    if (!grid) return;

    grid.innerHTML = MindVaultData.friends.map(friend => `
      <div class="friend-card">
        <div class="friend-card-avatar-wrapper">
          <img src="${friend.avatar}" class="friend-card-avatar" alt="${friend.name}">
          <span class="tier-badge">${friend.tier}</span>
        </div>
        <h4>${friend.name}</h4>
        <p class="relation-type">${friend.relation}</p>
        
        <div class="friend-card-tags">
          ${friend.likes.slice(0, 3).map(l => `<span class="tag-chip">❤️ ${l}</span>`).join('')}
        </div>

        <div style="width: 100%; padding: 10px; background: var(--bg-main); border-radius: 12px; font-size: 11px; color: var(--text-medium); margin-bottom: 14px; text-align: left;">
          <strong>💡 AI Brief:</strong> ${friend.currentLife.substring(0, 65)}...
        </div>

        <div class="friend-card-actions">
          <button class="btn btn-secondary" onclick="MindVaultApp.openPrepModal(${friend.id})">
            ⚡ Prep Meeting
          </button>
          <button class="btn btn-primary" onclick="MindVaultApp.viewProfile(${friend.id})">
            View Profile
          </button>
        </div>
      </div>
    `).join('');
  },

  viewProfile(id) {
    this.selectedFriendId = id;
    this.switchView('profile');
  },

  // Render Single Friend Profile View
  renderFriendProfile(id) {
    const friend = MindVaultData.friends.find(f => f.id === id) || MindVaultData.friends[0];

    // Basic Header Info
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.innerText = friend.name;

    const relationEl = document.getElementById('profile-relation');
    if (relationEl) relationEl.innerText = friend.relation;

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.src = friend.avatar;

    const bioEl = document.getElementById('profile-bio');
    if (bioEl) bioEl.innerText = friend.bio;

    const scoreEl = document.getElementById('profile-score-val');
    if (scoreEl) scoreEl.innerText = `${friend.score}% Intimacy Score`;

    const lifeEl = document.getElementById('profile-current-life');
    if (lifeEl) lifeEl.innerText = friend.currentLife;

    const summaryEl = document.getElementById('profile-ai-summary');
    if (summaryEl) summaryEl.innerText = friend.aiSummary;

    // Favorites
    const favsContainer = document.getElementById('profile-favorites-list');
    if (favsContainer && friend.favorites) {
      favsContainer.innerHTML = Object.entries(friend.favorites).map(([key, val]) => `
        <div style="padding: 10px 14px; background: #FFF9FC; border-radius: 12px; margin-bottom: 8px; font-size: 13px;">
          <strong style="text-transform: capitalize; color: var(--accent-hover);">${key}:</strong> ${val}
        </div>
      `).join('');
    }

    // Safe & Avoid Topics
    const safeContainer = document.getElementById('profile-safe-topics');
    if (safeContainer && friend.safeTopics) {
      safeContainer.innerHTML = friend.safeTopics.map(topic => `
        <div class="topic-box safe-topic-box">
          🟢 <strong>Great Topic:</strong> ${topic}
        </div>
      `).join('');
    }

    const avoidContainer = document.getElementById('profile-avoid-topics');
    if (avoidContainer && friend.avoidTopics) {
      avoidContainer.innerHTML = friend.avoidTopics.map(topic => `
        <div class="topic-box avoid-topic-box">
          🔴 <strong>Topic to Avoid:</strong> ${topic}
        </div>
      `).join('');
    }

    // Gift Ideas
    const giftsContainer = document.getElementById('profile-gift-ideas');
    if (giftsContainer && friend.giftIdeas) {
      giftsContainer.innerHTML = friend.giftIdeas.map(gift => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 14px; border: 1px solid var(--card-border); margin-bottom: 8px;">
          <div>
            <strong style="font-size: 13px; color: var(--text-dark);">${gift.item}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${gift.tag}</div>
          </div>
          <span style="font-weight: 800; color: var(--accent-hover); font-size: 14px;">${gift.price}</span>
        </div>
      `).join('');
    }
  },

  // Render Conversation Diaries List
  renderDiariesList() {
    const container = document.getElementById('diaries-full-list');
    if (!container) return;

    container.innerHTML = MindVaultData.diaries.map(diary => `
      <div class="glass-card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📖</span>
            <div>
              <h4 style="font-size: 16px; font-weight: 700;">${diary.title}</h4>
              <span style="font-size: 12px; color: var(--text-muted);">With <strong>${diary.friendName}</strong> • ${diary.location}</span>
            </div>
          </div>
          <span style="font-size: 12px; font-weight: 700; background: var(--primary-light); color: var(--accent-hover); padding: 4px 12px; border-radius: 14px;">${diary.date}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-medium); line-height: 1.6; margin-bottom: 12px;">${diary.content}</p>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 6px;">
            ${diary.tags.map(t => `<span class="tag-chip">#${t}</span>`).join('')}
          </div>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-dark);">${diary.mood}</span>
        </div>
      </div>
    `).join('');
  },

  // Render Reminder Calendar items
  renderRemindersList() {
    const container = document.getElementById('reminders-list-container');
    if (!container) return;

    container.innerHTML = MindVaultData.reminders.map(rem => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: white; border-radius: 16px; border: 1px solid var(--card-border); margin-bottom: 12px; box-shadow: var(--shadow-soft);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; background: var(--lavender-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
            🎂
          </div>
          <div>
            <strong style="font-size: 14px;">${rem.title}</strong>
            <p style="font-size: 12px; color: var(--text-muted);">${rem.date} • ${rem.type}</p>
          </div>
        </div>
        <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 12px;" onclick="alert('Notification set for ${rem.date}!')">🔔 Remind Me</button>
      </div>
    `).join('');
  },

  // Meeting Prep Modal
  openPrepModal(friendId) {
    const friend = MindVaultData.friends.find(f => f.id === friendId) || MindVaultData.friends[0];
    const modal = document.getElementById('modal-meeting-prep');
    
    document.getElementById('prep-friend-name').innerText = friend.name;
    document.getElementById('prep-friend-avatar').src = friend.avatar;
    document.getElementById('prep-current-life').innerText = friend.currentLife;
    
    document.getElementById('prep-safe-list').innerHTML = friend.safeTopics.map(t => `<li style="margin-bottom: 6px; font-size: 13px;">🟢 ${t}</li>`).join('');
    document.getElementById('prep-avoid-list').innerHTML = friend.avoidTopics.map(t => `<li style="margin-bottom: 6px; font-size: 13px;">🔴 ${t}</li>`).join('');
    
    modal.classList.add('active');
  },

  // Conversation Simulator trigger
  openSimulatorModal(friendId) {
    const friend = MindVaultData.friends.find(f => f.id === friendId) || MindVaultData.friends[0];
    const modal = document.getElementById('modal-sim-chat');
    
    document.getElementById('sim-friend-name').innerText = friend.name;
    document.getElementById('sim-chat-log').innerHTML = `
      <div class="chat-bubble ai">
        👋 Hey Aria! Great to catch up. How are things with you?
      </div>
    `;

    modal.classList.add('active');
  },

  async sendSimMessage() {
    const input = document.getElementById('sim-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const log = document.getElementById('sim-chat-log');
    log.innerHTML += `<div class="chat-bubble user">${msg}</div>`;
    input.value = '';
    log.scrollTop = log.scrollHeight;

    const friend = MindVaultData.friends.find(f => f.id === this.selectedFriendId) || MindVaultData.friends[0];

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    log.innerHTML += `<div class="chat-bubble ai" id="${typingId}"><em>${friend.name} is typing... 💬</em></div>`;
    log.scrollTop = log.scrollHeight;

    // Call Gemini API roleplay or fallback
    let aiResponse = await MindVaultGemini.roleplayFriend(friend, msg);
    if (!aiResponse) {
      const fallbackResponses = [
        `Aww that's so sweet! Speaking of which, Mochi had her cat checkup yesterday and she did super well! 🐱`,
        `Oh really? I've actually been thinking about our trip lately too! Let's definitely plan it! ✨`,
        `Haha totally! By the way, how is your new MindVault project coming along?`
      ];
      aiResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.innerText = aiResponse;
    log.scrollTop = log.scrollHeight;
  },

  // Floating AI Chat Assistant Drawer
  bindAIChat() {
    const fab = document.getElementById('ai-fab-btn');
    const drawer = document.getElementById('ai-chat-drawer');
    const closeBtn = document.getElementById('ai-chat-close');

    if (fab && drawer) {
      fab.addEventListener('click', () => {
        drawer.classList.toggle('active');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        drawer.classList.remove('active');
      });
    }
  },

  async sendAIChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const log = document.getElementById('ai-chat-messages');
    log.innerHTML += `<div class="chat-bubble user">${msg}</div>`;
    input.value = '';
    log.scrollTop = log.scrollHeight;

    // Show typing indicator
    const typingId = 'ai-typing-' + Date.now();
    log.innerHTML += `<div class="chat-bubble ai" id="${typingId}"><em>Analyzing relationship memory with Gemini AI... ✨</em></div>`;
    log.scrollTop = log.scrollHeight;

    // Call Gemini AI Assistant
    let response = await MindVaultGemini.chatWithAssistant(msg, MindVaultData.friends, MindVaultData.diaries);
    
    if (!response) {
      if (msg.toLowerCase().includes('sophia')) {
        response = "Sophia Martinez loves Iced Oat Lattes and photography. Remember to ask about her kitten Mochi!";
      } else if (msg.toLowerCase().includes('liam')) {
        response = "Liam Vance is training for a marathon and loves Cold Brew. Avoid bringing up past partnership friction.";
      } else {
        response = "I'm analyzing your relationship history! Sophia loves matcha & Kyoto, while Liam is focused on his Berlin Marathon prep.";
      }
    }

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.innerText = response;
    log.scrollTop = log.scrollHeight;
  },

  bindModals() {
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });
  }
};
