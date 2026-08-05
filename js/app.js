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
    this.getDreamJournals();
    this.renderDashboard();
    this.renderFriendsGrid();
    this.renderDiariesList();
    this.renderRemindersList();
    this.renderTopicsPage();
    this.populateDiaryFriendOptions();
    this.updateSupabaseStatusUI();
    this.updateFriendsCountBadge();
  },

  toggleMobileSidebar(forceState) {
    const sidebar = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const isOpen = typeof forceState === 'boolean' ? forceState : !sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', isOpen);
    backdrop.classList.toggle('active', isOpen);
  },

  switchDiaryTab(tabName) {
    const memoriesBtn = document.getElementById('tab-btn-memories');
    const dailyBtn = document.getElementById('tab-btn-daily');
    const memoriesContent = document.getElementById('diary-tab-memories-content');
    const dailyContent = document.getElementById('diary-tab-daily-content');

    if (tabName === 'daily') {
      if (memoriesBtn) memoriesBtn.classList.remove('active');
      if (dailyBtn) dailyBtn.classList.add('active');
      if (memoriesContent) memoriesContent.style.display = 'none';
      if (dailyContent) dailyContent.style.display = 'block';
      this.renderDailyJournalsList();
    } else {
      if (dailyBtn) dailyBtn.classList.remove('active');
      if (memoriesBtn) memoriesBtn.classList.add('active');
      if (dailyContent) dailyContent.style.display = 'none';
      if (memoriesContent) memoriesContent.style.display = 'block';
      this.renderDiariesList();
    }
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
        role: supabaseUser.user_metadata?.role || 'user',
        avatar: MindVaultData.user.avatar
      };
      this.hideAuthScreen();
    } else if (localSession) {
      try {
        this.currentUser = JSON.parse(localSession);
        if (!this.currentUser.role) this.currentUser.role = 'user';
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
    this.applyRolePermissions();
  },

  updateUserSidebar() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('sidebar-user-name');
    const badgeEl = document.getElementById('sidebar-user-role-badge');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.innerText = this.currentUser.name;
    const isAdmin = this.currentUser.role === 'admin';
    if (badgeEl) {
      badgeEl.innerText = isAdmin ? 'Admin 🛡️' : 'User 👤';
      badgeEl.className = `role-badge ${isAdmin ? 'role-badge-admin' : 'role-badge-user'}`;
    }
    if (avatarEl && this.currentUser.avatar) avatarEl.src = this.currentUser.avatar;

    // Update settings inputs if present
    const settingNameInput = document.getElementById('user-setting-name');
    const settingEmailInput = document.getElementById('user-setting-email');
    if (settingNameInput) settingNameInput.value = this.currentUser.name;
    if (settingEmailInput) settingEmailInput.value = this.currentUser.email || '';

    // Update dashboard hero greeting
    const greetingHeading = document.getElementById('dash-greeting-heading');
    if (greetingHeading) {
      greetingHeading.innerHTML = `Good morning, ${this.currentUser.name || 'User'}! 🌸`;
    }
  },

  applyRolePermissions() {
    const role = this.currentUser?.role || 'user';
    const isAdmin = role === 'admin';

    // 1. Sidebar Nav Item visibility
    const adminNavItem = document.getElementById('nav-item-admin');
    if (adminNavItem) {
      adminNavItem.style.display = isAdmin ? 'block' : 'none';
    }

    // 2. User Settings Page Role Card
    const settingsRoleBadge = document.getElementById('settings-role-badge');
    if (settingsRoleBadge) {
      settingsRoleBadge.innerText = isAdmin ? 'Administrator' : 'User';
      settingsRoleBadge.className = `role-badge ${isAdmin ? 'role-badge-admin' : 'role-badge-user'}`;
    }
    const settingsSwitchBtn = document.getElementById('settings-admin-switch-btn');
    if (settingsSwitchBtn) {
      settingsSwitchBtn.innerHTML = isAdmin ?
        `<i class="fa-solid fa-user"></i> Switch to User Mode` :
        `<i class="fa-solid fa-shield-halved" style="color: var(--accent-hover);"></i> Switch to Admin Mode`;
    }

    // 3. Admin Console Access Guard
    const adminDenied = document.getElementById('admin-access-denied');
    const adminWrapper = document.getElementById('admin-content-wrapper');
    if (adminDenied && adminWrapper) {
      adminDenied.style.display = isAdmin ? 'none' : 'block';
      adminWrapper.style.display = isAdmin ? 'flex' : 'none';
    }

    if (isAdmin) {
      this.renderAdminUsersTable();
      this.testDatabaseConnection();
      this.testAIKeyConnection();
    }
  },

  switchRole(newRole) {
    if (!this.currentUser) {
      this.currentUser = {
        name: newRole === 'admin' ? 'System Administrator' : 'Aria Chen',
        email: newRole === 'admin' ? 'admin@mindvault.ai' : 'aria@mindvault.ai',
        role: newRole,
        avatar: MindVaultData.user.avatar
      };
    } else {
      this.currentUser.role = newRole;
      if (newRole === 'admin') {
        this.currentUser.name = 'System Administrator';
        this.currentUser.email = 'admin@mindvault.ai';
      } else {
        this.currentUser.name = 'Aria Chen';
        this.currentUser.email = 'aria@mindvault.ai';
      }
    }
    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    this.updateUserSidebar();
    this.applyRolePermissions();
    this.showToast(`Switched role to ${newRole.toUpperCase()} mode! ✨`, 'success');
    if (newRole === 'admin') {
      this.switchView('admin');
    } else if (this.activeView === 'admin') {
      this.switchView('dashboard');
    }
  },

  toggleUserAdminRole() {
    const current = this.currentUser?.role || 'user';
    const nextRole = current === 'admin' ? 'user' : 'admin';
    this.switchRole(nextRole);
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
    const usernameInput = document.getElementById('auth-input-email')?.value.trim();
    const passwordInput = document.getElementById('auth-input-password')?.value.trim();
    const name = document.getElementById('auth-input-name')?.value.trim();

    if (!usernameInput || !passwordInput) {
      this.showToast('Please enter both username/email and password.', 'warning');
      return;
    }

    // Check for hardcoded Admin Credentials: username "admincantik", password "husnicantik594$"
    if (usernameInput === 'admincantik' || usernameInput === 'admincantik@mindvault.ai') {
      if (passwordInput === 'husnicantik594$') {
        this.currentUser = {
          name: 'Admin Cantik',
          email: 'admincantik@mindvault.ai',
          username: 'admincantik',
          role: 'admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
        };
        localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
        this.showToast('Logged in as Administrator (Admin Cantik)! 🛡️✨', 'success');
        this.hideAuthScreen();
        this.switchView('admin');
        return;
      } else {
        this.showToast('Invalid Admin Password! Please check your credentials.', 'error');
        return;
      }
    }

    // Regular User Login / Registration Logic
    if (this.authMode === 'register') {
      if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
        const { data, error } = await MindVaultSupabase.signUp(usernameInput, passwordInput, name || 'User');
        if (error) {
          this.showToast('Sign Up Error: ' + error.message, 'error');
          return;
        }
        this.showToast('Account created successfully! Logged in.', 'success');
      }

      // Save user credential locally so admin can inspect
      const newUser = {
        name: name || usernameInput.split('@')[0],
        email: usernameInput.includes('@') ? usernameInput : `${usernameInput}@mindvault.ai`,
        username: usernameInput,
        password: passwordInput,
        role: 'user',
        avatar: MindVaultData.user.avatar
      };

      let registered = [];
      try {
        registered = JSON.parse(localStorage.getItem('MINDVAULT_ALL_USERS') || '[]');
      } catch (e) {}
      registered.push(newUser);
      localStorage.setItem('MINDVAULT_ALL_USERS', JSON.stringify(registered));

      this.currentUser = newUser;
    } else {
      if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
        const { data, error } = await MindVaultSupabase.signIn(usernameInput, passwordInput);
        if (error) {
          this.showToast('Login Failed: ' + error.message, 'error');
          return;
        }
        const user = data.user;
        this.currentUser = {
          name: user.user_metadata?.full_name || usernameInput.split('@')[0],
          email: user.email,
          role: 'user',
          avatar: MindVaultData.user.avatar
        };
      } else {
        this.currentUser = {
          name: usernameInput.split('@')[0],
          email: usernameInput.includes('@') ? usernameInput : `${usernameInput}@mindvault.ai`,
          username: usernameInput,
          password: passwordInput,
          role: 'user',
          avatar: MindVaultData.user.avatar
        };

        // Save / update in registered users list
        let registered = [];
        try {
          registered = JSON.parse(localStorage.getItem('MINDVAULT_ALL_USERS') || '[]');
        } catch (e) {}
        if (!registered.some(u => u.email === this.currentUser.email || u.username === usernameInput)) {
          registered.push(this.currentUser);
          localStorage.setItem('MINDVAULT_ALL_USERS', JSON.stringify(registered));
        }
      }
    }

    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    this.showToast(`Welcome back, ${this.currentUser.name}! 👋`, 'success');
    this.hideAuthScreen();
  },

  demoLogin(role = 'user') {
    if (role === 'admin') {
      this.currentUser = {
        name: 'System Administrator',
        email: 'admin@mindvault.ai',
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
      };
    } else {
      this.currentUser = {
        name: MindVaultData.user.name,
        email: MindVaultData.user.email,
        role: 'user',
        avatar: MindVaultData.user.avatar
      };
    }
    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    this.hideAuthScreen();
  },

  async handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar (logout) dari MindVault?')) {
      try {
        if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.signOut) {
          await MindVaultSupabase.signOut();
        }
      } catch (e) {}

      localStorage.removeItem('MINDVAULT_AUTH_SESSION');
      this.currentUser = null;

      // Show Toast
      this.showToast('Berhasil keluar (Logged out).', 'info');

      // Clear input fields
      if (document.getElementById('auth-username')) document.getElementById('auth-username').value = '';
      if (document.getElementById('auth-password')) document.getElementById('auth-password').value = '';
      if (document.getElementById('auth-name')) document.getElementById('auth-name').value = '';

      // Force show Auth Modal Screen overlay
      this.showAuthScreen();
      this.switchView('dashboard');
    }
  },

  uploadedAvatarData: null,

  handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('File size too large. Please select an image under 5MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadedAvatarData = e.target.result;
      const container = document.getElementById('add-friend-preview-container');
      const img = document.getElementById('add-friend-preview-img');
      if (container && img) {
        img.src = this.uploadedAvatarData;
        container.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  },

  openAddFriendModal() {
    const titleEl = document.getElementById('modal-add-friend-title');
    if (titleEl) titleEl.innerText = '✨ Add New Friend Profile';
    const idEl = document.getElementById('edit-friend-id');
    if (idEl) idEl.value = '';
    const btnEl = document.getElementById('btn-save-friend');
    if (btnEl) btnEl.innerText = 'Create Friend Profile';

    // Clear form inputs & reset upload state
    this.uploadedAvatarData = null;
    ['name', 'relation', 'birthday', 'avatar', 'bio', 'life', 'fav-drink', 'fav-food', 'fav-color', 'fav-hobby', 'fav-book', 'likes', 'dislikes', 'safe-topics', 'avoid-topics', 'gifts'].forEach(id => {
      const el = document.getElementById('add-friend-' + id);
      if (el) el.value = '';
    });
    if (document.getElementById('add-friend-file')) document.getElementById('add-friend-file').value = '';
    const container = document.getElementById('add-friend-preview-container');
    if (container) container.style.display = 'none';

    document.getElementById('modal-add-friend')?.classList.add('active');
  },

  openEditProfileModal(friendId) {
    const friend = MindVaultData.friends.find(f => f.id === friendId) || MindVaultData.friends[0];
    if (!friend) {
      this.showToast('Friend not found.', 'warning');
      return;
    }

    const titleEl = document.getElementById('modal-add-friend-title');
    if (titleEl) titleEl.innerText = `✏️ Edit Profile: ${friend.name}`;
    const idEl = document.getElementById('edit-friend-id');
    if (idEl) idEl.value = friend.id;
    const btnEl = document.getElementById('btn-save-friend');
    if (btnEl) btnEl.innerText = 'Save Changes';

    if (document.getElementById('add-friend-name')) document.getElementById('add-friend-name').value = friend.name || '';
    if (document.getElementById('add-friend-relation')) document.getElementById('add-friend-relation').value = friend.relation || '';
    if (document.getElementById('add-friend-birthday')) document.getElementById('add-friend-birthday').value = friend.birthday || '';
    if (document.getElementById('add-friend-avatar')) document.getElementById('add-friend-avatar').value = friend.avatar || '';
    if (document.getElementById('add-friend-bio')) document.getElementById('add-friend-bio').value = friend.bio || '';
    if (document.getElementById('add-friend-life')) document.getElementById('add-friend-life').value = friend.currentLife || '';

    // Favorites
    const favs = friend.favorites || {};
    if (document.getElementById('add-friend-fav-drink')) document.getElementById('add-friend-fav-drink').value = favs.drink || '';
    if (document.getElementById('add-friend-fav-food')) document.getElementById('add-friend-fav-food').value = favs.food || '';
    if (document.getElementById('add-friend-fav-color')) document.getElementById('add-friend-fav-color').value = favs.color || '';
    if (document.getElementById('add-friend-fav-hobby')) document.getElementById('add-friend-fav-hobby').value = favs.hobby || '';
    if (document.getElementById('add-friend-fav-book')) document.getElementById('add-friend-fav-book').value = favs.book || '';

    // Preferences & Topics
    if (document.getElementById('add-friend-likes')) document.getElementById('add-friend-likes').value = (friend.likes || []).join(', ');
    if (document.getElementById('add-friend-dislikes')) document.getElementById('add-friend-dislikes').value = (friend.dislikes || []).join(', ');
    if (document.getElementById('add-friend-safe-topics')) document.getElementById('add-friend-safe-topics').value = (friend.safeTopics || []).join(', ');
    if (document.getElementById('add-friend-avoid-topics')) document.getElementById('add-friend-avoid-topics').value = (friend.avoidTopics || []).join(', ');

    // Gift Ideas
    const gifts = (friend.giftIdeas || []).map(g => `${g.item}${g.price ? ' (' + g.price + ')' : ''}`).join(', ');
    if (document.getElementById('add-friend-gifts')) document.getElementById('add-friend-gifts').value = gifts;

    document.getElementById('modal-add-friend')?.classList.add('active');
  },

  async saveFriendFromModal() {
    const editId = document.getElementById('edit-friend-id')?.value;
    if (editId) {
      await this.saveEditedFriend(isNaN(Number(editId)) ? editId : Number(editId));
    } else {
      await this.saveNewFriend();
    }
  },

  readFriendFormData() {
    const name = document.getElementById('add-friend-name')?.value.trim();
    const relation = document.getElementById('add-friend-relation')?.value.trim();
    const birthday = document.getElementById('add-friend-birthday')?.value;
    const avatarInput = document.getElementById('add-friend-avatar')?.value.trim();
    const bio = document.getElementById('add-friend-bio')?.value.trim();
    const currentLife = document.getElementById('add-friend-life')?.value.trim();

    // Favorites
    const favDrink = document.getElementById('add-friend-fav-drink')?.value.trim();
    const favFood = document.getElementById('add-friend-fav-food')?.value.trim();
    const favColor = document.getElementById('add-friend-fav-color')?.value.trim();
    const favHobby = document.getElementById('add-friend-fav-hobby')?.value.trim();
    const favBook = document.getElementById('add-friend-fav-book')?.value.trim();

    const favorites = {};
    if (favDrink) favorites.drink = favDrink;
    if (favFood) favorites.food = favFood;
    if (favColor) favorites.color = favColor;
    if (favHobby) favorites.hobby = favHobby;
    if (favBook) favorites.book = favBook;

    // Topics & Likes
    const parseList = (id) => (document.getElementById(id)?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const likes = parseList('add-friend-likes');
    const dislikes = parseList('add-friend-dislikes');
    const safeTopics = parseList('add-friend-safe-topics');
    const avoidTopics = parseList('add-friend-avoid-topics');

    // Gift Ideas parser
    const giftsRaw = parseList('add-friend-gifts');
    const giftIdeas = giftsRaw.map(g => {
      const match = g.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      return { item: match ? match[1] : g, price: match && match[2] ? match[2] : '', tag: 'Gift' };
    });

    const initialAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Friend')}&background=F8BBD9&color=2D1A29&bold=true&size=250`;
    const avatar = this.uploadedAvatarData || avatarInput || initialAvatar;

    return {
      name: name || 'Teman Baru',
      relation: relation || 'Friend',
      birthday: birthday || null,
      avatar: avatar,
      bio: bio || '',
      currentLife: currentLife || 'Recently added to MindVault.',
      favorites,
      likes,
      dislikes,
      safeTopics,
      avoidTopics,
      giftIdeas
    };
  },

  async saveNewFriend() {
    const friendData = this.readFriendFormData();

    const newFriend = {
      ...friendData,
      tier: friendData.relation || 'Close Circle',
      score: 85,
      aiSummary: `${friendData.name} is a valued connection in your network.`
    };

    await MindVaultSupabase.insertFriend(newFriend);
    this.showToast(`${newFriend.name} has been added to your friend directory! ✨`, 'success');
    document.getElementById('modal-add-friend')?.classList.remove('active');

    this.renderFriendsGrid();
    this.populateDiaryFriendOptions();
    this.updateFriendsCountBadge();
  },

  async saveEditedFriend(friendId) {
    const friendData = this.readFriendFormData();
    const existing = MindVaultData.friends.find(f => f.id === friendId) || {};

    const updatedFriend = {
      ...existing,
      ...friendData,
      id: friendId
    };

    await MindVaultSupabase.updateFriend(updatedFriend);
    this.showToast(`Profile ${updatedFriend.name} successfully updated! ✨`, 'success');
    document.getElementById('modal-add-friend')?.classList.remove('active');

    this.renderFriendsGrid();
    this.renderFriendProfile(friendId);
    this.populateDiaryFriendOptions();
    this.updateFriendsCountBadge();
  },

  openAddDiaryModal() {
    const titleEl = document.getElementById('modal-add-diary-header-title');
    if (titleEl) titleEl.innerText = '📖 Log New Memory / Conversation';
    const editIdEl = document.getElementById('edit-diary-id');
    if (editIdEl) editIdEl.value = '';
    const btnEl = document.getElementById('btn-save-diary');
    if (btnEl) btnEl.innerText = 'Save Memory Log';

    const titleInput = document.getElementById('add-diary-title');
    const contentInput = document.getElementById('add-diary-content');
    const dateInput = document.getElementById('add-diary-date');
    const moodInput = document.getElementById('add-diary-mood');

    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (moodInput) moodInput.selectedIndex = 0;

    this.populateDiaryFriendOptions();
    document.getElementById('modal-add-diary')?.classList.add('active');
  },

  openEditDiaryModal(diaryId) {
    const diaries = this.getLiveDiariesContext();
    const diary = diaries.find(d => String(d.id) === String(diaryId) || d.title === diaryId);
    if (!diary) {
      this.showToast('Memory log not found.', 'warning');
      return;
    }

    const titleEl = document.getElementById('modal-add-diary-header-title');
    if (titleEl) titleEl.innerText = `✏️ Edit Memory Log: ${diary.title}`;
    const editIdEl = document.getElementById('edit-diary-id');
    if (editIdEl) editIdEl.value = diary.id;
    const btnEl = document.getElementById('btn-save-diary');
    if (btnEl) btnEl.innerText = 'Update Memory Log';

    this.populateDiaryFriendOptions();

    const titleInput = document.getElementById('add-diary-title');
    const friendSelect = document.getElementById('add-diary-friend');
    const dateInput = document.getElementById('add-diary-date');
    const moodInput = document.getElementById('add-diary-mood');
    const contentInput = document.getElementById('add-diary-content');

    if (titleInput) titleInput.value = diary.title || '';
    if (friendSelect) friendSelect.value = diary.friendName || '';
    if (dateInput) dateInput.value = diary.date || new Date().toISOString().split('T')[0];
    if (moodInput && diary.mood) moodInput.value = diary.mood;
    if (contentInput) contentInput.value = diary.content || '';

    document.getElementById('modal-add-diary')?.classList.add('active');
  },

  saveDiaryFromModal() {
    const editId = document.getElementById('edit-diary-id')?.value;
    if (editId) {
      this.saveEditedDiary(editId);
    } else {
      this.saveNewDiary();
    }
  },

  async saveNewDiary() {
    const title = document.getElementById('add-diary-title')?.value.trim();
    const friendName = document.getElementById('add-diary-friend')?.value;
    const date = document.getElementById('add-diary-date')?.value || new Date().toISOString().split('T')[0];
    const mood = document.getElementById('add-diary-mood')?.value || '😊 Energetic & Inspired';
    const content = document.getElementById('add-diary-content')?.value.trim();

    if (!title || !content) {
      this.showToast('Mohon isi Judul dan Detail Percakapan.', 'warning');
      return;
    }

    const matchedFriend = MindVaultData.friends.find(f => f.name === friendName) || MindVaultData.friends[0];

    const newDiary = {
      id: Date.now(),
      friendId: matchedFriend ? matchedFriend.id : 1,
      friendName: friendName || (matchedFriend ? matchedFriend.name : 'Friend'),
      date: date,
      title: title,
      location: 'Personal Log',
      mood: mood,
      content: content,
      tags: ['Memory', 'Log']
    };

    await MindVaultSupabase.insertDiary(newDiary);
    this.showToast('Memory log saved successfully! 📖', 'success');
    document.getElementById('modal-add-diary')?.classList.remove('active');

    this.renderDiariesList();
    this.renderDashboard();
  },

  async saveEditedDiary(diaryId) {
    const title = document.getElementById('add-diary-title')?.value.trim();
    const friendName = document.getElementById('add-diary-friend')?.value;
    const date = document.getElementById('add-diary-date')?.value || new Date().toISOString().split('T')[0];
    const mood = document.getElementById('add-diary-mood')?.value || '😊 Energetic & Inspired';
    const content = document.getElementById('add-diary-content')?.value.trim();

    if (!title || !content) {
      this.showToast('Mohon isi Judul dan Detail Percakapan.', 'warning');
      return;
    }

    let diaries = this.getLiveDiariesContext();
    let index = diaries.findIndex(d => String(d.id) === String(diaryId) || d.title === title);

    const matchedFriend = MindVaultData.friends.find(f => f.name === friendName) || { id: 1, name: friendName || 'Friend' };

    let updatedDiary = {
      id: diaryId || Date.now(),
      friendId: matchedFriend.id,
      friendName: friendName || 'Friend',
      date: date,
      title: title,
      location: 'Personal Log',
      mood: mood,
      content: content,
      tags: ['Memory', 'Log']
    };

    if (index !== -1) {
      diaries[index] = updatedDiary;
    } else {
      diaries.unshift(updatedDiary);
    }

    MindVaultData.diaries = diaries;
    localStorage.setItem('MINDVAULT_LOCAL_DIARIES', JSON.stringify(diaries));

    try {
      if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.updateDiary) {
        await MindVaultSupabase.updateDiary(updatedDiary);
      }
    } catch (e) {
      console.warn('Supabase update exception handled:', e);
    }

    this.showToast(`Catatan memory "${title}" berhasil diperbarui! ✏️✨`, 'success');
    document.getElementById('modal-add-diary')?.classList.remove('active');

    this.renderDiariesList();
    this.renderDashboard();
  },

  async deleteDiary(diaryId) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan percakapan ini?')) return;

    MindVaultData.diaries = (MindVaultData.diaries || []).filter(d => String(d.id) !== String(diaryId));
    await MindVaultSupabase.deleteDiary(diaryId);

    this.showToast('Catatan percakapan berhasil dihapus! 🗑️', 'info');
    this.renderDiariesList();
    this.renderDashboard();
  },

  populateDiaryFriendOptions() {
    const select = document.getElementById('add-diary-friend');
    if (!select) return;
    if (!MindVaultData.friends || MindVaultData.friends.length === 0) {
      select.innerHTML = '<option value="">Belum ada teman</option>';
      return;
    }
    select.innerHTML = MindVaultData.friends.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
  },

  saveUserProfileSettings() {
    const newName = document.getElementById('user-setting-name')?.value.trim();
    const newEmail = document.getElementById('user-setting-email')?.value.trim();
    const newQuote = document.getElementById('user-setting-quote')?.value.trim();

    if (!newName) {
      this.showToast('Please enter your name.', 'warning');
      return;
    }

    if (!this.currentUser) {
      this.currentUser = { name: newName, email: newEmail, role: 'user', avatar: MindVaultData.user.avatar };
    } else {
      this.currentUser.name = newName;
      if (newEmail) this.currentUser.email = newEmail;
    }

    if (newQuote) {
      MindVaultData.user.quote = newQuote;
    }

    localStorage.setItem('MINDVAULT_AUTH_SESSION', JSON.stringify(this.currentUser));
    this.updateUserSidebar();
    this.renderDashboard();
    this.showToast('Profile settings updated successfully! ✨', 'success');
  },

  saveSupabaseConfig() {
    const url = document.getElementById('setting-supabase-url')?.value;
    const key = document.getElementById('setting-supabase-key')?.value;
    if (!url || !key) {
      this.showToast('Please enter both Supabase URL and Anon Key.', 'warning');
      return;
    }
    const success = MindVaultSupabase.setCredentials(url, key);
    if (success) {
      this.showToast('Connected to Supabase successfully! Reloading data...', 'success');
      this.init();
    } else {
      this.showToast('Could not connect to Supabase. Please verify your credentials.', 'error');
    }
  },

  saveGeminiConfig() {
    const key = document.getElementById('setting-gemini-key')?.value;
    if (!key) {
      this.showToast('Please enter a valid API Key.', 'warning');
      return;
    }
    localStorage.setItem('MINDVAULT_GEMINI_KEY', key.trim());
    this.showToast('API Key saved successfully! ✨', 'success');
    this.testAIKeyConnection();
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

  testDatabaseConnection() {
    const dot = document.getElementById('admin-db-dot');
    const title = document.getElementById('admin-db-status-title');
    if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.isConfigured) {
      if (dot) dot.className = 'status-dot status-dot-active';
      if (title) title.innerText = 'Supabase Connected';
      this.showToast('Database Connection Test Passed! 🟢', 'success');
    } else {
      if (dot) dot.className = 'status-dot status-dot-warning';
      if (title) title.innerText = 'Local Offline Mode';
      this.showToast('Operating in Local Browser Data mode.', 'info');
    }
  },

  testAIKeyConnection() {
    const dot = document.getElementById('admin-ai-dot');
    const title = document.getElementById('admin-ai-status-title');
    const key = localStorage.getItem('MINDVAULT_GEMINI_KEY');
    if (key) {
      if (dot) dot.className = 'status-dot status-dot-active';
      if (title) title.innerText = 'Gemini AI Ready';
      this.showToast('AI API Key verified & active! ⚡', 'success');
    } else {
      if (dot) dot.className = 'status-dot status-dot-warning';
      if (title) title.innerText = 'Rule-based AI';
      this.showToast('Using default rule-based AI engine.', 'info');
    }
  },

  renderAdminUsersTable() {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    let users = [
      { id: 1, name: 'Aria Chen', email: 'aria@mindvault.ai', username: 'aria', password: 'user123', role: 'user', status: 'Active', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80' },
      { id: 2, name: 'Admin Cantik', email: 'admincantik@mindvault.ai', username: 'admincantik', password: 'husnicantik594$', role: 'admin', status: 'Active', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80' }
    ];

    try {
      const stored = localStorage.getItem('MINDVAULT_ALL_USERS');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.forEach(p => {
          if (!users.some(u => u.email === p.email || u.username === p.username)) {
            users.push({
              id: Date.now() + Math.random(),
              name: p.name || p.username || 'User',
              email: p.email || `${p.username}@mindvault.ai`,
              username: p.username || p.email,
              password: p.password || '••••••••',
              role: p.role || 'user',
              status: 'Active',
              avatar: p.avatar || MindVaultData.user.avatar
            });
          }
        });
      }
    } catch (e) {}

    const countEl = document.getElementById('admin-users-count');
    if (countEl) countEl.innerText = `${users.length} Active Accounts`;

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${u.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" alt="${u.name}">
            <strong>${u.name}</strong>
          </div>
        </td>
        <td>${u.email}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <code style="background: rgba(248, 187, 217, 0.2); padding: 4px 8px; border-radius: 8px; font-weight: 700; color: var(--accent-hover); font-family: monospace;">${u.password || 'husnicantik594$'}</code>
            <i class="fa-regular fa-copy" style="cursor: pointer; color: var(--text-muted);" title="Copy Password" onclick="navigator.clipboard.writeText('${u.password || 'husnicantik594$'}'); MindVaultApp.showToast('Password copied!', 'success');"></i>
          </div>
        </td>
        <td>
          <span class="role-badge ${u.role === 'admin' ? 'role-badge-admin' : 'role-badge-user'}">${u.role}</span>
        </td>
        <td><span class="status-dot status-dot-active"></span> ${u.status}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="MindVaultApp.switchRole('${u.role === 'admin' ? 'user' : 'admin'}')">
            ${u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
          </button>
        </td>
      </tr>
    `).join('');
  },

  resetSampleData() {
    if (confirm('Restore initial sample seed data?')) {
      localStorage.removeItem('MINDVAULT_LOCAL_FRIENDS');
      localStorage.removeItem('MINDVAULT_LOCAL_DIARIES');
      localStorage.removeItem('MINDVAULT_LOCAL_DAILY_JOURNALS');
      location.reload();
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
    this.toggleMobileSidebar(false);
    
    // Update nav active styles
    document.querySelectorAll('.nav-item button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Access guard for Admin view
    if (viewName === 'admin') {
      this.applyRolePermissions();
    }

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
    const greetingHeading = document.getElementById('dash-greeting-heading');
    if (greetingHeading) {
      const userName = this.currentUser ? (this.currentUser.name || 'User') : 'Friend';
      greetingHeading.innerHTML = `Good morning, ${userName}! 🌸`;
    }

    const friendsCount = MindVaultData.friends ? MindVaultData.friends.length : 0;
    const conversationDiariesCount = MindVaultData.diaries ? MindVaultData.diaries.length : 0;
    const dailyJournalsCount = MindVaultData.dailyJournals ? MindVaultData.dailyJournals.length : 0;
    const totalDiaries = conversationDiariesCount + dailyJournalsCount;

    // Health Score calculation
    let healthScore = 0;
    if (friendsCount > 0) {
      const totalScore = MindVaultData.friends.reduce((sum, f) => sum + (f.score || 85), 0);
      healthScore = Math.round(totalScore / friendsCount);
    }

    const scoreVal = document.getElementById('dash-health-score');
    if (scoreVal) scoreVal.innerText = `${healthScore}%`;

    const friendsVal = document.getElementById('dash-active-friends');
    if (friendsVal) friendsVal.innerText = friendsCount;

    const diariesVal = document.getElementById('dash-diaried-memories');
    if (diariesVal) diariesVal.innerText = totalDiaries;

    const insightsVal = document.getElementById('dash-ai-insights');
    if (insightsVal) insightsVal.innerText = friendsCount > 0 ? (friendsCount * 2 + totalDiaries) : 0;

    // Today's topics list
    const topicsContainer = document.getElementById('dash-topics-list');
    if (topicsContainer) {
      if (!MindVaultData.todaysTopics || MindVaultData.todaysTopics.length === 0) {
        topicsContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 8px;">Belum ada topik hari ini.</p>';
      } else {
        topicsContainer.innerHTML = MindVaultData.todaysTopics.map(topic => `
          <div style="padding: 12px 14px; background: rgba(255,255,255,0.7); border-radius: 12px; margin-bottom: 8px; border: 1px solid rgba(248,187,217,0.3); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: 600;">✨ ${topic.text}</span>
            <span style="font-size: 10px; font-weight: 700; background: var(--secondary); color: var(--accent-hover); padding: 4px 10px; border-radius: 10px;">${topic.priority}</span>
          </div>
        `).join('');
      }
    }

    // Recent Diary Logs
    const dashDiaryContainer = document.getElementById('dash-recent-diaries');
    if (dashDiaryContainer) {
      if (!MindVaultData.diaries || MindVaultData.diaries.length === 0) {
        dashDiaryContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 8px;">Belum ada jurnal percakapan.</p>';
      } else {
        dashDiaryContainer.innerHTML = MindVaultData.diaries.slice(0, 2).map(diary => `
          <div style="background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px; border: 1px solid var(--card-border); box-shadow: 0 4px 12px rgba(248,187,217,0.1);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <strong style="font-size: 14px; color: var(--text-dark);">${diary.title}</strong>
              <span style="font-size: 11px; color: var(--text-muted);">${diary.date}</span>
            </div>
            <p style="font-size: 12px; color: var(--text-medium); margin-bottom: 10px;">${diary.content}</p>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${(diary.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('')}
            </div>
          </div>
        `).join('');
      }
    }
  },

  // Render Friends Grid Directory
  renderFriendsGrid() {
    const grid = document.getElementById('friends-grid-container');
    if (!grid) return;

    if (!MindVaultData.friends || MindVaultData.friends.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada teman yang ditambahkan. Silakan tambah teman baru!</p>
        </div>`;
      return;
    }

    grid.innerHTML = MindVaultData.friends.map(friend => `
      <div class="friend-card">
        <div class="friend-card-avatar-wrapper">
          <img src="${friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'}" class="friend-card-avatar" alt="${friend.name}">
          <span class="tier-badge">${friend.tier || 'Friend'}</span>
        </div>
        <h4>${friend.name}</h4>
        <p class="relation-type">${friend.relation || ''}</p>
        
        <div class="friend-card-tags">
          ${(friend.likes || []).slice(0, 3).map(l => `<span class="tag-chip">❤️ ${l}</span>`).join('')}
        </div>

        <div style="width: 100%; padding: 10px; background: var(--bg-main); border-radius: 12px; font-size: 11px; color: var(--text-medium); margin-bottom: 14px; text-align: left;">
          <strong>💡 AI Brief:</strong> ${(friend.currentLife || 'Belum ada info.').substring(0, 65)}...
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
    if (!friend) return;

    // Basic Header Info
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.innerText = friend.name || 'Teman';

    const relationEl = document.getElementById('profile-relation');
    if (relationEl) relationEl.innerText = friend.relation || 'Friend';

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.src = friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';

    const bioEl = document.getElementById('profile-bio');
    if (bioEl) bioEl.innerText = friend.bio || 'Belum ada bio ringkas.';

    const scoreEl = document.getElementById('profile-score-val');
    if (scoreEl) scoreEl.innerText = `${friend.score || 85}% Intimacy Score`;

    const lifeEl = document.getElementById('profile-current-life');
    if (lifeEl) lifeEl.innerText = friend.currentLife || 'Belum ada kabar terbaru.';

    const summaryEl = document.getElementById('profile-ai-summary');
    if (summaryEl) summaryEl.innerText = friend.aiSummary || `${friend.name} adalah salah satu koneksi berharga di antarmuka MindVault Anda.`;

    // Favorites
    const favsContainer = document.getElementById('profile-favorites-list');
    if (favsContainer) {
      const favEntries = Object.entries(friend.favorites || {});
      if (favEntries.length === 0) {
        favsContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 6px;">Belum ada favorit yang diisi. Klik Edit Profile untuk menambahkan.</p>';
      } else {
        favsContainer.innerHTML = favEntries.map(([key, val]) => `
          <div style="padding: 10px 14px; background: #FFF9FC; border-radius: 12px; margin-bottom: 8px; font-size: 13px;">
            <strong style="text-transform: capitalize; color: var(--accent-hover);">${key}:</strong> ${val}
          </div>
        `).join('');
      }
    }

    // Safe & Avoid Topics
    const safeContainer = document.getElementById('profile-safe-topics');
    if (safeContainer) {
      const safeList = friend.safeTopics || [];
      if (safeList.length === 0) {
        safeContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Belum ada topik aman.</p>';
      } else {
        safeContainer.innerHTML = safeList.map(topic => `
          <div class="topic-box safe-topic-box">
            🟢 <strong>Great Topic:</strong> ${topic}
          </div>
        `).join('');
      }
    }

    const avoidContainer = document.getElementById('profile-avoid-topics');
    if (avoidContainer) {
      const avoidList = friend.avoidTopics || [];
      if (avoidList.length === 0) {
        avoidContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Belum ada topik yang dihindari.</p>';
      } else {
        avoidContainer.innerHTML = avoidList.map(topic => `
          <div class="topic-box avoid-topic-box">
            🔴 <strong>Topic to Avoid:</strong> ${topic}
          </div>
        `).join('');
      }
    }

    // Gift Ideas
    const giftsContainer = document.getElementById('profile-gift-ideas');
    if (giftsContainer) {
      const giftList = friend.giftIdeas || [];
      if (giftList.length === 0) {
        giftsContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Belum ada ide hadiah.</p>';
      } else {
        giftsContainer.innerHTML = giftList.map(gift => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 14px; border: 1px solid var(--card-border); margin-bottom: 8px;">
            <div>
              <strong style="font-size: 13px; color: var(--text-dark);">${gift.item}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${gift.tag || 'Gift'}</div>
            </div>
            <span style="font-weight: 800; color: var(--accent-hover); font-size: 14px;">${gift.price || ''}</span>
          </div>
        `).join('');
      }
    }
  },

  // Render Conversation Diaries List
  renderDiariesList() {
    const container = document.getElementById('diaries-full-list');
    if (!container) return;

    if (!MindVaultData.diaries || MindVaultData.diaries.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada catatan jurnal.</p>
        </div>`;
      return;
    }

    container.innerHTML = MindVaultData.diaries.map(diary => `
      <div class="glass-card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📖</span>
            <div>
              <h4 style="font-size: 16px; font-weight: 700;">${diary.title}</h4>
              <span style="font-size: 12px; color: var(--text-muted);">With <strong>${diary.friendName}</strong> • ${diary.location || 'Personal Log'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 700; background: var(--primary-light); color: var(--accent-hover); padding: 4px 12px; border-radius: 14px;">📅 ${diary.date}</span>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="MindVaultApp.openEditDiaryModal('${diary.id}')">
              <i class="fa-solid fa-pen-to-square" style="color: var(--accent-hover);"></i> Edit
            </button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; color: #DC2626; border-color: rgba(220,38,38,0.2);" onclick="MindVaultApp.deleteDiary('${diary.id}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
        <p style="font-size: 13px; color: var(--text-medium); line-height: 1.6; margin-bottom: 12px;">${diary.content}</p>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 6px;">
            ${(diary.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('')}
          </div>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-dark);">${diary.mood || ''}</span>
        </div>
      </div>
    `).join('');
  },

  // Render Reminder Calendar items
  renderRemindersList() {
    const container = document.getElementById('reminders-list-container');
    if (!container) return;

    if (!MindVaultData.reminders || MindVaultData.reminders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada pengingat.</p>
        </div>`;
      return;
    }

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

    // Check if API key is set
    if (!MindVaultGemini.getApiKey()) {
      setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.innerHTML = `⚠️ <em>Roleplay AI membutuhkan API Key. Masukkan Key di ⚙️ Settings -> AI Configuration agar ${friend.name} bisa membalas secara LIVE!</em>`;
        log.scrollTop = log.scrollHeight;
      }, 400);
      return;
    }

    // Call Gemini API roleplay or fallback
    let aiResponse = await MindVaultGemini.roleplayFriend(friend, msg);
    const typingEl = document.getElementById(typingId);

    if (aiResponse && aiResponse.error) {
      if (typingEl) {
        typingEl.innerHTML = `❌ <strong>AI Error:</strong> ${aiResponse.message}`;
      }
      log.scrollTop = log.scrollHeight;
      return;
    }

    if (typingEl) typingEl.innerText = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
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

  getLiveDiariesContext() {
    let diaries = Array.isArray(MindVaultData.diaries) ? [...MindVaultData.diaries] : [];

    // Merge from LocalStorage
    try {
      const local = localStorage.getItem('MINDVAULT_LOCAL_DIARIES');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (!diaries.some(d => String(d.id) === String(p.id) || d.title === p.title)) {
              diaries.unshift(p);
            }
          });
        }
      }
    } catch (e) {}

    // Extract directly from rendered DOM cards in #diaries-full-list if any card is visible!
    const domCards = document.querySelectorAll('#diaries-full-list .glass-card');
    domCards.forEach(card => {
      const title = card.querySelector('h4')?.innerText.trim();
      const content = card.querySelector('p')?.innerText.trim();
      const friendSpan = card.querySelector('span')?.innerText;
      let friendName = 'Ethan';
      if (friendSpan && friendSpan.includes('With')) {
        const match = friendSpan.match(/With\s+<strong>(.*?)<\/strong>|With\s+([^\s•]+)/);
        if (match) friendName = match[1] || match[2];
      }

      if (title && content) {
        if (!diaries.some(d => d.title === title || d.content === content)) {
          diaries.unshift({
            id: Date.now() + Math.random(),
            title: title,
            friendName: friendName,
            content: content,
            date: new Date().toISOString().split('T')[0],
            mood: '💭 Serious & Emotional'
          });
        }
      }
    });

    return diaries;
  },

  getLiveTopicsContext() {
    let starters = [
      "Ask Sophia about Mochi's Friday vet checkup",
      "Congratulate Liam on his 45km marathon training run"
    ];
    let reflections = [
      "Great relationships aren't built on grand gestures, but on remembering the small details that matter."
    ];

    try {
      const storedS = localStorage.getItem('MINDVAULT_LOCAL_TOPIC_STARTERS');
      if (storedS) {
        const parsed = JSON.parse(storedS);
        if (Array.isArray(parsed) && parsed.length > 0) starters = parsed;
      }
      const storedR = localStorage.getItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS');
      if (storedR) {
        const parsed = JSON.parse(storedR);
        if (Array.isArray(parsed) && parsed.length > 0) reflections = parsed;
      }
    } catch (e) {}

    return { starters, reflections };
  },

  renderTopicsPage() {
    const startersList = document.getElementById('topics-starters-list');
    const reflectionsList = document.getElementById('topics-reflections-list');
    const { starters, reflections } = this.getLiveTopicsContext();

    if (startersList) {
      startersList.innerHTML = starters.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: white; border-radius: 14px; margin-bottom: 10px; border: 1px solid var(--card-border);">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-dark); flex: 1; margin-right: 10px;">"${s}"</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #6D28D9;" onclick="MindVaultApp.openEditTopicModal('starter', ${idx})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #DC2626;" onclick="MindVaultApp.deleteTopicStarter(${idx})">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    if (reflectionsList) {
      reflectionsList.innerHTML = reflections.map((r, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: var(--bg-main); border-radius: 14px; font-style: italic; font-size: 13px; margin-bottom: 10px; border-left: 3px solid #8B5CF6;">
          <span style="color: var(--text-dark); flex: 1; margin-right: 10px;">"${r}"</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #6D28D9;" onclick="MindVaultApp.openEditTopicModal('reflection', ${idx})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #DC2626;" onclick="MindVaultApp.deleteTopicReflection(${idx})">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  },

  openAddTopicModal() {
    const titleEl = document.getElementById('modal-add-topic-header-title');
    if (titleEl) titleEl.innerText = '💡 Tambah Topik / Renungan Hubungan';
    const indexEl = document.getElementById('edit-topic-index');
    if (indexEl) indexEl.value = '';
    const catEl = document.getElementById('edit-topic-category');
    if (catEl) catEl.value = '';
    const btnEl = document.getElementById('btn-save-topic');
    if (btnEl) btnEl.innerText = 'Simpan ke RAG Database 🚀';

    const textarea = document.getElementById('add-topic-content');
    if (textarea) textarea.value = '';

    const modal = document.getElementById('modal-add-topic');
    if (modal) modal.classList.add('active');
  },

  openEditTopicModal(category, idx) {
    const { starters, reflections } = this.getLiveTopicsContext();
    const text = category === 'starter' ? starters[idx] : reflections[idx];
    if (text === undefined) {
      this.showToast('Item tidak ditemukan.', 'warning');
      return;
    }

    const titleEl = document.getElementById('modal-add-topic-header-title');
    if (titleEl) titleEl.innerText = `✏️ Edit ${category === 'starter' ? 'Pemantik Obrolan' : 'Renungan Hubungan'}`;

    const indexEl = document.getElementById('edit-topic-index');
    if (indexEl) indexEl.value = idx;
    const catEl = document.getElementById('edit-topic-category');
    if (catEl) catEl.value = category;

    const typeSelect = document.getElementById('add-topic-type');
    if (typeSelect) typeSelect.value = category;

    const textarea = document.getElementById('add-topic-content');
    if (textarea) textarea.value = text;

    const btnEl = document.getElementById('btn-save-topic');
    if (btnEl) btnEl.innerText = 'Update Topik RAG ✏️';

    const modal = document.getElementById('modal-add-topic');
    if (modal) modal.classList.add('active');
  },

  saveTopicFromModal() {
    const editIndex = document.getElementById('edit-topic-index')?.value;
    const editCat = document.getElementById('edit-topic-category')?.value;
    const type = document.getElementById('add-topic-type')?.value || 'starter';
    const content = document.getElementById('add-topic-content')?.value?.trim();

    if (!content) {
      this.showToast('Mohon isi konten topik / renungan.', 'warning');
      return;
    }

    let { starters, reflections } = this.getLiveTopicsContext();

    if (editIndex !== undefined && editIndex !== '') {
      const idx = parseInt(editIndex, 10);
      if (editCat === 'starter' || type === 'starter') {
        if (starters[idx] !== undefined) starters[idx] = content;
        else starters.unshift(content);
        localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(starters));
        MindVaultData.todaysTopics = starters;
        this.showToast('Pemantik obrolan berhasil diperbarui! ✏️✨', 'success');
      } else {
        if (reflections[idx] !== undefined) reflections[idx] = content;
        else reflections.unshift(content);
        localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
        MindVaultData.todaysThoughts = reflections;
        this.showToast('Renungan hubungan berhasil diperbarui! ✏️🧠', 'success');
      }
    } else {
      if (type === 'starter') {
        starters.unshift(content);
        localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(starters));
        MindVaultData.todaysTopics = starters;
        this.showToast('Pemantik obrolan baru tersimpan ke RAG Database! 💡✨', 'success');
      } else {
        reflections.unshift(content);
        localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
        MindVaultData.todaysThoughts = reflections;
        this.showToast('Renungan hubungan baru tersimpan ke RAG Database! 📝🧠', 'success');
      }
    }

    const modal = document.getElementById('modal-add-topic');
    if (modal) modal.classList.remove('active');
    const textarea = document.getElementById('add-topic-content');
    if (textarea) textarea.value = '';

    this.renderTopicsPage();
  },

  deleteTopicStarter(idx) {
    const { starters } = this.getLiveTopicsContext();
    starters.splice(idx, 1);
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_STARTERS', JSON.stringify(starters));
    this.renderTopicsPage();
  },

  deleteTopicReflection(idx) {
    const { reflections } = this.getLiveTopicsContext();
    reflections.splice(idx, 1);
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
    this.renderTopicsPage();
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
    log.innerHTML += `<div class="chat-bubble ai" id="${typingId}"><em>Menganalisis memori percakapan & RAG database... ✨</em></div>`;
    log.scrollTop = log.scrollHeight;

    const liveDiaries = this.getLiveDiariesContext();
    const liveTopics = this.getLiveTopicsContext();

    // Call Gemini / Smart Local Relationship Assistant with Full RAG Engine
    let response = await MindVaultGemini.chatWithAssistant(
      msg, 
      MindVaultData.friends, 
      liveDiaries,
      MindVaultData.dailyJournals,
      this.selectedFriendId,
      liveTopics
    );
    
    const typingEl = document.getElementById(typingId);

    if (response && response.error) {
      const fallbackMsg = MindVaultGemini.localSmartAnalysisFallback(
        msg, 
        MindVaultData.friends, 
        liveDiaries, 
        MindVaultData.dailyJournals,
        liveTopics
      );
      if (typingEl) typingEl.innerHTML = typeof fallbackMsg === 'string' ? fallbackMsg.replace(/\n/g, '<br>') : fallbackMsg;
      log.scrollTop = log.scrollHeight;
      return;
    }

    const formattedText = typeof response === 'string' ? response.replace(/\n/g, '<br>') : JSON.stringify(response);
    if (typingEl) typingEl.innerHTML = formattedText;
    log.scrollTop = log.scrollHeight;
  },

  bindModals() {
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    let iconHtml = '✨';
    if (type === 'success') iconHtml = '🎉';
    else if (type === 'error') iconHtml = '❌';
    else if (type === 'warning') iconHtml = '⚠️';
    else if (type === 'info') iconHtml = '💡';

    toast.innerHTML = `
      <div class="toast-icon">${iconHtml}</div>
      <div class="toast-content">${message}</div>
      <i class="fa-solid fa-xmark toast-close" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  },

  updateFriendsCountBadge() {
    const badge = document.getElementById('nav-friends-count');
    if (!badge) return;
    const count = MindVaultData.friends ? MindVaultData.friends.length : 0;
    badge.innerText = count;
  },

  saveUserProfileSettings() {
    const name = document.getElementById('user-setting-name')?.value.trim();
    const email = document.getElementById('user-setting-email')?.value.trim();
    const quote = document.getElementById('user-setting-quote')?.value.trim();

    if (name) {
      MindVaultData.user.name = name;
      if (this.currentUser) this.currentUser.name = name;
      const nameEl = document.getElementById('sidebar-user-name');
      if (nameEl) nameEl.innerText = name;
    }
    if (email) MindVaultData.user.email = email;
    if (quote) MindVaultData.user.quote = quote;

    localStorage.setItem('MINDVAULT_USER_PROFILE', JSON.stringify(MindVaultData.user));
    this.showToast('User profile settings updated! ✨', 'success');
  },

  clearLocalCache() {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data offline lokal? (Data di Supabase tidak akan terhapus)')) {
      localStorage.removeItem('MINDVAULT_LOCAL_FRIENDS');
      localStorage.removeItem('MINDVAULT_LOCAL_DIARIES');
      localStorage.removeItem('MINDVAULT_LOCAL_REMINDERS');
      localStorage.removeItem('MINDVAULT_LOCAL_DAILY_JOURNALS');
      MindVaultData.friends = [];
      MindVaultData.diaries = [];
      MindVaultData.dailyJournals = [];
      MindVaultData.reminders = [];
      this.renderFriendsGrid();
      this.renderDiariesList();
      this.renderDailyJournalsList();
      this.renderRemindersList();
      this.updateFriendsCountBadge();
      this.showToast('Local offline data cleared successfully.', 'info');
    }
  },

  renderDailyJournalsList() {
    const container = document.getElementById('daily-journals-list');
    if (!container) return;

    const local = localStorage.getItem('MINDVAULT_LOCAL_DAILY_JOURNALS');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) MindVaultData.dailyJournals = parsed;
      } catch (e) {}
    }

    const journals = MindVaultData.dailyJournals || [];
    if (journals.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada jurnal harian. Klik <strong>Refleksi Harian</strong> untuk menulis jurnal pertama Anda hari ini!</p>
        </div>`;
      return;
    }

    container.innerHTML = journals.map(j => `
      <div class="glass-card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">📝</span>
            <div>
              <h4 style="font-size: 16px; font-weight: 700;">${j.title}</h4>
              <span style="font-size: 12px; color: var(--text-muted);">${j.date} • Mood: <strong>${j.mood || 'Reflective'}</strong></span>
            </div>
          </div>
          <span style="font-size: 11px; font-weight: 700; background: #ECFDF5; color: #059669; padding: 4px 12px; border-radius: 14px;">Refleksi Diri</span>
        </div>
        <p style="font-size: 13.5px; color: var(--text-dark); line-height: 1.6; margin-bottom: 12px;">${j.content}</p>
        ${j.gratitude ? `
          <div style="padding: 10px 14px; background: rgba(248, 187, 217, 0.15); border-radius: 12px; font-size: 12.5px; color: var(--accent-hover);">
            🙏 <strong>Hal yang Disyukuri:</strong> ${j.gratitude}
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  async saveNewDailyJournal() {
    const title = document.getElementById('add-daily-title')?.value.trim();
    const date = document.getElementById('add-daily-date')?.value || new Date().toISOString().split('T')[0];
    const mood = document.getElementById('add-daily-mood')?.value;
    const content = document.getElementById('add-daily-content')?.value.trim();
    const gratitude = document.getElementById('add-daily-gratitude')?.value.trim();

    if (!title || !content) {
      this.showToast('Mohon isi Judul dan Isi Jurnal Harian.', 'warning');
      return;
    }

    const newJournal = {
      id: Date.now(),
      title,
      date,
      mood,
      content,
      gratitude
    };

    if (!MindVaultData.dailyJournals) MindVaultData.dailyJournals = [];
    MindVaultData.dailyJournals.unshift(newJournal);
    localStorage.setItem('MINDVAULT_LOCAL_DAILY_JOURNALS', JSON.stringify(MindVaultData.dailyJournals));

    this.showToast('Jurnal Harian berhasil disimpan! 📝✨', 'success');
    document.getElementById('modal-add-daily-journal')?.classList.remove('active');

    // Clear form inputs
    if (document.getElementById('add-daily-title')) document.getElementById('add-daily-title').value = '';
    if (document.getElementById('add-daily-content')) document.getElementById('add-daily-content').value = '';
    if (document.getElementById('add-daily-gratitude')) document.getElementById('add-daily-gratitude').value = '';

    this.switchDiaryTab('daily');
    this.renderDashboard();
  },

  switchDiaryTab(tabName) {
    const memoriesBtn = document.getElementById('tab-btn-memories');
    const dailyBtn = document.getElementById('tab-btn-daily');
    const dreamBtn = document.getElementById('tab-btn-dream');

    const memoriesContent = document.getElementById('diary-tab-memories-content');
    const dailyContent = document.getElementById('diary-tab-daily-content');
    const dreamContent = document.getElementById('diary-tab-dream-content');

    if (memoriesBtn) memoriesBtn.classList.toggle('active', tabName === 'memories');
    if (dailyBtn) dailyBtn.classList.toggle('active', tabName === 'daily');
    if (dreamBtn) dreamBtn.classList.toggle('active', tabName === 'dream');

    if (memoriesContent) memoriesContent.style.display = tabName === 'memories' ? 'block' : 'none';
    if (dailyContent) dailyContent.style.display = tabName === 'daily' ? 'block' : 'none';
    if (dreamContent) dreamContent.style.display = tabName === 'dream' ? 'block' : 'none';

    if (tabName === 'dream') {
      this.renderDreamJournalsList();
    }
  },

  openAddDreamModal() {
    const titleEl = document.getElementById('modal-add-dream-header-title');
    if (titleEl) titleEl.innerText = '🌙 Log Alur Cerita Mimpi';
    const editIdEl = document.getElementById('edit-dream-id');
    if (editIdEl) editIdEl.value = '';
    const btnEl = document.getElementById('btn-save-dream');
    if (btnEl) btnEl.innerText = 'Save Dream Log 🌙';

    const titleInput = document.getElementById('add-dream-title');
    const dateInput = document.getElementById('add-dream-date');
    const typeSelect = document.getElementById('add-dream-type');
    const charsInput = document.getElementById('add-dream-characters');
    const contentInput = document.getElementById('add-dream-content');
    const reflectInput = document.getElementById('add-dream-reflection');

    if (titleInput) titleInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (typeSelect) typeSelect.selectedIndex = 0;
    if (charsInput) charsInput.value = '';
    if (contentInput) contentInput.value = '';
    if (reflectInput) reflectInput.value = '';

    document.getElementById('modal-add-dream-journal')?.classList.add('active');
  },

  openEditDreamModal(dreamId) {
    const dreams = this.getDreamJournals();
    const dream = dreams.find(d => String(d.id) === String(dreamId));
    if (!dream) {
      this.showToast('Dream log not found.', 'warning');
      return;
    }

    const titleEl = document.getElementById('modal-add-dream-header-title');
    if (titleEl) titleEl.innerText = `✏️ Edit Cerita Mimpi: ${dream.title}`;
    const editIdEl = document.getElementById('edit-dream-id');
    if (editIdEl) editIdEl.value = dream.id;
    const btnEl = document.getElementById('btn-save-dream');
    if (btnEl) btnEl.innerText = 'Update Dream Log 🌙';

    const titleInput = document.getElementById('add-dream-title');
    const dateInput = document.getElementById('add-dream-date');
    const typeSelect = document.getElementById('add-dream-type');
    const charsInput = document.getElementById('add-dream-characters');
    const contentInput = document.getElementById('add-dream-content');
    const reflectInput = document.getElementById('add-dream-reflection');

    if (titleInput) titleInput.value = dream.title || '';
    if (dateInput) dateInput.value = dream.date || new Date().toISOString().split('T')[0];
    if (typeSelect && dream.type) typeSelect.value = dream.type;
    if (charsInput) charsInput.value = dream.characters || '';
    if (contentInput) contentInput.value = dream.content || '';
    if (reflectInput) reflectInput.value = dream.reflection || '';

    document.getElementById('modal-add-dream-journal')?.classList.add('active');
  },

  getDreamJournals() {
    if (!MindVaultData.dreamJournals) {
      let stored = [];
      try {
        stored = JSON.parse(localStorage.getItem('MINDVAULT_DREAM_JOURNALS') || '[]');
      } catch (e) {}

      if (stored.length === 0) {
        stored = [
          {
            id: 1,
            title: 'Terbang di Atas Kota Kaca & Bertemu Kucing Bicara',
            date: new Date().toISOString().split('T')[0],
            type: '🌌 Lucid Dream (Sadar Sedang Bermimpi)',
            characters: 'Ethan, Kucing Putih',
            content: 'Saya bermimpi sedang berjalan di atas jembatan kaca raksasa melayang di atas awan. Di tengah jembatan ada kucing putih besar yang memberi petunjuk jalan...',
            reflection: 'Bangun dengan perasaan takjub dan penasaran.'
          }
        ];
        localStorage.setItem('MINDVAULT_DREAM_JOURNALS', JSON.stringify(stored));
      }
      MindVaultData.dreamJournals = stored;
    }
    return MindVaultData.dreamJournals;
  },

  saveDreamFromModal() {
    const editId = document.getElementById('edit-dream-id')?.value;
    if (editId) {
      this.saveEditedDream(editId);
    } else {
      this.saveNewDream();
    }
  },

  saveNewDream() {
    const title = document.getElementById('add-dream-title')?.value.trim();
    const date = document.getElementById('add-dream-date')?.value || new Date().toISOString().split('T')[0];
    const type = document.getElementById('add-dream-type')?.value || '🌌 Lucid Dream';
    const characters = document.getElementById('add-dream-characters')?.value.trim() || '-';
    const content = document.getElementById('add-dream-content')?.value.trim();
    const reflection = document.getElementById('add-dream-reflection')?.value.trim() || '';

    if (!title || !content) {
      this.showToast('Mohon isi Judul dan Alur Cerita Mimpi.', 'warning');
      return;
    }

    const dreams = this.getDreamJournals();
    const newDream = {
      id: Date.now(),
      title,
      date,
      type,
      characters,
      content,
      reflection
    };

    dreams.unshift(newDream);
    localStorage.setItem('MINDVAULT_DREAM_JOURNALS', JSON.stringify(dreams));
    this.showToast('Cerita mimpi berhasil disimpan! 🌙✨', 'success');
    document.getElementById('modal-add-dream-journal')?.classList.remove('active');

    this.switchDiaryTab('dream');
    this.renderDreamJournalsList();
  },

  saveEditedDream(dreamId) {
    const title = document.getElementById('add-dream-title')?.value.trim();
    const date = document.getElementById('add-dream-date')?.value || new Date().toISOString().split('T')[0];
    const type = document.getElementById('add-dream-type')?.value || '🌌 Lucid Dream';
    const characters = document.getElementById('add-dream-characters')?.value.trim() || '-';
    const content = document.getElementById('add-dream-content')?.value.trim();
    const reflection = document.getElementById('add-dream-reflection')?.value.trim() || '';

    if (!title || !content) {
      this.showToast('Mohon isi Judul dan Alur Cerita Mimpi.', 'warning');
      return;
    }

    const dreams = this.getDreamJournals();
    const idx = dreams.findIndex(d => String(d.id) === String(dreamId));
    if (idx === -1) {
      this.showToast('Dream log not found.', 'error');
      return;
    }

    dreams[idx] = {
      ...dreams[idx],
      title,
      date,
      type,
      characters,
      content,
      reflection
    };

    localStorage.setItem('MINDVAULT_DREAM_JOURNALS', JSON.stringify(dreams));
    this.showToast(`Cerita mimpi "${title}" berhasil diperbarui! ✏️🌙`, 'success');
    document.getElementById('modal-add-dream-journal')?.classList.remove('active');

    this.switchDiaryTab('dream');
    this.renderDreamJournalsList();
  },

  deleteDream(dreamId) {
    if (!confirm('Apakah Anda yakin ingin menghapus cerita mimpi ini?')) return;

    let dreams = this.getDreamJournals();
    dreams = dreams.filter(d => String(d.id) !== String(dreamId));
    MindVaultData.dreamJournals = dreams;
    localStorage.setItem('MINDVAULT_DREAM_JOURNALS', JSON.stringify(dreams));

    this.showToast('Catatan cerita mimpi berhasil dihapus! 🗑️', 'info');
    this.renderDreamJournalsList();
  },

  renderDreamJournalsList() {
    const container = document.getElementById('dream-journals-list');
    if (!container) return;

    const dreams = this.getDreamJournals();

    if (dreams.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada alur cerita mimpi yang dicatat. Klik <strong>Log Cerita Mimpi 🌙</strong> untuk mencatat mimpi pertamamu!</p>
        </div>`;
      return;
    }

    container.innerHTML = dreams.map(dream => `
      <div class="glass-card" style="margin-bottom: 16px; background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(243,232,255,0.6) 100%); border: 1px solid rgba(139,92,246,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">🌙</span>
            <div>
              <h4 style="font-size: 16px; font-weight: 800; color: #5B21B6;">${dream.title}</h4>
              <span style="font-size: 12px; color: var(--text-muted);">Tokoh: <strong>${dream.characters || 'Self'}</strong></span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; font-weight: 700; background: rgba(139,92,246,0.15); color: #6D28D9; padding: 4px 12px; border-radius: 14px;">${dream.type || '🌌 Dream'}</span>
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">📅 ${dream.date}</span>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="MindVaultApp.openEditDreamModal('${dream.id}')">
              <i class="fa-solid fa-pen-to-square" style="color: #6D28D9;"></i> Edit
            </button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; color: #DC2626; border-color: rgba(220,38,38,0.2);" onclick="MindVaultApp.deleteDream('${dream.id}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <p style="font-size: 13px; color: var(--text-medium); line-height: 1.6; margin-bottom: 12px; white-space: pre-line;">${dream.content}</p>

        ${dream.reflection ? `
          <div style="padding: 8px 12px; background: rgba(255,255,255,0.7); border-radius: 10px; border-left: 3px solid #8B5CF6; font-size: 12px; color: #4C1D95;">
            💭 <strong>Refleksi Saat Terbangun:</strong> ${dream.reflection}
          </div>
        ` : ''}
      </div>
    `).join('');
  }
};

// Global Window Aliases
window.MindVaultApp = MindVaultApp;
window.openAddTopicModal = () => MindVaultApp.openAddTopicModal();
window.openEditTopicModal = (cat, idx) => MindVaultApp.openEditTopicModal(cat, idx);
window.saveTopicFromModal = () => MindVaultApp.saveTopicFromModal();
window.deleteTopicStarter = (idx) => MindVaultApp.deleteTopicStarter(idx);
window.deleteTopicReflection = (idx) => MindVaultApp.deleteTopicReflection(idx);
window.openAddDiaryModal = () => MindVaultApp.openAddDiaryModal();
window.saveDiaryFromModal = () => MindVaultApp.saveDiaryFromModal();
window.openAddDreamModal = () => MindVaultApp.openAddDreamModal();
window.saveDreamFromModal = () => MindVaultApp.saveDreamFromModal();
window.handleLogout = () => MindVaultApp.handleLogout();
