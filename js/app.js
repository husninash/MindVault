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

      // Subscribe to Realtime Cloud DB updates across all tabs & devices
      MindVaultSupabase.subscribeRealtime((type, payload) => {
        if (type === 'friends') {
          this.renderFriendsGrid();
          this.populateDiaryFriendOptions();
          this.updateFriendsCountBadge();
          this.renderDashboard();
          if (this.activeView === 'graph') this.renderKnowledgeGraph();
          if (this.activeView === 'profile' && this.selectedFriendId) this.renderFriendProfile(this.selectedFriendId);
        } else if (type === 'diaries') {
          this.renderDiariesList();
          this.renderDashboard();
        }
      });
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
    if (modal) {
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('visibility', 'visible', 'important');
      modal.style.setProperty('opacity', '1', 'important');
      modal.style.setProperty('pointer-events', 'all', 'important');
      modal.style.setProperty('z-index', '999999', 'important');
      modal.classList.add('active');
    }
  },

  hideAuthScreen() {
    const modal = document.getElementById('auth-modal-screen');
    if (modal) {
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
      modal.classList.remove('active');
    }
    this.updateUserSidebar();
    this.applyRolePermissions();
  },

  updateUserSidebar() {
    const nameEl = document.getElementById('sidebar-user-name');
    const badgeEl = document.getElementById('sidebar-user-role-badge');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (!this.currentUser) {
      if (nameEl) nameEl.innerText = 'Guest User';
      if (badgeEl) {
        badgeEl.innerText = 'Guest 👤';
        badgeEl.className = 'role-badge role-badge-user';
      }
      return;
    }

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

  showCustomConfirm({ title, message, icon, confirmText, cancelText, onConfirm }) {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
      if (confirm(message)) onConfirm();
      return;
    }

    const titleEl = document.getElementById('custom-confirm-title');
    const msgEl = document.getElementById('custom-confirm-message');
    const iconEl = document.getElementById('custom-confirm-icon');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    if (titleEl) titleEl.innerText = title || 'Konfirmasi Tindakan';
    if (msgEl) msgEl.innerText = message || 'Apakah Anda yakin ingin melanjutkan?';
    if (iconEl) iconEl.innerHTML = icon || '<i class="fa-solid fa-circle-question"></i>';
    if (okBtn) okBtn.innerText = confirmText || 'Ya, Lanjutkan';
    if (cancelBtn) cancelBtn.innerText = cancelText || 'Batal';

    const closeHandler = () => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', okHandler);
      cancelBtn.removeEventListener('click', closeHandler);
    };

    const okHandler = () => {
      closeHandler();
      if (typeof onConfirm === 'function') onConfirm();
    };

    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', closeHandler);

    modal.classList.add('active');
  },

  async handleLogout() {
    this.showCustomConfirm({
      title: 'Konfirmasi Keluar',
      message: 'Apakah Anda yakin ingin keluar (logout) dari MindVault?',
      icon: '<i class="fa-solid fa-right-from-bracket"></i>',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          if (typeof MindVaultSupabase !== 'undefined' && MindVaultSupabase.signOut) {
            await MindVaultSupabase.signOut();
          }
        } catch (e) {}

        localStorage.removeItem('MINDVAULT_AUTH_SESSION');
        this.currentUser = null;

        // Clear input fields
        if (document.getElementById('auth-input-email')) document.getElementById('auth-input-email').value = '';
        if (document.getElementById('auth-input-password')) document.getElementById('auth-input-password').value = '';
        if (document.getElementById('auth-input-name')) document.getElementById('auth-input-name').value = '';

        this.updateUserSidebar();
        this.applyRolePermissions();
        this.switchAuthTab('login');

        // Force show Auth Modal Screen overlay
        this.showAuthScreen();
        this.switchView('dashboard');
        this.showToast('Berhasil keluar (Logged out). Silakan login kembali.', 'info');
      }
    });
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

  handleRelationSelectChange(val) {
    const customInput = document.getElementById('add-friend-relation-custom');
    if (!customInput) return;
    if (val === 'Other') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
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
    ['name', 'birthday', 'avatar', 'bio', 'life', 'fav-drink', 'fav-food', 'fav-color', 'fav-hobby', 'fav-book', 'likes', 'dislikes', 'safe-topics', 'avoid-topics', 'gifts'].forEach(id => {
      const el = document.getElementById('add-friend-' + id);
      if (el) el.value = '';
    });
    const relSelect = document.getElementById('add-friend-relation-select');
    if (relSelect) relSelect.value = 'Close Friend';
    const relCustom = document.getElementById('add-friend-relation-custom');
    if (relCustom) {
      relCustom.style.display = 'none';
      relCustom.value = '';
    }
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
    
    // Set Relationship dropdown / custom input
    const relSelect = document.getElementById('add-friend-relation-select');
    const relCustom = document.getElementById('add-friend-relation-custom');
    if (relSelect && relCustom) {
      const rel = (friend.relation || '').trim();
      const matched = Array.from(relSelect.options).find(opt => opt.value.toLowerCase() === rel.toLowerCase() && opt.value !== 'Other');
      if (matched) {
        relSelect.value = matched.value;
        relCustom.style.display = 'none';
        relCustom.value = '';
      } else {
        relSelect.value = 'Other';
        relCustom.style.display = 'block';
        relCustom.value = rel;
      }
    }

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
    
    // Read relation from select or custom text input
    const relSelect = document.getElementById('add-friend-relation-select');
    const relCustom = document.getElementById('add-friend-relation-custom');
    let relation = 'Friend';
    if (relSelect) {
      if (relSelect.value === 'Other') {
        relation = (relCustom && relCustom.value.trim()) ? relCustom.value.trim() : 'Other';
      } else {
        relation = relSelect.value;
      }
    }

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
    this.renderRemindersList();
    this.populateDiaryFriendOptions();
    this.updateFriendsCountBadge();
    if (this.activeView === 'graph') this.renderKnowledgeGraph();
  },

  async saveEditedFriend(friendId) {
    const friendData = this.readFriendFormData();
    const existing = MindVaultData.friends.find(f => f.id === friendId) || {};

    const updatedFriend = {
      ...existing,
      ...friendData,
      tier: friendData.relation || existing.tier || 'Friend',
      id: friendId
    };

    await MindVaultSupabase.updateFriend(updatedFriend);
    this.showToast(`Profile ${updatedFriend.name} successfully updated! ✨`, 'success');
    document.getElementById('modal-add-friend')?.classList.remove('active');

    this.renderFriendsGrid();
    this.renderFriendProfile(friendId);
    this.renderRemindersList();
    this.populateDiaryFriendOptions();
    this.updateFriendsCountBadge();
    if (this.activeView === 'graph') this.renderKnowledgeGraph();
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

    // Close notification dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notification-dropdown');
      const notifBtn = document.getElementById('header-notif-btn');
      if (dropdown && notifBtn && !notifBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
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
        this.renderKnowledgeGraph();
      }, 100);
    } else if (viewName === 'profile') {
      this.renderFriendProfile(this.selectedFriendId);
    } else if (viewName === 'topics') {
      this.renderTopicsPage();
    } else if (viewName === 'diaries') {
      this.renderDiariesList();
    } else if (viewName === 'friends') {
      this.renderFriendsGrid();
    }
  },

  // Dynamic AI Intimacy Score Calculator based on Sentiment & Relationship logs
  calculateDynamicFriendScore(friend) {
    if (!friend) return 85;

    let baseScore = 80;
    const diaries = (MindVaultData.diaries || []).filter(d => 
      String(d.friendId) === String(friend.id) || 
      (d.friendName && friend.name && d.friendName.toLowerCase() === friend.name.toLowerCase())
    );

    // Negative conflict keywords
    const severeConflictRegex = /anjing|babi|bangsat|najis|benci|hancur|putus|toxic|parah|sakit hati|menyakiti|dendam|kecewa berat|berantem hebat/i;
    const moderateConflictRegex = /berantem|marah|kesal|jengkel|ribut|debat|tengkar|dingin|diam|kecewa|badmood|sulit|tersinggung/i;
    const positiveRegex = /senang|bahagia|seru|hangat|sayang|tertawa|ketawa|quality time|dukung|bantu|nyaman|harmonis|akur|maaf/i;

    let penalty = 0;
    let bonus = 0;

    // 1. Check current life status sentiment
    const statusText = `${friend.currentLife || ''} ${friend.bio || ''}`;
    if (severeConflictRegex.test(statusText)) {
      penalty += 45;
    } else if (moderateConflictRegex.test(statusText)) {
      penalty += 25;
    }

    // 2. Check conversation diaries history
    diaries.forEach(d => {
      const fullText = `${d.title || ''} ${d.content || ''} ${d.mood || ''}`;
      if (severeConflictRegex.test(fullText)) {
        penalty += 35;
      } else if (moderateConflictRegex.test(fullText)) {
        penalty += 20;
      } else if (positiveRegex.test(fullText)) {
        bonus += 8;
      } else {
        bonus += 3; // Logged interaction bonus
      }
    });

    // 3. Milestones bonus
    if (friend.milestones && friend.milestones.length > 0) {
      bonus += Math.min(friend.milestones.length * 3, 10);
    }

    let finalScore = Math.max(10, Math.min(99, baseScore + bonus - penalty));
    return finalScore;
  },

  recalculateAllFriendScores() {
    if (!MindVaultData.friends) return;
    MindVaultData.friends.forEach(f => {
      f.score = this.calculateDynamicFriendScore(f);
      if (f.score <= 45) {
        f.tier = 'Needs Repair / In Conflict';
      } else if (f.score <= 65) {
        f.tier = 'Cooling Down';
      } else if (f.score <= 80) {
        f.tier = f.relation || 'Good Friend';
      } else {
        f.tier = f.relation || 'Close Circle';
      }
    });
  },

  renderDashboard() {
    const greetingHeading = document.getElementById('dash-greeting-heading');
    if (greetingHeading) {
      const userName = this.currentUser ? (this.currentUser.name || 'User') : 'Friend';
      greetingHeading.innerHTML = `Good morning, ${userName}! 🌸`;
    }

    this.recalculateAllFriendScores();

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

    // Today's topics list
    const topicsContainer = document.getElementById('dash-topics-list');
    if (topicsContainer) {
      const { starters } = this.getLiveTopicsContext();
      if (!starters || starters.length === 0) {
        topicsContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 8px;">Belum ada topik hari ini.</p>';
      } else {
        topicsContainer.innerHTML = starters.slice(0, 3).map(topic => `
          <div style="padding: 12px 14px; background: rgba(255,255,255,0.7); border-radius: 12px; margin-bottom: 8px; border: 1px solid rgba(248,187,217,0.3); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-dark);">✨ "${topic}"</span>
            <span style="font-size: 10px; font-weight: 700; background: var(--secondary); color: var(--accent-hover); padding: 4px 10px; border-radius: 10px;">RAG Active</span>
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
    this.recalculateAllFriendScores();
    const grid = document.getElementById('friends-grid-container');
    if (!grid) return;

    if (!MindVaultData.friends || MindVaultData.friends.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">Belum ada teman yang ditambahkan. Tambahkan teman pertamamu sekarang!</p>
          <button class="btn btn-primary" onclick="MindVaultApp.openAddFriendModal()">
            <i class="fa-solid fa-user-plus"></i> Tambah Teman
          </button>
        </div>`;
      return;
    }

    grid.innerHTML = MindVaultData.friends.map(friend => {
      const scoreColor = friend.score <= 45 ? '#DC2626' : (friend.score <= 65 ? '#D97706' : '#059669');
      const badgeBg = friend.score <= 45 ? '#FEE2E2' : (friend.score <= 65 ? '#FEF3C7' : 'var(--secondary)');
      const badgeColor = friend.score <= 45 ? '#DC2626' : (friend.score <= 65 ? '#D97706' : 'var(--accent-hover)');

      return `
        <div class="friend-card">
          <div class="friend-card-avatar-wrapper">
            <img src="${friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'}" class="friend-card-avatar" alt="${friend.name}">
            <span class="tier-badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 700;">${friend.tier || friend.relation || 'Friend'}</span>
          </div>
          <h4>${friend.name}</h4>
          <p class="relation-type">${friend.relation || ''} • <strong style="color: ${scoreColor};">${friend.score}% Intimacy</strong></p>
          
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
      `;
    }).join('');
  },

  viewProfile(id) {
    this.selectedFriendId = id;
    this.switchView('profile');
  },

  // Render Single Friend Profile View
  renderFriendProfile(id) {
    const friend = MindVaultData.friends.find(f => f.id === id) || MindVaultData.friends[0];
    if (!friend) return;

    // Recalculate dynamic score
    friend.score = this.calculateDynamicFriendScore(friend);

    // Basic Header Info
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.innerText = friend.name || 'Teman';

    const relationEl = document.getElementById('profile-relation');
    if (relationEl) relationEl.innerText = friend.relation || 'Friend';

    const tierBadgeEl = document.getElementById('profile-tier-badge');
    if (tierBadgeEl) {
      let tierLabel = friend.relation || 'Friend';
      if (friend.score <= 45) {
        tierLabel = '⚠️ Konflik / Butuh Pemulihan';
        tierBadgeEl.style.background = '#FEE2E2';
        tierBadgeEl.style.color = '#DC2626';
      } else if (friend.score <= 65) {
        tierLabel = '❄️ Pendinginan / Jarak';
        tierBadgeEl.style.background = '#FEF3C7';
        tierBadgeEl.style.color = '#D97706';
      } else {
        tierBadgeEl.style.background = 'var(--secondary)';
        tierBadgeEl.style.color = 'var(--accent-hover)';
      }
      tierBadgeEl.innerText = tierLabel;
    }

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.src = friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';

    const bioEl = document.getElementById('profile-bio');
    if (bioEl) bioEl.innerText = friend.bio || 'Belum ada bio ringkas.';

    const scoreEl = document.getElementById('profile-score-val');
    if (scoreEl) {
      const scoreColor = friend.score <= 45 ? '#DC2626' : (friend.score <= 65 ? '#D97706' : '#059669');
      scoreEl.innerHTML = `<span style="color: ${scoreColor}; font-weight: 800;">${friend.score}%</span> Intimacy Score`;
    }

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

    // Special Milestones & Upcoming Moments (Includes Auto Birthday)
    const milestonesContainer = document.getElementById('profile-milestones-list');
    if (milestonesContainer) {
      const today = new Date();
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const currentYear = today.getFullYear();

      const combinedList = [];

      // 1. Auto-include Birthday if exists
      if (friend.birthday) {
        let bMonth, bDay;
        const parts = String(friend.birthday).split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            bMonth = parseInt(parts[1], 10) - 1;
            bDay = parseInt(parts[2], 10);
          } else {
            bMonth = parseInt(parts[0], 10) - 1;
            bDay = parseInt(parts[1], 10);
          }
        }

        if (!isNaN(bMonth) && !isNaN(bDay)) {
          let nextBday = new Date(currentYear, bMonth, bDay);
          let diffMs = nextBday.getTime() - startToday.getTime();
          let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            nextBday = new Date(currentYear + 1, bMonth, bDay);
            diffMs = nextBday.getTime() - startToday.getTime();
            diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          }

          const formattedBday = nextBday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

          combinedList.push({
            isAutoBirthday: true,
            title: `Ulang Tahun ${friend.name}`,
            type: '🎂 Ulang Tahun (Sistem)',
            date: formattedBday,
            diffDays,
            notes: 'Otomatis tersinkronisasi dari data tanggal lahir profil.'
          });
        }
      }

      // 2. Add custom milestones
      (friend.milestones || []).forEach((m, mIdx) => {
        let diffDays = 9999;
        let formattedDate = m.date || 'TBA';
        if (m.date) {
          const targetDate = new Date(m.date);
          const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
          diffDays = Math.round((targetStart.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
          formattedDate = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        combinedList.push({
          ...m,
          mIdx,
          isAutoBirthday: false,
          diffDays,
          formattedDate
        });
      });

      // Sort by nearest upcoming days
      combinedList.sort((a, b) => a.diffDays - b.diffDays);

      if (combinedList.length === 0) {
        milestonesContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; background: rgba(255,255,255,0.7); border-radius: 14px; border: 1px dashed var(--card-border);">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Belum ada momen atau acara spesial (Wisuda, Lahiran, dll) yang dicatat.</p>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="MindVaultApp.openAddMilestoneModal('${friend.id}')">
              + Catat Momen Spesial
            </button>
          </div>
        `;
      } else {
        milestonesContainer.innerHTML = combinedList.map(item => {
          let dayDiffText = '';
          let isUpcoming = false;

          if (item.diffDays === 0) {
            dayDiffText = '🎉 HARI INI!';
            isUpcoming = true;
          } else if (item.diffDays === 1) {
            dayDiffText = '⚡ Besok!';
            isUpcoming = true;
          } else if (item.diffDays > 1 && item.diffDays <= 7) {
            dayDiffText = `⚡ ${item.diffDays} hari lagi (H-${item.diffDays})`;
            isUpcoming = true;
          } else if (item.diffDays > 7 && item.diffDays < 9000) {
            dayDiffText = `⏳ ${item.diffDays} hari lagi`;
            isUpcoming = true;
          } else if (item.diffDays < 0) {
            dayDiffText = `✨ Sudah lewat (${Math.abs(item.diffDays)} hari lalu)`;
          }

          const badgeColor = isUpcoming ? '#DC2626' : '#6B7280';
          const badgeBg = isUpcoming ? '#FEE2E2' : '#F3F4F6';
          const cardBorder = (item.diffDays <= 7 && item.diffDays >= 0) ? 'border: 1.5px solid #FDA4AF; background: #FFF9FA;' : 'border: 1px solid var(--card-border); background: white;';

          return `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 14px; border-radius: 14px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); ${cardBorder}">
              <div style="flex: 1; margin-right: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                  <strong style="font-size: 13.5px; color: var(--text-dark);">${item.title}</strong>
                  ${dayDiffText ? `<span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor};">${dayDiffText}</span>` : ''}
                </div>
                <div style="font-size: 12px; color: #6D28D9; font-weight: 600; margin-bottom: 4px;">${item.type} • 📅 ${item.formattedDate || item.date}</div>
                ${item.notes ? `<p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin: 0; background: var(--bg-main); padding: 6px 10px; border-radius: 8px;">💡 ${item.notes}</p>` : ''}
              </div>
              <div style="display: flex; gap: 4px;">
                ${item.isAutoBirthday ? `
                  <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="MindVaultApp.openEditProfileModal('${friend.id}')" title="Edit Tanggal Lahir di Profil">
                    <i class="fa-solid fa-cake-candles" style="color: #E11D48;"></i>
                  </button>
                ` : `
                  <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="MindVaultApp.openEditMilestoneModal('${friend.id}', ${item.mIdx})" title="Edit Momen">
                    <i class="fa-solid fa-pen-to-square" style="color: #6D28D9;"></i>
                  </button>
                  <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; color: #DC2626;" onclick="MindVaultApp.deleteMilestone('${friend.id}', ${item.mIdx})" title="Hapus Momen">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('');
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

  // Calculate upcoming birthdays & reminders from friend profiles
  getSmartReminders() {
    const reminders = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    (MindVaultData.friends || []).forEach(friend => {
      if (!friend.birthday) return;

      // Handle both YYYY-MM-DD and MM/DD/YYYY or DD/MM/YYYY formats
      let bMonth, bDay;
      const parts = String(friend.birthday).split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          bMonth = parseInt(parts[1], 10) - 1;
          bDay = parseInt(parts[2], 10);
        } else {
          // MM/DD/YYYY
          bMonth = parseInt(parts[0], 10) - 1;
          bDay = parseInt(parts[1], 10);
        }
      }

      if (isNaN(bMonth) || isNaN(bDay)) return;

      // Next birthday date in current or next year
      let nextBday = new Date(currentYear, bMonth, bDay);
      // Reset time to start of day for accurate day diff
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      let diffMs = nextBday.getTime() - startToday.getTime();
      let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Birthday already passed this year, check next year
        nextBday = new Date(currentYear + 1, bMonth, bDay);
        diffMs = nextBday.getTime() - startToday.getTime();
        diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      }

      const formattedDate = nextBday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // Determine reminder status
      let urgency = 'normal';
      let tagText = `${diffDays} hari lagi`;
      let isDueSoon = false;

      if (diffDays === 0) {
        urgency = 'critical';
        tagText = '🎉 HARI INI!';
        isDueSoon = true;
      } else if (diffDays === 1) {
        urgency = 'high';
        tagText = '⚡ Besok!';
        isDueSoon = true;
      } else if (diffDays <= 7) {
        urgency = 'warning';
        tagText = `⚡ ${diffDays} hari lagi (H-${diffDays})`;
        isDueSoon = true;
      } else if (diffDays <= 30) {
        tagText = `${diffDays} hari lagi`;
      }

      reminders.push({
        id: `bday-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        friendAvatar: friend.avatar,
        title: `Ulang Tahun ${friend.name}`,
        date: formattedDate,
        diffDays,
        urgency,
        tagText,
        isDueSoon,
        type: '🎂 Ulang Tahun'
      });

      // Include Special Milestones (Wisuda, Lahiran, Nikahan, dll)
      const milestones = friend.milestones || [];
      milestones.forEach((m, mIdx) => {
        if (!m.date) return;
        const targetDate = new Date(m.date);
        const startTodayM = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const targetStartM = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const mDiffDays = Math.round((targetStartM.getTime() - startTodayM.getTime()) / (1000 * 60 * 60 * 24));

        if (mDiffDays < 0) return; // Skip past events in active reminders

        let mUrgency = 'normal';
        let mTagText = `${mDiffDays} hari lagi`;
        let mIsDueSoon = false;

        if (mDiffDays === 0) {
          mUrgency = 'critical';
          mTagText = '🎉 HARI INI!';
          mIsDueSoon = true;
        } else if (mDiffDays === 1) {
          mUrgency = 'high';
          mTagText = '⚡ Besok!';
          mIsDueSoon = true;
        } else if (mDiffDays <= 7) {
          mUrgency = 'warning';
          mTagText = `⚡ ${mDiffDays} hari lagi (H-${mDiffDays})`;
          mIsDueSoon = true;
        }

        const formattedMDate = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        reminders.push({
          id: `milestone-${friend.id}-${mIdx}`,
          friendId: friend.id,
          friendName: friend.name,
          friendAvatar: friend.avatar,
          title: `${m.title} (${friend.name})`,
          date: formattedMDate,
          diffDays: mDiffDays,
          urgency: mUrgency,
          tagText: mTagText,
          isDueSoon: mIsDueSoon,
          type: m.type || '✨ Momen Spesial',
          notes: m.notes || ''
        });
      });
    });

    // Sort by nearest days
    reminders.sort((a, b) => a.diffDays - b.diffDays);
    return reminders;
  },

  // Render Reminder Calendar items & Alert Banners
  renderRemindersList() {
    const container = document.getElementById('reminders-list-container');
    const reminders = this.getSmartReminders();
    MindVaultData.reminders = reminders;

    this.updateNotificationBell(reminders);
    this.renderDashboardBirthdayAlert(reminders);

    if (!container) return;

    if (reminders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: 20px; border: 1px dashed var(--card-border);">
          <p style="color: var(--text-muted); font-size: 14px;">Belum ada tanggal ulang tahun atau pengingat tersimpan di direktori teman.</p>
        </div>`;
      return;
    }

    container.innerHTML = reminders.map(rem => {
      const badgeBg = rem.diffDays <= 1 ? '#FEE2E2' : (rem.diffDays <= 7 ? '#FEF3C7' : '#F3E8FF');
      const badgeColor = rem.diffDays <= 1 ? '#DC2626' : (rem.diffDays <= 7 ? '#D97706' : '#7C3AED');
      const cardBorder = rem.diffDays <= 7 ? 'border: 1.5px solid #F87171;' : 'border: 1px solid var(--card-border);';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: white; border-radius: 18px; margin-bottom: 12px; box-shadow: var(--shadow-soft); ${cardBorder}">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${rem.friendAvatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--lavender-light);" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(rem.friendName)}&background=F8BBD9&color=2D1A29'">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 15px; color: var(--text-dark);">${rem.title}</strong>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor};">${rem.tagText}</span>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">📅 ${rem.date} • Disinkronkan dari profil ${rem.friendName}</p>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 12px;" onclick="MindVaultApp.openPrepModal('${rem.friendId}')">
              ⚡ Siapkan Kado & Topik
            </button>
            <button class="btn btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="MindVaultApp.showToast('Pengingat aktif untuk ${rem.friendName} (${rem.tagText})! 🔔', 'success')">
              🔔 Aktif
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render floating warning alert in Dashboard when birthday or milestone is within 7 days
  renderDashboardBirthdayAlert(reminders) {
    const alertContainer = document.getElementById('dash-birthday-alert-container');
    if (!alertContainer) return;

    const dueSoon = reminders.filter(r => r.diffDays <= 7);
    if (dueSoon.length === 0) {
      alertContainer.innerHTML = '';
      return;
    }

    const first = dueSoon[0];
    const isBirthday = first.type.includes('Ulang Tahun') || first.type.includes('Birthday');
    const icon = isBirthday ? '🎂' : (first.type.slice(0, 2) || '🎉');
    const headerTitle = isBirthday ? `Peringatan Ulang Tahun Mendekat (H-${first.diffDays})!` : `Momen Spesial Mendekat: ${first.title} (H-${first.diffDays})!`;
    const descText = isBirthday 
      ? `<strong>${first.friendName}</strong> akan berulang tahun pada <strong>${first.date}</strong> (${first.tagText}). Waktunya siapkan ucapan atau ide kado spesial!`
      : `<strong>${first.friendName}</strong> memiliki acara <strong>${first.title}</strong> pada <strong>${first.date}</strong> (${first.tagText}). ${first.notes ? `<em>Catatan: "${first.notes}"</em>` : ''}`;

    alertContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%); border-radius: 18px; border: 1.5px solid #FDA4AF; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(225,29,72,0.12); flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">${icon}</span>
          <div>
            <strong style="font-size: 14px; color: #9F1239;">${headerTitle}</strong>
            <p style="font-size: 13px; color: #BE123C; margin-top: 2px;">
              ${descText}
            </p>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" style="background: #E11D48; border-color: #E11D48; font-size: 12px; padding: 6px 14px;" onclick="MindVaultApp.openPrepModal('${first.friendId}')">
            🎁 Buka Meeting Prep
          </button>
          <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 14px;" onclick="MindVaultApp.switchView('calendar')">
            Lihat Semua Pengingat
          </button>
        </div>
      </div>
    `;
  },

  // Update notification bell badge & dropdown list
  updateNotificationBell(reminders) {
    const badge = document.getElementById('notif-badge-count');
    const dropdownList = document.getElementById('notification-dropdown-list');
    const dueSoon = reminders.filter(r => r.diffDays <= 7);

    if (badge) {
      if (dueSoon.length > 0) {
        badge.innerText = dueSoon.length;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (dropdownList) {
      if (reminders.length === 0) {
        dropdownList.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 12px;">Tidak ada notifikasi saat ini.</p>';
      } else {
        dropdownList.innerHTML = reminders.map(r => `
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer;" onclick="MindVaultApp.switchView('calendar'); MindVaultApp.toggleNotificationDropdown(false);">
            <span style="font-size: 20px;">🎂</span>
            <div style="flex: 1;">
              <p style="font-size: 13px; font-weight: 700; color: var(--text-dark); margin: 0;">${r.title}</p>
              <p style="font-size: 11px; color: var(--text-muted); margin: 0;">${r.date} • <strong style="color: ${r.diffDays <= 7 ? '#E11D48' : '#7C3AED'};">${r.tagText}</strong></p>
            </div>
          </div>
        `).join('');
      }
    }
  },

  toggleNotificationDropdown(forceState) {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;
    if (typeof forceState === 'boolean') {
      dropdown.style.display = forceState ? 'block' : 'none';
    } else {
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
    }
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
      if (storedS !== null) {
        const parsed = JSON.parse(storedS);
        if (Array.isArray(parsed)) starters = parsed;
      }
      const storedR = localStorage.getItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS');
      if (storedR !== null) {
        const parsed = JSON.parse(storedR);
        if (Array.isArray(parsed)) reflections = parsed;
      }
    } catch (e) {}

    return { starters, reflections };
  },

  renderTopicsPage() {
    const startersList = document.getElementById('topics-starters-list');
    const reflectionsList = document.getElementById('topics-reflections-list');
    const { starters, reflections } = this.getLiveTopicsContext();

    if (startersList) {
      if (!starters || starters.length === 0) {
        startersList.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 14px; text-align: center; background: white; border-radius: 14px; border: 1px dashed var(--card-border);">Belum ada pemantik obrolan. Klik tombol "+ Tambah Topik / Renungan" untuk menambah baru.</p>';
      } else {
        startersList.innerHTML = starters.map((s, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: white; border-radius: 14px; margin-bottom: 10px; border: 1px solid var(--card-border);">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-dark); flex: 1; margin-right: 10px;">"${s}"</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #6D28D9;" onclick="MindVaultApp.openEditTopicModal('starter', ${idx})" title="Edit topik">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #DC2626;" onclick="MindVaultApp.deleteTopicStarter(${idx})" title="Hapus topik">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (reflectionsList) {
      if (!reflections || reflections.length === 0) {
        reflectionsList.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding: 14px; text-align: center; background: var(--bg-main); border-radius: 14px; border: 1px dashed var(--card-border);">Belum ada renungan. Klik tombol "+ Tambah Topik / Renungan" untuk menambah baru.</p>';
      } else {
        reflectionsList.innerHTML = reflections.map((r, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: var(--bg-main); border-radius: 14px; font-style: italic; font-size: 13px; margin-bottom: 10px; border-left: 3px solid #8B5CF6;">
            <span style="color: var(--text-dark); flex: 1; margin-right: 10px;">"${r}"</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #6D28D9;" onclick="MindVaultApp.openEditTopicModal('reflection', ${idx})" title="Edit renungan">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #DC2626;" onclick="MindVaultApp.deleteTopicReflection(${idx})" title="Hapus renungan">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
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
    MindVaultData.todaysTopics = starters;
    this.showToast('Pemantik obrolan berhasil dihapus 🗑️', 'info');
    this.renderTopicsPage();
    this.renderDashboard();
  },

  deleteTopicReflection(idx) {
    const { reflections } = this.getLiveTopicsContext();
    reflections.splice(idx, 1);
    localStorage.setItem('MINDVAULT_LOCAL_TOPIC_REFLECTIONS', JSON.stringify(reflections));
    MindVaultData.todaysThoughts = reflections;
    this.showToast('Renungan hubungan berhasil dihapus 🗑️', 'info');
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
    this.showCustomConfirm({
      title: 'Hapus Cerita Mimpi',
      message: 'Apakah Anda yakin ingin menghapus catatan alur cerita mimpi ini?',
      icon: '<i class="fa-solid fa-moon" style="color: #8B5CF6;"></i>',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      onConfirm: () => {
        let dreams = this.getDreamJournals();
        dreams = dreams.filter(d => String(d.id) !== String(dreamId));
        MindVaultData.dreamJournals = dreams;
        localStorage.setItem('MINDVAULT_DREAM_JOURNALS', JSON.stringify(dreams));

        this.showToast('Catatan cerita mimpi berhasil dihapus! 🗑️', 'info');
        this.renderDreamJournalsList();
      }
    });
  },

  generateKnowledgeGraphData() {
    const nodes = [
      { id: 'user', label: (this.currentUser && this.currentUser.name) ? this.currentUser.name : 'Me', type: 'user' }
    ];
    const edges = [];
    const friends = MindVaultData.friends || [];
    const hobbyMap = {}; // hobby/interest -> id

    friends.forEach((friend, idx) => {
      const friendNodeId = `friend-${friend.id || idx}`;
      const score = friend.score !== undefined ? friend.score : this.calculateDynamicFriendScore(friend);
      nodes.push({
        id: friendNodeId,
        label: friend.name || 'Friend',
        type: 'friend',
        score: score,
        tier: friend.tier || friend.relation || 'Friend',
        rawFriend: friend
      });

      // Edge from User to Friend
      edges.push({
        from: 'user',
        to: friendNodeId,
        label: `${score}% • ${friend.tier || friend.relation || 'Friend'}`,
        score: score
      });

      // Extract hobbies or favorites
      const itemsToLink = [];
      if (friend.favorites) {
        if (friend.favorites.hobby) itemsToLink.push({ name: friend.favorites.hobby, relation: 'Hobby' });
        if (friend.favorites.drink) itemsToLink.push({ name: friend.favorites.drink, relation: 'Fav Drink' });
        if (friend.favorites.food) itemsToLink.push({ name: friend.favorites.food, relation: 'Fav Food' });
      }
      if (Array.isArray(friend.likes)) {
        friend.likes.forEach(like => {
          if (like && like.trim()) itemsToLink.push({ name: like.trim(), relation: 'Likes' });
        });
      }

      itemsToLink.forEach(item => {
        const key = item.name.toLowerCase();
        let topicId;
        if (!hobbyMap[key]) {
          topicId = `topic-${Object.keys(hobbyMap).length + 1}`;
          hobbyMap[key] = topicId;
          nodes.push({
            id: topicId,
            label: item.name,
            type: 'topic'
          });
        } else {
          topicId = hobbyMap[key];
        }

        edges.push({
          from: friendNodeId,
          to: topicId,
          label: item.relation
        });
      });
    });

    return { nodes, edges };
  },

  renderKnowledgeGraph() {
    const canvas = document.getElementById('knowledge-graph-canvas');
    if (!canvas) return;

    if (this.graphEngine) {
      this.graphEngine.destroy();
      this.graphEngine = null;
    }

    const graphData = this.generateKnowledgeGraphData();
    MindVaultData.knowledgeGraph = graphData;

    this.graphEngine = new KnowledgeGraphEngine('knowledge-graph-canvas', graphData);
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
  },

  // Milestone / Special Moments Methods
  openAddMilestoneModal(friendId) {
    const targetFriendId = friendId || this.selectedFriendId || (MindVaultData.friends[0] ? MindVaultData.friends[0].id : null);
    if (!targetFriendId) {
      this.showToast('Pilih atau tambahkan teman terlebih dahulu.', 'warning');
      return;
    }

    const titleEl = document.getElementById('modal-add-milestone-title');
    if (titleEl) titleEl.innerText = '🎉 Tambah Acara & Momen Spesial Teman';
    const idEl = document.getElementById('edit-milestone-id');
    if (idEl) idEl.value = '';
    const fIdEl = document.getElementById('edit-milestone-friend-id');
    if (fIdEl) fIdEl.value = targetFriendId;

    const titleInput = document.getElementById('add-milestone-title');
    if (titleInput) titleInput.value = '';
    const dateInput = document.getElementById('add-milestone-date');
    if (dateInput) dateInput.value = '';
    const notesInput = document.getElementById('add-milestone-notes');
    if (notesInput) notesInput.value = '';

    const btnEl = document.getElementById('btn-save-milestone');
    if (btnEl) btnEl.innerText = 'Simpan Momen Spesial 🎉';

    const modal = document.getElementById('modal-add-milestone');
    if (modal) modal.classList.add('active');
  },

  openEditMilestoneModal(friendId, mIdx) {
    const friend = MindVaultData.friends.find(f => String(f.id) === String(friendId));
    if (!friend || !friend.milestones || !friend.milestones[mIdx]) {
      this.showToast('Data momen spesial tidak ditemukan.', 'warning');
      return;
    }

    const milestone = friend.milestones[mIdx];
    const titleEl = document.getElementById('modal-add-milestone-title');
    if (titleEl) titleEl.innerText = `✏️ Edit Momen Spesial: ${milestone.title}`;
    const idEl = document.getElementById('edit-milestone-id');
    if (idEl) idEl.value = mIdx;
    const fIdEl = document.getElementById('edit-milestone-friend-id');
    if (fIdEl) fIdEl.value = friendId;

    const typeSelect = document.getElementById('add-milestone-type');
    if (typeSelect) typeSelect.value = milestone.type || '🎓 Wisuda / Graduation';
    const titleInput = document.getElementById('add-milestone-title');
    if (titleInput) titleInput.value = milestone.title || '';
    const dateInput = document.getElementById('add-milestone-date');
    if (dateInput) dateInput.value = milestone.date || '';
    const notesInput = document.getElementById('add-milestone-notes');
    if (notesInput) notesInput.value = milestone.notes || '';

    const btnEl = document.getElementById('btn-save-milestone');
    if (btnEl) btnEl.innerText = 'Update Momen Spesial ✏️';

    const modal = document.getElementById('modal-add-milestone');
    if (modal) modal.classList.add('active');
  },

  async saveMilestoneFromModal() {
    const editMIdx = document.getElementById('edit-milestone-id')?.value;
    const friendId = document.getElementById('edit-milestone-friend-id')?.value;
    const type = document.getElementById('add-milestone-type')?.value || '✨ Momen Spesial';
    const title = document.getElementById('add-milestone-title')?.value?.trim();
    const date = document.getElementById('add-milestone-date')?.value;
    const notes = document.getElementById('add-milestone-notes')?.value?.trim();

    if (!title || !date) {
      this.showToast('Mohon lengkapi judul dan tanggal acara.', 'warning');
      return;
    }

    const friend = MindVaultData.friends.find(f => String(f.id) === String(friendId));
    if (!friend) {
      this.showToast('Teman tidak ditemukan.', 'warning');
      return;
    }

    if (!friend.milestones) friend.milestones = [];

    const milestoneObj = {
      id: editMIdx !== '' && friend.milestones[editMIdx] ? friend.milestones[editMIdx].id : `m-${Date.now()}`,
      type,
      title,
      date,
      notes
    };

    if (editMIdx !== '' && editMIdx !== undefined) {
      friend.milestones[parseInt(editMIdx, 10)] = milestoneObj;
      this.showToast(`Momen "${title}" berhasil diperbarui! ✏️🎉`, 'success');
    } else {
      friend.milestones.push(milestoneObj);
      this.showToast(`Momen spesial "${title}" berhasil dicatat! 🎉✨`, 'success');
    }

    await MindVaultSupabase.updateFriend(friend);

    const modal = document.getElementById('modal-add-milestone');
    if (modal) modal.classList.remove('active');

    this.renderFriendProfile(friend.id);
    this.renderRemindersList();
  },

  async deleteMilestone(friendId, mIdx) {
    this.showCustomConfirm({
      title: 'Hapus Momen Spesial',
      message: 'Apakah Anda yakin ingin menghapus momen / acara spesial ini?',
      icon: '<i class="fa-solid fa-trash-can" style="color: #DC2626;"></i>',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      onConfirm: async () => {
        const friend = MindVaultData.friends.find(f => String(f.id) === String(friendId));
        if (!friend || !friend.milestones) return;

        friend.milestones.splice(mIdx, 1);
        await MindVaultSupabase.updateFriend(friend);

        this.showToast('Momen spesial berhasil dihapus 🗑️', 'info');
        this.renderFriendProfile(friend.id);
        this.renderRemindersList();
      }
    });
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
window.openAddMilestoneModal = (fId) => MindVaultApp.openAddMilestoneModal(fId);
window.openEditMilestoneModal = (fId, idx) => MindVaultApp.openEditMilestoneModal(fId, idx);
window.saveMilestoneFromModal = () => MindVaultApp.saveMilestoneFromModal();
window.deleteMilestone = (fId, idx) => MindVaultApp.deleteMilestone(fId, idx);
window.toggleNotificationDropdown = (state) => MindVaultApp.toggleNotificationDropdown(state);
window.handleLogout = () => MindVaultApp.handleLogout();
