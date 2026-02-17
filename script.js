/**
 * FLO – Budget / Expense Tracker
 * script.js | Full application logic
 * Handles: Auth, Dashboard, Transactions, Charts, UI
 */

'use strict';

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const STORAGE_KEYS = {
  USERS: 'flo_users',
  SESSION: 'flo_session',
  TRANSACTIONS: 'flo_tx_',    // + userId suffix
  THEME: 'flo_theme',
};

const CATEGORY_EMOJI = {
  'Salary': '💼', 'Freelance': '💻', 'Investment': '📈',
  'Gift': '🎁', 'Other Income': '✦',
  'Housing': '🏠', 'Food': '🍔', 'Transport': '🚗',
  'Health': '💊', 'Entertainment': '🎬', 'Shopping': '🛍',
  'Utilities': '⚡', 'Education': '📚', 'Other Expense': '✦',
};

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'];

/* ============================================================
   STORAGE HELPERS
   ============================================================ */

/** Read JSON from localStorage safely */
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}

/** Write JSON to localStorage */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Get all registered users */
function getUsers() { return lsGet(STORAGE_KEYS.USERS) || []; }

/** Save updated user list */
function saveUsers(users) { lsSet(STORAGE_KEYS.USERS, users); }

/** Get current session user */
function getSession() { return lsGet(STORAGE_KEYS.SESSION); }

/** Set session user */
function setSession(user) { lsSet(STORAGE_KEYS.SESSION, user); }

/** Clear session (logout) */
function clearSession() { localStorage.removeItem(STORAGE_KEYS.SESSION); }

/** Get transactions for a user ID */
function getTransactions(userId) {
  return lsGet(STORAGE_KEYS.TRANSACTIONS + userId) || [];
}

/** Save transactions for a user ID */
function saveTransactions(userId, txList) {
  lsSet(STORAGE_KEYS.TRANSACTIONS + userId, txList);
}

/* ============================================================
   THEME
   ============================================================ */

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);

  document.querySelectorAll('.theme-icon').forEach(icon => {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
  document.querySelectorAll('.theme-label').forEach(label => {
    label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  });

  // Update Chart.js charts if on dashboard
  if (typeof barChartInstance !== 'undefined' && barChartInstance) {
    updateChartTheme();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   AUTH PAGE LOGIC
   ============================================================ */
function initAuthPage() {
  // If already logged in, go to dashboard
  if (getSession()) {
    window.location.href = 'dashboard.html';
    return;
  }

  initTheme();
  setupThemeToggle();
  setupTabs();
  setupLoginForm();
  setupRegisterForm();
  setupPasswordToggles();
}

/** Tab switching */
function setupTabs() {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const indicator = document.querySelector('.tab-indicator');
  if (!loginTab) return;

  loginTab.addEventListener('click', () => showTab('login'));
  registerTab.addEventListener('click', () => showTab('register'));

  // Cross-links inside forms
  document.getElementById('goRegister')?.addEventListener('click', () => showTab('register'));
  document.getElementById('goLogin')?.addEventListener('click', () => showTab('login'));

  function showTab(which) {
    const isLogin = which === 'login';

    loginTab.classList.toggle('active', isLogin);
    registerTab.classList.toggle('active', !isLogin);
    loginTab.setAttribute('aria-selected', isLogin);
    registerTab.setAttribute('aria-selected', !isLogin);

    indicator.classList.toggle('right', !isLogin);

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (isLogin) {
      loginForm.hidden = false;
      loginForm.classList.add('active');
      registerForm.hidden = true;
    } else {
      registerForm.hidden = false;
      registerForm.classList.add('active');
      loginForm.hidden = true;
    }

    clearBanners();
  }
}

/** Login form handler */
function setupLoginForm() {
  const form = document.getElementById('loginFormEl');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearBanners();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const btn = form.querySelector('.btn');

    // Validate fields
    if (!email || !password) {
      showError('loginError', 'Please fill in all fields.');
      return;
    }

    // Simulate async check
    setLoading(btn, true);

    setTimeout(() => {
      const users = getUsers();
      const user = users.find(u => u.email === email && u.password === password);

      if (!user) {
        setLoading(btn, false);
        showError('loginError', 'Invalid email or password. Please try again.');
        shakeElement(form);
        return;
      }

      // Success – set session and redirect
      setSession({ id: user.id, name: user.name, email: user.email });
      window.location.href = 'dashboard.html';
    }, 600);
  });
}

/** Register form handler */
function setupRegisterForm() {
  const form = document.getElementById('registerFormEl');
  if (!form) return;

  // Password strength meter
  const pwInput = document.getElementById('regPassword');
  pwInput?.addEventListener('input', () => updatePasswordStrength(pwInput.value));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearBanners();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const btn = form.querySelector('.btn');

    // Validation
    if (!name || !email || !password) {
      showError('registerError', 'Please fill in all fields.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('registerError', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      showError('registerError', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(btn, true);

    setTimeout(() => {
      const users = getUsers();
      if (users.find(u => u.email === email)) {
        setLoading(btn, false);
        showError('registerError', 'An account with this email already exists.');
        shakeElement(form);
        return;
      }

      // Create user
      const newUser = {
        id: 'user_' + Date.now(),
        name,
        email,
        password,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      saveUsers(users);

      setLoading(btn, false);
      showSuccess('registerSuccess', '🎉 Account created! You can now sign in.');
      form.reset();
      updatePasswordStrength('');
    }, 700);
  });
}

/** Password visibility toggles */
function setupPasswordToggles() {
  setupToggle('toggleLoginPw', 'loginPassword');
  setupToggle('toggleRegPw', 'regPassword');

  function setupToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? '🙈' : '👁';
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }
}

/** Password strength meter */
function updatePasswordStrength(password) {
  const fill = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!fill || !label) return;

  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const configs = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#ff5c6c', text: 'Weak' },
    { pct: '50%',  color: '#ffaa00', text: 'Fair' },
    { pct: '75%',  color: '#00b8ff', text: 'Good' },
    { pct: '90%',  color: '#00d68f', text: 'Strong' },
    { pct: '100%', color: '#00d68f', text: 'Excellent' },
  ];
  const cfg = configs[score] || configs[0];

  fill.style.width = cfg.pct;
  fill.style.backgroundColor = cfg.color;
  label.textContent = cfg.text;
  label.style.color = cfg.color;
}

/* ============================================================
   DASHBOARD PAGE LOGIC
   ============================================================ */

// Chart instances (module-level)
let barChartInstance = null;
let doughnutChartInstance = null;

// State
let currentFilter = 'all';
let currentSection = 'overview';
let selectedTxType = 'income';
let pendingDeleteId = null;
let pendingDeleteItem = null;
let deleteToastTimer = null;
let currentUserId = null;

function initDashboard() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  currentUserId = session.id;
  initTheme();
  setupThemeToggle();
  setupSidebar();
  setupLogout();
  setupNavigation();
  setupModal();
  setupTransactionForm();
  setupFilters();
  setupSearch();
  setupToast();

  populateUserInfo(session);
  renderDashboard();
}

/** Fill in user's info in sidebar & greeting */
function populateUserInfo(session) {
  const firstName = session.name.split(' ')[0];
  const initials = session.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  setText('sidebarName', session.name);
  setText('sidebarEmail', session.email);
  setText('greetingName', firstName);
  setText('greetingText', greeting);

  const avatar = document.getElementById('sidebarAvatar');
  if (avatar) avatar.textContent = initials;
}

/** Sidebar toggle for mobile */
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  const closeBtn = document.getElementById('sidebarClose');

  function open() {
    sidebar?.classList.add('open');
    overlay?.classList.add('show');
    hamburger?.setAttribute('aria-expanded', 'true');
  }
  function close() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    hamburger?.setAttribute('aria-expanded', 'false');
  }

  hamburger?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

/** Logout */
function setupLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

/** Navigation between sections */
function setupNavigation() {
  const links = document.querySelectorAll('.nav-link');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navigateTo(section);

      // Close sidebar on mobile
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('show');
    });
  });

  // View all button on overview
  document.getElementById('viewAllBtn')?.addEventListener('click', () => navigateTo('transactions'));
}

function navigateTo(section) {
  currentSection = section;

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.section === section;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Show/hide sections
  document.querySelectorAll('.dashboard-section').forEach(el => {
    el.hidden = (el.id !== `section-${section}`);
  });

  // Load analytics charts lazily
  if (section === 'analytics') renderCharts();

  // Refresh transactions list when switching to transactions tab
  if (section === 'transactions') renderAllTransactions();
}

/* ============================================================
   MODAL – ADD TRANSACTION
   ============================================================ */
function setupModal() {
  const backdrop = document.getElementById('modalBackdrop');
  const openBtn = document.getElementById('openModal');
  const closeBtn = document.getElementById('closeModal');

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  // Close on backdrop click (not modal itself)
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop?.hidden) closeModal();
  });

  // Type toggle buttons (Income / Expense)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTxType = btn.dataset.type;
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === selectedTxType);
        b.setAttribute('aria-pressed', b.dataset.type === selectedTxType);
      });
    });
  });
}

function openModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (!backdrop) return;
  backdrop.hidden = false;

  // Set default date to today
  const dateInput = document.getElementById('txDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Focus first input
  setTimeout(() => document.getElementById('txTitle')?.focus(), 100);
}

function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (!backdrop) return;
  const modal = document.getElementById('modal');

  // Reverse animation
  modal.style.animation = 'none';
  modal.style.transform = 'translateY(40px) scale(0.97)';
  modal.style.opacity = '0';
  modal.style.transition = 'transform 0.25s ease, opacity 0.25s ease';

  setTimeout(() => {
    backdrop.hidden = true;
    modal.style.animation = '';
    modal.style.transform = '';
    modal.style.opacity = '';
    modal.style.transition = '';
    document.getElementById('transactionForm')?.reset();
    hideElement('txError');

    // Reset type toggle
    selectedTxType = 'income';
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === 'income');
      b.setAttribute('aria-pressed', b.dataset.type === 'income');
    });
  }, 250);
}

/* ============================================================
   TRANSACTION FORM SUBMIT
   ============================================================ */
function setupTransactionForm() {
  const form = document.getElementById('transactionForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideElement('txError');

    const title = document.getElementById('txTitle').value.trim();
    const amount = parseFloat(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const category = document.getElementById('txCategory').value;
    const btn = form.querySelector('.btn');

    // Validation
    if (!title) { showError('txError', 'Please enter a title.'); return; }
    if (isNaN(amount) || amount <= 0) { showError('txError', 'Please enter a valid amount.'); return; }
    if (!date) { showError('txError', 'Please select a date.'); return; }
    if (!category) { showError('txError', 'Please select a category.'); return; }

    setLoading(btn, true);

    // Simulate save delay for UX
    setTimeout(() => {
      const tx = {
        id: 'tx_' + Date.now(),
        title,
        amount,
        type: selectedTxType,
        category,
        date,
        createdAt: new Date().toISOString(),
      };

      const txList = getTransactions(currentUserId);
      txList.unshift(tx); // newest first
      saveTransactions(currentUserId, txList);

      setLoading(btn, false);
      closeModal();
      renderDashboard();
    }, 400);
  });
}

/* ============================================================
   FILTERS & SEARCH
   ============================================================ */
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderAllTransactions();
    });
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  input?.addEventListener('input', () => renderAllTransactions());
}

function getFilteredTransactions() {
  const all = getTransactions(currentUserId);
  const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';

  return all.filter(tx => {
    const matchesFilter = currentFilter === 'all' || tx.type === currentFilter;
    const matchesSearch = !searchTerm || tx.title.toLowerCase().includes(searchTerm) || tx.category.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });
}

/* ============================================================
   RENDER DASHBOARD
   ============================================================ */
function renderDashboard() {
  const txList = getTransactions(currentUserId);

  // Calculate totals
  const income = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const clampedRate = Math.max(0, Math.min(100, savingsRate));

  const incomeCount = txList.filter(t => t.type === 'income').length;
  const expenseCount = txList.filter(t => t.type === 'expense').length;

  // Animate numbers
  animateValue('balanceDisplay', balance, true);
  animateValue('incomeDisplay', income, false);
  animateValue('expenseDisplay', expense, false);

  // Balance subtext color
  const balanceSub = document.getElementById('balanceSubtext');
  if (balanceSub) {
    balanceSub.textContent = balance >= 0 ? 'Your net position' : 'You\'re in the red';
    balanceSub.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
  }

  // Transaction counts
  setText('incomeCount', `${incomeCount} transaction${incomeCount !== 1 ? 's' : ''}`);
  setText('expenseCount', `${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`);

  // Savings progress
  setText('savingsRate', `${clampedRate}%`);
  setText('circleLabel', `${clampedRate}%`);

  // Animate savings bar
  setTimeout(() => {
    const bar = document.getElementById('savingsBar');
    if (bar) bar.style.width = `${clampedRate}%`;

    // Animate circle (circumference = 2πr = 213.6 for r=34)
    const circle = document.getElementById('circleFill');
    if (circle) {
      const offset = 213.6 - (213.6 * clampedRate / 100);
      circle.style.strokeDashoffset = offset;
    }
  }, 100);

  // Recent transactions (up to 5)
  renderRecentTransactions(txList.slice(0, 5));

  // Also refresh all transactions if on that tab
  if (currentSection === 'transactions') renderAllTransactions();
  if (currentSection === 'analytics') renderCharts();
}

/** Recent list on overview */
function renderRecentTransactions(txList) {
  const container = document.getElementById('recentList');
  if (!container) return;
  container.innerHTML = '';

  if (txList.length === 0) {
    container.appendChild(createEmptyState('No transactions yet', 'Tap + Add to record your first transaction.', '💳'));
    return;
  }

  txList.forEach((tx, i) => {
    const card = createTransactionCard(tx, i);
    container.appendChild(card);
  });
}

/** Full list in Transactions tab */
function renderAllTransactions() {
  const container = document.getElementById('allTransactionList');
  if (!container) return;
  container.innerHTML = '';

  const filtered = getFilteredTransactions();

  if (filtered.length === 0) {
    const msg = currentFilter !== 'all' ? `No ${currentFilter} transactions found.` : 'No transactions yet.';
    container.appendChild(createEmptyState('Nothing here', msg, currentFilter === 'income' ? '📈' : currentFilter === 'expense' ? '📉' : '💳'));
    return;
  }

  filtered.forEach((tx, i) => {
    const card = createTransactionCard(tx, i, true);
    container.appendChild(card);
  });
}

/** Build a transaction card DOM element */
function createTransactionCard(tx, index, showDelete = false) {
  const card = document.createElement('article');
  card.className = 'tx-card';
  card.dataset.id = tx.id;
  card.style.animationDelay = `${index * 0.04}s`;
  card.setAttribute('aria-label', `${tx.type} transaction: ${tx.title}, $${tx.amount}`);

  const emoji = CATEGORY_EMOJI[tx.category] || '💳';
  const sign = tx.type === 'income' ? '+' : '−';
  const formattedAmount = formatCurrency(tx.amount);
  const formattedDate = formatDate(tx.date);

  card.innerHTML = `
    <div class="tx-icon ${tx.type}" aria-hidden="true">${emoji}</div>
    <div class="tx-info">
      <div class="tx-title">${escapeHtml(tx.title)}</div>
      <div class="tx-meta">${escapeHtml(tx.category)} · ${formattedDate}</div>
    </div>
    <div class="tx-amount ${tx.type}">${sign}${formattedAmount}</div>
    <button class="tx-delete" aria-label="Delete transaction: ${escapeHtml(tx.title)}" data-id="${tx.id}">🗑</button>
  `;

  // Delete button
  card.querySelector('.tx-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTransaction(tx.id, card);
  });

  return card;
}

/** Create empty state element */
function createEmptyState(title, subtitle, icon = '📭') {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon" aria-hidden="true">${icon}</div>
    <h4>${title}</h4>
    <p>${subtitle}</p>
  `;
  return div;
}

/* ============================================================
   DELETE TRANSACTION WITH UNDO
   ============================================================ */
function deleteTransaction(txId, cardEl) {
  const txList = getTransactions(currentUserId);
  const txIndex = txList.findIndex(t => t.id === txId);
  if (txIndex === -1) return;

  // Save for undo
  pendingDeleteId = txId;
  pendingDeleteItem = { ...txList[txIndex], originalIndex: txIndex };

  // Animate card out
  cardEl.classList.add('deleting');

  setTimeout(() => {
    // Remove from storage
    const updated = txList.filter(t => t.id !== txId);
    saveTransactions(currentUserId, updated);
    renderDashboard();

    // Show toast
    showDeleteToast();
  }, 380);
}

function showDeleteToast() {
  clearTimeout(deleteToastTimer);
  const toast = document.getElementById('deleteToast');
  if (!toast) return;

  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));

  deleteToastTimer = setTimeout(() => {
    hideToast();
    pendingDeleteId = null;
    pendingDeleteItem = null;
  }, 4000);
}

function hideToast() {
  const toast = document.getElementById('deleteToast');
  if (!toast) return;
  toast.classList.remove('show');
  setTimeout(() => { toast.hidden = true; }, 400);
}

function setupToast() {
  document.getElementById('undoDelete')?.addEventListener('click', () => {
    if (!pendingDeleteItem) return;

    clearTimeout(deleteToastTimer);
    hideToast();

    const txList = getTransactions(currentUserId);
    // Re-insert at original position (clamped to array length)
    const idx = Math.min(pendingDeleteItem.originalIndex, txList.length);
    const restored = { ...pendingDeleteItem };
    delete restored.originalIndex;
    txList.splice(idx, 0, restored);
    saveTransactions(currentUserId, txList);

    pendingDeleteId = null;
    pendingDeleteItem = null;
    renderDashboard();
  });
}

/* ============================================================
   CHARTS (Chart.js)
   ============================================================ */
function renderCharts() {
  const txList = getTransactions(currentUserId);
  const income = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Analytics stats
  const amounts = txList.map(t => t.amount);
  const avgTx = amounts.length ? (amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
  const largestExp = txList.filter(t => t.type === 'expense').reduce((max, t) => Math.max(max, t.amount), 0);
  const largestInc = txList.filter(t => t.type === 'income').reduce((max, t) => Math.max(max, t.amount), 0);

  setText('avgTx', formatCurrency(avgTx));
  setText('largestExp', formatCurrency(largestExp));
  setText('largestInc', formatCurrency(largestInc));
  setText('totalTx', txList.length.toString());

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  // ── Bar chart: Income vs Expenses
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  if (barCtx) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Income', 'Expenses', 'Balance'],
        datasets: [{
          data: [income, expense, Math.abs(income - expense)],
          backgroundColor: [
            'rgba(0, 214, 143, 0.75)',
            'rgba(255, 92, 108, 0.75)',
            income >= expense ? 'rgba(0, 136, 255, 0.75)' : 'rgba(255, 170, 0, 0.75)',
          ],
          borderColor: ['#00d68f', '#ff5c6c', income >= expense ? '#0088ff' : '#ffaa00'],
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: gridColor },
            ticks: { color: tickColor, callback: v => '$' + v.toLocaleString() },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { color: tickColor },
            border: { display: false },
          }
        },
        animation: { duration: 800, easing: 'easeOutQuart' },
      }
    });
  }

  // ── Doughnut chart: Category breakdown
  const doughCtx = document.getElementById('doughnutChart')?.getContext('2d');
  if (doughCtx) {
    const categoryTotals = {};
    txList.forEach(tx => {
      if (!categoryTotals[tx.category]) categoryTotals[tx.category] = 0;
      categoryTotals[tx.category] += tx.amount;
    });

    const labels = Object.keys(categoryTotals);
    const values = Object.values(categoryTotals);

    const palette = [
      '#00d68f', '#ff5c6c', '#0088ff', '#ffaa00', '#b87cff',
      '#ff6eb4', '#00c9e6', '#f5a623', '#4caf50', '#e91e63'
    ];

    if (doughnutChartInstance) doughnutChartInstance.destroy();

    if (labels.length === 0) {
      // Clear canvas with message
      doughCtx.clearRect(0, 0, doughCtx.canvas.width, doughCtx.canvas.height);
      return;
    }

    doughnutChartInstance = new Chart(doughCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderColor: isDark ? '#0a0c10' : '#f0f4f8',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: tickColor,
              padding: 12,
              font: { size: 11, family: "'DM Sans', sans-serif" },
              boxWidth: 12,
              boxHeight: 12,
            }
          }
        },
        animation: { duration: 900, easing: 'easeOutBack' },
      }
    });
  }
}

function updateChartTheme() {
  if (barChartInstance || doughnutChartInstance) {
    // Re-render charts with new theme colors
    if (currentSection === 'analytics') renderCharts();
  }
}

/* ============================================================
   THEME TOGGLE SETUP
   ============================================================ */
function setupThemeToggle() {
  document.querySelectorAll('#themeToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleTheme();
      if (barChartInstance || doughnutChartInstance) {
        setTimeout(() => renderCharts(), 50);
      }
    });
  });
}

/* ============================================================
   ANIMATED NUMBER COUNTER
   ============================================================ */
function animateValue(elementId, targetValue, allowNegative) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (targetValue - start) * eased;

    el.textContent = formatCurrency(current);
    if (allowNegative && targetValue < 0) {
      el.style.color = 'var(--expense)';
    } else if (allowNegative) {
      el.style.color = '';
    }

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/** Format number as currency */
function formatCurrency(amount) {
  const abs = Math.abs(amount);
  if (amount < 0) return '-$' + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format ISO date string to readable */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00'); // avoid timezone shifts
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Basic email regex check */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Set element text */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Show element */
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

/** Hide element */
function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

/** Show error banner with message */
function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '⚠ ' + message;
  el.hidden = false;
}

/** Show success banner */
function showSuccess(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

/** Clear all banners */
function clearBanners() {
  document.querySelectorAll('.error-banner, .success-banner').forEach(el => {
    el.hidden = true;
    el.textContent = '';
  });
}

/** Set button loading state */
function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

/** Shake animation for forms on error */
function shakeElement(el) {
  el.style.animation = 'none';
  requestAnimationFrame(() => {
    el.style.animation = 'shake 0.4s ease';
  });
}

/* Add shake keyframe dynamically */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

/* ============================================================
   ENTRY POINT – Detect which page we're on and init
   ============================================================ */
(function init() {
  const isAuthPage = document.body.classList.contains('auth-page');
  const isDashboard = document.body.classList.contains('dashboard-page');

  if (isAuthPage) initAuthPage();
  if (isDashboard) initDashboard();
})();
