// Telegram Web App
const tg = window.Telegram?.WebApp;

// Состояние
let currentUser = null;
let allUsers = [];
let topics = [];
let homework = [];
let settings = { adminUsername: '@admin', giftThreshold: 5 };
let tgUser = null;

// API
const api = {
  async get(url) { return (await fetch(url)).json(); },
  async post(url, data) {
    return (await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })).json();
  },
  async put(url, data) {
    return (await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })).json();
  },
  async delete(url) { return (await fetch(url, { method: 'DELETE' })).json(); }
};

// Инициализация
async function init() {
  // СТРОГАЯ проверка Telegram
  if (!tg?.initDataUnsafe?.user?.id) {
    showScreen('error-screen');
    return;
  }

  tgUser = tg.initDataUnsafe.user;
  tg.ready();
  tg.expand();
  
  // Устанавливаем цвет хедера
  tg.setHeaderColor('#667eea');
  tg.setBackgroundColor('#667eea');
  
  try {
    [settings, topics, homework] = await Promise.all([
      api.get('/api/settings').catch(() => ({ adminUsername: '@admin', giftThreshold: 5 })),
      api.get('/api/topics').catch(() => []),
      api.get('/api/homework').catch(() => [])
    ]);

    const userData = await api.get(`/api/user/${tgUser.id}`);
    
    if (!userData || userData.error || !userData.tgId) {
      showScreen('register-screen');
      setupRegistration();
    } else {
      currentUser = userData;
      if (currentUser.isBlocked) {
        document.querySelector('#error-screen p').textContent = 'Ваш аккаунт заблокирован';
        showScreen('error-screen');
        return;
      }
      if (currentUser.theme === 'dark') document.body.classList.add('dark');
      showScreen('main-screen');
      setupNav();
      renderPage('progress');
    }
  } catch (e) {
    console.error(e);
    showScreen('register-screen');
    setupRegistration();
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Регистрация
function setupRegistration() {
  const form = document.getElementById('register-form');
  if (tgUser?.first_name) document.getElementById('reg-firstname').value = tgUser.first_name;
  if (tgUser?.last_name) document.getElementById('reg-lastname').value = tgUser.last_name || '';
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = document.getElementById('reg-day').value;
    const m = document.getElementById('reg-month').value;
    const y = document.getElementById('reg-year').value;
    if (!d || !m || !y) { showToast('Заполните дату рождения'); return; }
    
    const result = await api.post('/api/register', {
      tgId: String(tgUser.id),
      username: tgUser.username || '',
      firstName: document.getElementById('reg-firstname').value,
      lastName: document.getElementById('reg-lastname').value,
      birthDate: `${d}.${m}.${y}`,
      photo: tgUser.photo_url || ''
    });
    
    if (result.success) {
      currentUser = await api.get(`/api/user/${tgUser.id}`);
      showScreen('main-screen');
      setupNav();
      renderPage('progress');
      showToast('Добро пожаловать! 🎉');
    } else {
      showToast(result.message || 'Ошибка');
    }
  };
}

// Навигация
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPage(btn.dataset.page);
    };
  });
}

function renderPage(page) {
  const c = document.getElementById('page-content');
  switch(page) {
    case 'progress': c.innerHTML = renderProgress(); break;
    case 'topics': c.innerHTML = renderTopics(); setupTabs(); break;
    case 'diary': c.innerHTML = renderDiary(); break;
    case 'settings': c.innerHTML = renderSettings(); setupSettingsEvents(); break;
  }
}


// === СТРАНИЦЫ ===

function renderProgress() {
  const stickers = currentUser?.stickers || 0;
  const threshold = settings.giftThreshold || 5;
  const toGift = threshold - (stickers % threshold);
  const showAlert = stickers > 0 && stickers % threshold === 0;
  
  // Показываем на 5 шагов вперёд от текущего
  const totalSteps = Math.max(stickers + 5, 15);
  
  let roadItems = '';
  for (let i = 1; i <= totalSteps; i++) {
    const done = i <= stickers;
    const isCurrent = i === stickers + 1;
    const isGift = i % threshold === 0;
    
    let circleClass = 'step-circle';
    if (done) circleClass += ' done';
    if (isCurrent) circleClass += ' current';
    if (isGift) circleClass += ' gift';
    
    const label = isGift ? `<span class="gift-label">🎁 Подарок!</span>` : `Шаг ${i}`;
    
    roadItems += `
      <div class="road-item">
        <div class="${circleClass}">${!done && !isGift ? i : ''}</div>
        <div class="step-info">
          <div class="step-num">#${i}</div>
          <div class="step-label">${label}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="progress-page">
      <div class="progress-header">
        <h2>Моя дорожка</h2>
        <div class="progress-counter">
          <span>До подарка:</span>
          <span class="num">${toGift === threshold ? threshold : toGift}</span>
          <span>🎁</span>
        </div>
      </div>
      
      <div class="road-container">
        <div class="road">${roadItems}</div>
      </div>
      
      ${showAlert ? `
        <div class="gift-alert">
          <span class="emoji">🎉</span>
          <strong>Поздравляем!</strong>
          <p>Подойди к ${settings.adminUsername} за сладким подарком!</p>
        </div>
      ` : ''}
    </div>
  `;
}


function renderTopics() {
  const visible = (topics || []).filter(t => !t.isHidden);
  const current = visible.filter(t => t.isCurrent);
  const past = visible.filter(t => !t.isCurrent);
  
  const visibleHW = (homework || []).filter(h => !h.isHidden);
  const now = new Date();
  const currentHW = visibleHW.filter(h => new Date(h.dueDate) >= now);
  const pastHW = visibleHW.filter(h => new Date(h.dueDate) < now);

  const card = (items, type) => items.length ? items.map(t => {
    const isDone = type === 'hw' && (t.completedBy || []).includes(currentUser?.tgId);
    return `
      <div class="${type === 'hw' ? 'homework-card' : 'topic-card'} ${isDone ? 'completed' : ''}">
        <h4>${isDone ? '✅ ' : ''}${t.title}</h4>
        <div class="date">📅 ${t.date || t.dueDate}</div>
        ${t.description ? `<p>${t.description}</p>` : ''}
      </div>
    `;
  }).join('') : `<div class="empty-state"><div class="icon">${type === 'hw' ? '✏️' : '📖'}</div><p>Пока пусто</p></div>`;

  return `
    <div class="topics-page">
      <h2>📚 Темы занятий</h2>
      <div class="tabs" id="t-tabs">
        <button class="tab-btn active" data-t="cur-t">Текущие</button>
        <button class="tab-btn" data-t="past-t">Пройденные</button>
      </div>
      <div id="cur-t" class="tab-content active">${card(current, 'topic')}</div>
      <div id="past-t" class="tab-content">${card(past, 'topic')}</div>
      
      <h3 class="section-title">📝 Домашние задания</h3>
      <div class="tabs" id="hw-tabs">
        <button class="tab-btn active" data-t="cur-hw">Текущие</button>
        <button class="tab-btn" data-t="past-hw">Прошлые</button>
      </div>
      <div id="cur-hw" class="tab-content active">${card(currentHW, 'hw')}</div>
      <div id="past-hw" class="tab-content">${card(pastHW, 'hw')}</div>
    </div>
  `;
}

function setupTabs() {
  ['t-tabs', 'hw-tabs'].forEach(id => {
    document.querySelectorAll(`#${id} .tab-btn`).forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(`#${id} .tab-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabs = id === 't-tabs' ? ['cur-t', 'past-t'] : ['cur-hw', 'past-hw'];
        tabs.forEach(t => document.getElementById(t)?.classList.remove('active'));
        document.getElementById(btn.dataset.t)?.classList.add('active');
      };
    });
  });
}

function renderDiary() {
  const u = currentUser || {};
  return `
    <div class="diary-page">
      <div class="profile-card">
        ${u.photo ? `<img src="${u.photo}" class="profile-photo">` : `<div class="profile-photo placeholder">👤</div>`}
        <div class="profile-name">${u.firstName || ''} ${u.lastName || ''}</div>
        ${u.username ? `<div class="profile-username">@${u.username}</div>` : '<div style="height:20px"></div>'}
        <div class="stats-row">
          <div class="stat-box stickers">
            <div class="value">${u.stickers || 0}</div>
            <div class="label">Наклеек</div>
          </div>
          <div class="stat-box absences">
            <div class="value">${u.absences || 0}</div>
            <div class="label">Пропусков</div>
          </div>
        </div>
        <div class="birthday-box">
          <span class="emoji">🎂</span>
          <span>${u.birthDate || 'Не указана'}</span>
        </div>
      </div>
    </div>
  `;
}


function renderSettings() {
  const u = currentUser || {};
  const bp = (u.birthDate || '..').split('.');
  return `
    <div class="settings-page">
      <h2>⚙️ Настройки</h2>
      
      <div class="settings-card">
        <div class="setting-item">
          <label>Тёмная тема</label>
          <div class="toggle ${u.theme === 'dark' ? 'active' : ''}" id="theme-toggle"></div>
        </div>
      </div>
      
      <div class="section-header">Личные данные</div>
      <div class="edit-form">
        <form id="edit-form">
          <input type="text" id="e-fn" value="${u.firstName || ''}" placeholder="Имя">
          <input type="text" id="e-ln" value="${u.lastName || ''}" placeholder="Фамилия">
          <label>Дата рождения</label>
          <div class="date-row">
            <input type="number" id="e-d" value="${bp[0] || ''}" placeholder="Д">
            <input type="number" id="e-m" value="${bp[1] || ''}" placeholder="М">
            <input type="number" id="e-y" value="${bp[2] || ''}" placeholder="Г">
          </div>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </form>
      </div>
      
      <button class="admin-btn" id="admin-btn">
        🔐 ${u.isAdmin ? 'Админ панель' : 'Войти как админ'}
      </button>
    </div>
    
    <div class="admin-panel" id="admin-panel"></div>
    
    <div class="modal" id="pwd-modal">
      <div class="modal-content">
        <h3>🔐 Пароль администратора</h3>
        <form id="pwd-form">
          <input type="password" id="pwd" placeholder="Введите пароль">
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" id="close-pwd">Отмена</button>
            <button type="submit" class="btn btn-primary">Войти</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function setupSettingsEvents() {
  document.getElementById('theme-toggle')?.addEventListener('click', async function() {
    this.classList.toggle('active');
    const dark = this.classList.contains('active');
    document.body.classList.toggle('dark', dark);
    if (currentUser) {
      await api.put(`/api/user/${currentUser.tgId}`, { theme: dark ? 'dark' : 'light' });
      currentUser.theme = dark ? 'dark' : 'light';
    }
  });
  
  document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      firstName: document.getElementById('e-fn').value,
      lastName: document.getElementById('e-ln').value,
      birthDate: `${document.getElementById('e-d').value}.${document.getElementById('e-m').value}.${document.getElementById('e-y').value}`
    };
    await api.put(`/api/user/${currentUser.tgId}`, data);
    currentUser = { ...currentUser, ...data };
    showToast('Сохранено ✓');
  });
  
  document.getElementById('admin-btn')?.addEventListener('click', () => {
    if (currentUser?.isAdmin) openAdmin();
    else document.getElementById('pwd-modal').classList.add('active');
  });
  
  document.getElementById('close-pwd')?.addEventListener('click', () => {
    document.getElementById('pwd-modal').classList.remove('active');
  });
  
  document.getElementById('pwd-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (document.getElementById('pwd').value === 'login12AsXristian') {
      await api.put(`/api/user/${currentUser.tgId}`, { isAdmin: true });
      currentUser.isAdmin = true;
      document.getElementById('pwd-modal').classList.remove('active');
      openAdmin();
      showToast('Добро пожаловать, админ! 👑');
    } else showToast('Неверный пароль');
  });
}


// === АДМИН ===
let selectedUser = null;
let adminTab = 'users';

async function openAdmin() {
  allUsers = await api.get('/api/users');
  topics = await api.get('/api/topics');
  homework = await api.get('/api/homework');
  settings = await api.get('/api/settings');
  
  document.getElementById('admin-panel').classList.add('active');
  renderAdmin();
}

function closeAdmin() {
  document.getElementById('admin-panel').classList.remove('active');
  selectedUser = null;
}

function renderAdmin() {
  const p = document.getElementById('admin-panel');
  p.innerHTML = `
    <div class="admin-header">
      <h2>👑 Админ панель</h2>
      <button class="close-btn" id="close-admin">✕</button>
    </div>
    <div class="admin-tabs">
      <button class="admin-tab ${adminTab === 'users' ? 'active' : ''}" data-tab="users">👥 Люди</button>
      <button class="admin-tab ${adminTab === 'topics' ? 'active' : ''}" data-tab="topics">📚 Темы</button>
      <button class="admin-tab ${adminTab === 'homework' ? 'active' : ''}" data-tab="homework">📝 ДЗ</button>
      <button class="admin-tab ${adminTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️</button>
    </div>
    <div class="admin-content" id="admin-content">${renderAdminContent()}</div>
  `;
  setupAdminEvents();
}

function renderAdminContent() {
  switch(adminTab) {
    case 'users': return renderUsers();
    case 'topics': return renderAdminTopics();
    case 'homework': return renderAdminHW();
    case 'settings': return renderAdminSettings();
  }
}

function setupAdminEvents() {
  document.getElementById('close-admin')?.addEventListener('click', closeAdmin);
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.onclick = () => { adminTab = t.dataset.tab; renderAdmin(); };
  });
  
  switch(adminTab) {
    case 'users': setupUserEvents(); break;
    case 'topics': setupTopicEvents(); break;
    case 'homework': setupHWEvents(); break;
    case 'settings': setupAdminSettingsEvents(); break;
  }
}

// Пользователи
function renderUsers() {
  return `
    <div class="user-list">
      ${(allUsers || []).map(u => `
        <div class="user-item ${u.isBlocked ? 'blocked' : ''} ${selectedUser === u.tgId ? 'selected' : ''}" data-id="${u.tgId}">
          ${u.photo ? `<img src="${u.photo}">` : `<div class="user-avatar-placeholder">👤</div>`}
          <div class="user-info">
            <div class="user-name">${u.firstName || ''} ${u.lastName || ''} ${u.isBlocked ? '<span class="blocked-badge">БАН</span>' : ''}</div>
            <div class="user-id">${u.tgId} ${u.username ? `@${u.username}` : ''}</div>
          </div>
          <div class="user-stats">🏷️${u.stickers || 0} ❌${u.absences || 0}</div>
        </div>
      `).join('') || '<div class="empty-state"><p>Нет пользователей</p></div>'}
    </div>
    <div class="id-input"><input type="text" id="uid" placeholder="ID пользователя" value="${selectedUser || ''}"></div>
    <div class="action-grid">
      <button class="action-btn add" data-act="addS">+🏷️</button>
      <button class="action-btn remove" data-act="remS">-🏷️</button>
      <button class="action-btn add" data-act="addA">+❌</button>
      <button class="action-btn remove" data-act="remA">-❌</button>
      <button class="action-btn ${selectedUser && allUsers.find(u => u.tgId === selectedUser)?.isBlocked ? 'add' : 'remove'}" data-act="block">
        ${selectedUser && allUsers.find(u => u.tgId === selectedUser)?.isBlocked ? '✓Разбан' : '🚫Бан'}
      </button>
    </div>
  `;
}

function setupUserEvents() {
  document.querySelectorAll('.user-item').forEach(el => {
    el.onclick = () => {
      selectedUser = el.dataset.id;
      document.getElementById('uid').value = selectedUser;
      document.querySelectorAll('.user-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      const user = allUsers.find(u => u.tgId === selectedUser);
      const banBtn = document.querySelector('[data-act="block"]');
      if (banBtn && user) {
        banBtn.textContent = user.isBlocked ? '✓Разбан' : '🚫Бан';
        banBtn.className = `action-btn ${user.isBlocked ? 'add' : 'remove'}`;
      }
    };
  });
  
  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const id = document.getElementById('uid')?.value || selectedUser;
      if (!id) { showToast('Выберите пользователя'); return; }
      const user = allUsers.find(u => u.tgId === id);
      if (!user) { showToast('Не найден'); return; }
      
      let upd = {};
      switch(btn.dataset.act) {
        case 'addS': upd.stickers = (user.stickers || 0) + 1; break;
        case 'remS': upd.stickers = Math.max(0, (user.stickers || 0) - 1); break;
        case 'addA': upd.absences = (user.absences || 0) + 1; break;
        case 'remA': upd.absences = Math.max(0, (user.absences || 0) - 1); break;
        case 'block': upd.isBlocked = !user.isBlocked; break;
      }
      
      await api.put(`/api/user/${id}`, upd);
      allUsers = await api.get('/api/users');
      if (id === currentUser?.tgId) currentUser = { ...currentUser, ...upd };
      document.getElementById('admin-content').innerHTML = renderUsers();
      setupUserEvents();
      showToast('Обновлено ✓');
    };
  });
}


// Темы
function renderAdminTopics() {
  return `
    <button class="btn btn-primary" id="add-topic-btn" style="margin-bottom:16px">+ Добавить тему</button>
    ${(topics || []).map(t => `
      <div class="topic-card">
        <h4>${t.title} ${t.isHidden ? '👁️‍🗨️' : ''} ${t.isCurrent ? '🔵' : ''}</h4>
        <div class="date">📅 ${t.date}</div>
        <div class="action-grid" style="margin-top:10px">
          <button class="action-btn edit" data-tid="${t.id}" data-tact="cur">${t.isCurrent ? '→Прошла' : '→Текущая'}</button>
          <button class="action-btn ${t.isHidden ? 'add' : 'remove'}" data-tid="${t.id}" data-tact="hide">${t.isHidden ? 'Показать' : 'Скрыть'}</button>
          <button class="action-btn remove" data-tid="${t.id}" data-tact="del">Удалить</button>
        </div>
      </div>
    `).join('') || '<div class="empty-state"><p>Нет тем</p></div>'}
    <div class="modal" id="topic-modal">
      <div class="modal-content">
        <h3>📚 Новая тема</h3>
        <form id="topic-form">
          <input type="text" id="t-title" placeholder="Название" required>
          <input type="date" id="t-date" required>
          <textarea id="t-desc" placeholder="Описание" rows="2"></textarea>
          <label style="display:flex;align-items:center;gap:8px;margin:10px 0">
            <input type="checkbox" id="t-cur" style="width:auto"> Текущая тема
          </label>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" id="close-t-modal">Отмена</button>
            <button type="submit" class="btn btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function setupTopicEvents() {
  document.getElementById('add-topic-btn')?.addEventListener('click', () => {
    document.getElementById('topic-modal').classList.add('active');
  });
  document.getElementById('close-t-modal')?.addEventListener('click', () => {
    document.getElementById('topic-modal').classList.remove('active');
  });
  document.getElementById('topic-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.post('/api/topics', {
      title: document.getElementById('t-title').value,
      date: document.getElementById('t-date').value,
      description: document.getElementById('t-desc').value,
      isCurrent: document.getElementById('t-cur').checked
    });
    topics = await api.get('/api/topics');
    document.getElementById('topic-modal').classList.remove('active');
    document.getElementById('admin-content').innerHTML = renderAdminTopics();
    setupTopicEvents();
    showToast('Добавлено ✓');
  });
  
  document.querySelectorAll('[data-tact]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.tid;
      const t = topics.find(x => x.id === id);
      if (btn.dataset.tact === 'cur') await api.put(`/api/topics/${id}`, { isCurrent: !t.isCurrent });
      else if (btn.dataset.tact === 'hide') await api.put(`/api/topics/${id}`, { isHidden: !t.isHidden });
      else if (btn.dataset.tact === 'del') { if (!confirm('Удалить?')) return; await api.delete(`/api/topics/${id}`); }
      topics = await api.get('/api/topics');
      document.getElementById('admin-content').innerHTML = renderAdminTopics();
      setupTopicEvents();
    };
  });
}

// ДЗ
let currentHWId = null;

function renderAdminHW() {
  return `
    <button class="btn btn-primary" id="add-hw-btn" style="margin-bottom:16px">+ Добавить ДЗ</button>
    ${(homework || []).map(h => `
      <div class="homework-card">
        <h4>${h.title} ${h.isHidden ? '👁️‍🗨️' : ''}</h4>
        <div class="date">📅 ${h.dueDate} | ✅ ${(h.completedBy || []).length}</div>
        <div class="action-grid" style="margin-top:10px">
          <button class="action-btn edit" data-hid="${h.id}" data-hact="mark">Отметить</button>
          <button class="action-btn ${h.isHidden ? 'add' : 'remove'}" data-hid="${h.id}" data-hact="hide">${h.isHidden ? 'Показать' : 'Скрыть'}</button>
          <button class="action-btn remove" data-hid="${h.id}" data-hact="del">Удалить</button>
        </div>
      </div>
    `).join('') || '<div class="empty-state"><p>Нет ДЗ</p></div>'}
    <div class="modal" id="hw-modal">
      <div class="modal-content">
        <h3>📝 Новое ДЗ</h3>
        <form id="hw-form">
          <input type="text" id="hw-title" placeholder="Название" required>
          <input type="date" id="hw-date" required>
          <textarea id="hw-desc" placeholder="Описание" rows="2"></textarea>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" id="close-hw-modal">Отмена</button>
            <button type="submit" class="btn btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal" id="mark-modal">
      <div class="modal-content">
        <h3>✅ Отметить выполнение</h3>
        <div id="mark-list" class="user-list"></div>
        <div class="modal-buttons">
          <button class="btn btn-secondary" id="close-mark">Закрыть</button>
        </div>
      </div>
    </div>
  `;
}


function setupHWEvents() {
  document.getElementById('add-hw-btn')?.addEventListener('click', () => {
    document.getElementById('hw-modal').classList.add('active');
  });
  document.getElementById('close-hw-modal')?.addEventListener('click', () => {
    document.getElementById('hw-modal').classList.remove('active');
  });
  document.getElementById('close-mark')?.addEventListener('click', () => {
    document.getElementById('mark-modal').classList.remove('active');
  });
  
  document.getElementById('hw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.post('/api/homework', {
      title: document.getElementById('hw-title').value,
      dueDate: document.getElementById('hw-date').value,
      description: document.getElementById('hw-desc').value
    });
    homework = await api.get('/api/homework');
    document.getElementById('hw-modal').classList.remove('active');
    document.getElementById('admin-content').innerHTML = renderAdminHW();
    setupHWEvents();
    showToast('Добавлено ✓');
  });
  
  document.querySelectorAll('[data-hact]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.hid;
      const h = homework.find(x => x.id === id);
      if (btn.dataset.hact === 'mark') { currentHWId = id; showMarkModal(); return; }
      if (btn.dataset.hact === 'hide') await api.put(`/api/homework/${id}`, { isHidden: !h.isHidden });
      else if (btn.dataset.hact === 'del') { if (!confirm('Удалить?')) return; await api.delete(`/api/homework/${id}`); }
      homework = await api.get('/api/homework');
      document.getElementById('admin-content').innerHTML = renderAdminHW();
      setupHWEvents();
    };
  });
}

function showMarkModal() {
  const h = homework.find(x => x.id === currentHWId);
  const list = document.getElementById('mark-list');
  list.innerHTML = (allUsers || []).map(u => {
    const done = (h.completedBy || []).includes(u.tgId);
    return `
      <div class="user-item ${done ? 'selected' : ''}" data-mark-uid="${u.tgId}">
        ${u.photo ? `<img src="${u.photo}">` : `<div class="user-avatar-placeholder">👤</div>`}
        <div class="user-info"><div class="user-name">${u.firstName || ''} ${u.lastName || ''}</div></div>
        <div style="font-size:20px">${done ? '✅' : '⬜'}</div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('[data-mark-uid]').forEach(el => {
    el.onclick = async () => {
      const uid = el.dataset.markUid;
      const hw = homework.find(x => x.id === currentHWId);
      let cb = [...(hw.completedBy || [])];
      if (cb.includes(uid)) cb = cb.filter(x => x !== uid);
      else cb.push(uid);
      await api.put(`/api/homework/${currentHWId}`, { completedBy: cb });
      homework = await api.get('/api/homework');
      showMarkModal();
    };
  });
  
  document.getElementById('mark-modal').classList.add('active');
}

// Настройки админа
function renderAdminSettings() {
  return `
    <form id="admin-set-form">
      <label>Username админа (для уведомлений)</label>
      <input type="text" id="a-user" value="${settings.adminUsername || ''}" placeholder="@username">
      <label>Наклеек до подарка</label>
      <input type="number" id="a-gift" value="${settings.giftThreshold || 5}" min="1">
      <button type="submit" class="btn btn-primary" style="margin-top:10px">Сохранить</button>
    </form>
  `;
}

function setupAdminSettingsEvents() {
  document.getElementById('admin-set-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.put('/api/settings', {
      adminUsername: document.getElementById('a-user').value,
      giftThreshold: parseInt(document.getElementById('a-gift').value) || 5
    });
    settings = await api.get('/api/settings');
    showToast('Сохранено ✓');
  });
}

// Запуск
document.addEventListener('DOMContentLoaded', init);
