// Telegram Web App
const tg = window.Telegram?.WebApp;

// Состояние приложения
let currentUser = null;
let allUsers = [];
let topics = [];
let homework = [];
let settings = { adminUsername: '@admin', giftThreshold: 5 };
let currentPage = 'progress';

// API функции
const api = {
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return res.json();
  }
};

// Инициализация
async function init() {
  // Проверка Telegram
  if (!tg || !tg.initDataUnsafe?.user) {
    showScreen('error-screen');
    return;
  }

  tg.ready();
  tg.expand();

  const tgUser = tg.initDataUnsafe.user;
  
  try {
    // Загрузка данных
    [settings, topics, homework] = await Promise.all([
      api.get('/api/settings'),
      api.get('/api/topics'),
      api.get('/api/homework')
    ]);

    // Проверка регистрации
    currentUser = await api.get(`/api/user/${tgUser.id}`);
    
    if (!currentUser) {
      showScreen('register-screen');
      setupRegistration(tgUser);
    } else {
      // Применить тему
      if (currentUser.theme === 'dark') {
        document.body.classList.add('dark');
      }
      showScreen('main-screen');
      renderPage('progress');
    }
  } catch (e) {
    console.error(e);
    showToast('Ошибка загрузки данных');
  }
}

// Показать экран
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId)?.classList.add('active');
}

// Регистрация
function setupRegistration(tgUser) {
  const form = document.getElementById('register-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      tgId: String(tgUser.id),
      username: tgUser.username || '',
      firstName: document.getElementById('reg-firstname').value,
      lastName: document.getElementById('reg-lastname').value,
      birthDate: `${document.getElementById('reg-day').value}.${document.getElementById('reg-month').value}.${document.getElementById('reg-year').value}`,
      photo: tgUser.photo_url || ''
    };

    try {
      await api.post('/api/register', data);
      currentUser = await api.get(`/api/user/${tgUser.id}`);
      showScreen('main-screen');
      renderPage('progress');
      showToast('Регистрация успешна!');
    } catch (e) {
      showToast('Ошибка регистрации');
    }
  };
}

// Навигация
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPage(btn.dataset.page);
  };
});

// Рендер страниц
function renderPage(page) {
  currentPage = page;
  const content = document.getElementById('page-content');
  
  switch(page) {
    case 'progress': content.innerHTML = renderProgressPage(); break;
    case 'topics': content.innerHTML = renderTopicsPage(); break;
    case 'diary': content.innerHTML = renderDiaryPage(); break;
    case 'settings': content.innerHTML = renderSettingsPage(); break;
  }
  
  setupPageEvents(page);
}


// Страница прогресса (дорожка с наклейками)
function renderProgressPage() {
  const stickers = currentUser?.stickers || 0;
  const threshold = settings.giftThreshold || 5;
  const stickersToGift = threshold - (stickers % threshold);
  const totalCells = 15; // 3 ряда по 5
  
  let cells = '';
  for (let i = 1; i <= totalCells; i++) {
    const isCompleted = i <= stickers;
    const isGift = i % threshold === 0;
    const isCurrent = i === stickers + 1;
    
    let classes = 'progress-cell';
    if (isCompleted) classes += ' completed';
    if (isGift && !isCompleted) classes += ' gift';
    if (isCurrent) classes += ' current';
    
    cells += `<div class="${classes}">${isGift && !isCompleted ? '🎁' : ''}</div>`;
  }

  const showGiftAlert = stickers > 0 && stickers % threshold === 0;

  return `
    <div class="progress-page">
      <h2>Моя дорожка</h2>
      <div class="stickers-info">
        Наклеек до подарка осталось: <strong>${stickersToGift}</strong>
      </div>
      <div class="progress-grid">${cells}</div>
      ${showGiftAlert ? `
        <div class="gift-alert">
          🎉 Поздравляем! Подойди к ${settings.adminUsername} за сладким подарком!
        </div>
      ` : ''}
    </div>
  `;
}

// Страница тем
function renderTopicsPage() {
  const visibleTopics = topics.filter(t => !t.isHidden);
  const currentTopics = visibleTopics.filter(t => t.isCurrent);
  const pastTopics = visibleTopics.filter(t => !t.isCurrent);
  
  const visibleHW = homework.filter(h => !h.isHidden);
  const currentHW = visibleHW.filter(h => new Date(h.dueDate) >= new Date());
  const pastHW = visibleHW.filter(h => new Date(h.dueDate) < new Date());

  return `
    <div class="topics-page">
      <h2>📚 Темы</h2>
      <div class="tabs">
        <button class="tab-btn active" data-tab="current-topics">Текущие</button>
        <button class="tab-btn" data-tab="past-topics">Пройденные</button>
      </div>
      
      <div id="current-topics" class="tab-content">
        ${currentTopics.length ? currentTopics.map(t => `
          <div class="topic-card">
            <h4>${t.title}</h4>
            <div class="date">📅 ${t.date}</div>
            <p>${t.description || ''}</p>
          </div>
        `).join('') : '<div class="empty-state"><div class="icon">📖</div><p>Нет текущих тем</p></div>'}
      </div>
      
      <div id="past-topics" class="tab-content" style="display:none">
        ${pastTopics.length ? pastTopics.map(t => `
          <div class="topic-card">
            <h4>${t.title}</h4>
            <div class="date">📅 ${t.date}</div>
            <p>${t.description || ''}</p>
          </div>
        `).join('') : '<div class="empty-state"><div class="icon">📖</div><p>Нет пройденных тем</p></div>'}
      </div>

      <div class="homework-section" style="margin-top: 30px;">
        <h3>📝 Домашние задания</h3>
        <div class="tabs">
          <button class="tab-btn hw-tab active" data-tab="current-hw">Текущие</button>
          <button class="tab-btn hw-tab" data-tab="past-hw">Прошлые</button>
        </div>
        
        <div id="current-hw" class="tab-content">
          ${currentHW.length ? currentHW.map(h => {
            const isCompleted = h.completedBy?.includes(currentUser?.tgId);
            return `
              <div class="homework-card ${isCompleted ? 'completed' : ''}">
                <h4>${h.title} ${isCompleted ? '✅' : ''}</h4>
                <div class="date">📅 До: ${h.dueDate}</div>
                <p>${h.description || ''}</p>
              </div>
            `;
          }).join('') : '<div class="empty-state"><div class="icon">✏️</div><p>Нет текущих заданий</p></div>'}
        </div>
        
        <div id="past-hw" class="tab-content" style="display:none">
          ${pastHW.length ? pastHW.map(h => {
            const isCompleted = h.completedBy?.includes(currentUser?.tgId);
            return `
              <div class="homework-card ${isCompleted ? 'completed' : ''}">
                <h4>${h.title} ${isCompleted ? '✅' : ''}</h4>
                <div class="date">📅 ${h.dueDate}</div>
                <p>${h.description || ''}</p>
              </div>
            `;
          }).join('') : '<div class="empty-state"><div class="icon">✏️</div><p>Нет прошлых заданий</p></div>'}
        </div>
      </div>
    </div>
  `;
}

// Страница дневника (профиль)
function renderDiaryPage() {
  const u = currentUser;
  return `
    <div class="diary-page">
      ${u.photo ? `<img src="${u.photo}" class="profile-photo" alt="Фото">` : 
        `<div class="profile-photo placeholder">👤</div>`}
      <h2>${u.firstName} ${u.lastName}</h2>
      ${u.username ? `<div class="username">@${u.username}</div>` : ''}
      
      <div class="stats-grid">
        <div class="stat-card stickers">
          <div class="value">${u.stickers || 0}</div>
          <div class="label">Наклеек</div>
        </div>
        <div class="stat-card absences">
          <div class="value">${u.absences || 0}</div>
          <div class="label">Пропусков</div>
        </div>
      </div>
      
      <div class="birthday-info">
        🎂 День рождения: ${u.birthDate}
      </div>
    </div>
  `;
}


// Страница настроек
function renderSettingsPage() {
  const isDark = currentUser?.theme === 'dark';
  
  return `
    <div class="settings-page">
      <h2>⚙️ Настройки</h2>
      
      <div class="setting-item">
        <label>Тёмная тема</label>
        <div class="toggle ${isDark ? 'active' : ''}" id="theme-toggle"></div>
      </div>
      
      <div class="settings-section">
        <h3>Личные данные</h3>
        <form id="edit-profile-form">
          <input type="text" id="edit-firstname" value="${currentUser?.firstName || ''}" placeholder="Имя">
          <input type="text" id="edit-lastname" value="${currentUser?.lastName || ''}" placeholder="Фамилия">
          <label>Дата рождения:</label>
          <div class="date-inputs">
            <input type="number" id="edit-day" value="${currentUser?.birthDate?.split('.')[0] || ''}" placeholder="День">
            <input type="number" id="edit-month" value="${currentUser?.birthDate?.split('.')[1] || ''}" placeholder="Месяц">
            <input type="number" id="edit-year" value="${currentUser?.birthDate?.split('.')[2] || ''}" placeholder="Год">
          </div>
          <button type="submit" class="btn-primary">Сохранить</button>
        </form>
      </div>
      
      <div class="settings-section">
        <h3>Администрирование</h3>
        <button class="admin-btn" id="admin-login-btn">
          🔐 Войти как администратор
        </button>
      </div>
    </div>
    
    <div class="admin-panel" id="admin-panel">
      ${renderAdminPanel()}
    </div>
    
    <div class="modal" id="admin-modal">
      <div class="modal-content">
        <h3>Вход для администратора</h3>
        <form id="admin-login-form">
          <input type="password" id="admin-password" placeholder="Введите пароль">
          <div class="modal-buttons">
            <button type="button" class="btn-secondary" onclick="closeModal()">Отмена</button>
            <button type="submit" class="btn-primary">Войти</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Админ панель
function renderAdminPanel() {
  return `
    <div class="admin-header">
      <h2>👑 Админ панель</h2>
      <button class="close-btn" onclick="closeAdminPanel()">✕</button>
    </div>
    
    <div class="admin-tabs">
      <button class="admin-tab active" data-admin-tab="users">Пользователи</button>
      <button class="admin-tab" data-admin-tab="topics">Темы</button>
      <button class="admin-tab" data-admin-tab="homework">ДЗ</button>
      <button class="admin-tab" data-admin-tab="settings">Настройки</button>
    </div>
    
    <div class="admin-content" id="admin-content">
      ${renderAdminUsers()}
    </div>
  `;
}

function renderAdminUsers() {
  return `
    <div class="user-list" id="user-list">
      ${allUsers.map(u => `
        <div class="user-item" data-user-id="${u.tgId}">
          ${u.photo ? `<img src="${u.photo}" alt="">` : `<div class="user-avatar-placeholder">👤</div>`}
          <div class="user-info">
            <div class="user-name">${u.firstName} ${u.lastName}</div>
            <div class="user-id">ID: ${u.tgId} ${u.username ? `@${u.username}` : ''}</div>
          </div>
          <div class="user-stats">
            <div>🏷️ ${u.stickers || 0}</div>
            <div>❌ ${u.absences || 0}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="id-input-section">
      <input type="text" id="target-user-id" placeholder="Или введите ID пользователя">
    </div>
    
    <div class="action-buttons">
      <button class="action-btn add" onclick="adminAction('addSticker')">+ Наклейка</button>
      <button class="action-btn remove" onclick="adminAction('removeSticker')">- Наклейка</button>
      <button class="action-btn add" onclick="adminAction('addAbsence')">+ Пропуск</button>
      <button class="action-btn remove" onclick="adminAction('removeAbsence')">- Пропуск</button>
    </div>
  `;
}

function renderAdminTopics() {
  return `
    <button class="btn-primary" style="margin-bottom: 20px" onclick="showAddTopicModal()">+ Добавить тему</button>
    
    <div class="topic-list">
      ${topics.map(t => `
        <div class="topic-card">
          <h4>${t.title} ${t.isHidden ? '(скрыта)' : ''} ${t.isCurrent ? '🔵' : ''}</h4>
          <div class="date">📅 ${t.date}</div>
          <p>${t.description || ''}</p>
          <div class="action-buttons" style="margin-top: 10px">
            <button class="action-btn edit" onclick="toggleTopicCurrent('${t.id}')">${t.isCurrent ? 'Пройдена' : 'Текущая'}</button>
            <button class="action-btn ${t.isHidden ? 'add' : 'remove'}" onclick="toggleTopicHidden('${t.id}')">${t.isHidden ? 'Показать' : 'Скрыть'}</button>
            <button class="action-btn remove" onclick="deleteTopic('${t.id}')">Удалить</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="modal" id="topic-modal">
      <div class="modal-content">
        <h3>Добавить тему</h3>
        <form id="add-topic-form">
          <input type="text" id="topic-title" placeholder="Название темы" required>
          <input type="date" id="topic-date" required>
          <textarea id="topic-desc" placeholder="Описание" rows="3"></textarea>
          <label><input type="checkbox" id="topic-current"> Текущая тема</label>
          <div class="modal-buttons">
            <button type="button" class="btn-secondary" onclick="closeTopicModal()">Отмена</button>
            <button type="submit" class="btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderAdminHomework() {
  return `
    <button class="btn-primary" style="margin-bottom: 20px" onclick="showAddHWModal()">+ Добавить ДЗ</button>
    
    <div class="homework-list">
      ${homework.map(h => `
        <div class="homework-card">
          <h4>${h.title} ${h.isHidden ? '(скрыто)' : ''}</h4>
          <div class="date">📅 До: ${h.dueDate}</div>
          <p>${h.description || ''}</p>
          <div class="date">Выполнили: ${h.completedBy?.length || 0} чел.</div>
          <div class="action-buttons" style="margin-top: 10px">
            <button class="action-btn edit" onclick="showMarkHWModal('${h.id}')">Отметить</button>
            <button class="action-btn ${h.isHidden ? 'add' : 'remove'}" onclick="toggleHWHidden('${h.id}')">${h.isHidden ? 'Показать' : 'Скрыть'}</button>
            <button class="action-btn remove" onclick="deleteHW('${h.id}')">Удалить</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="modal" id="hw-modal">
      <div class="modal-content">
        <h3>Добавить ДЗ</h3>
        <form id="add-hw-form">
          <input type="text" id="hw-title" placeholder="Название" required>
          <input type="date" id="hw-date" required>
          <textarea id="hw-desc" placeholder="Описание" rows="3"></textarea>
          <div class="modal-buttons">
            <button type="button" class="btn-secondary" onclick="closeHWModal()">Отмена</button>
            <button type="submit" class="btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    </div>
    
    <div class="modal" id="mark-hw-modal">
      <div class="modal-content">
        <h3>Отметить выполнение</h3>
        <div class="user-list" id="hw-user-list"></div>
        <div class="modal-buttons">
          <button class="btn-secondary" onclick="closeMarkHWModal()">Закрыть</button>
        </div>
      </div>
    </div>
  `;
}

function renderAdminSettings() {
  return `
    <form id="admin-settings-form">
      <label>Username админа (для уведомлений о подарках):</label>
      <input type="text" id="admin-username" value="${settings.adminUsername || ''}" placeholder="@username">
      
      <label>Наклеек до подарка:</label>
      <input type="number" id="gift-threshold" value="${settings.giftThreshold || 5}" min="1">
      
      <button type="submit" class="btn-primary">Сохранить настройки</button>
    </form>
  `;
}


// События страниц
function setupPageEvents(page) {
  if (page === 'topics') {
    // Табы тем
    document.querySelectorAll('.tab-btn:not(.hw-tab)').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn:not(.hw-tab)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => {
          if (c.id === 'current-topics' || c.id === 'past-topics') c.style.display = 'none';
        });
        document.getElementById(btn.dataset.tab).style.display = 'block';
      };
    });
    
    // Табы ДЗ
    document.querySelectorAll('.hw-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.hw-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('current-hw').style.display = 'none';
        document.getElementById('past-hw').style.display = 'none';
        document.getElementById(btn.dataset.tab).style.display = 'block';
      };
    });
  }
  
  if (page === 'settings') {
    // Переключатель темы
    document.getElementById('theme-toggle')?.addEventListener('click', async function() {
      this.classList.toggle('active');
      const isDark = this.classList.contains('active');
      document.body.classList.toggle('dark', isDark);
      
      await api.put(`/api/user/${currentUser.tgId}`, { theme: isDark ? 'dark' : 'light' });
      currentUser.theme = isDark ? 'dark' : 'light';
    });
    
    // Форма редактирования профиля
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        firstName: document.getElementById('edit-firstname').value,
        lastName: document.getElementById('edit-lastname').value,
        birthDate: `${document.getElementById('edit-day').value}.${document.getElementById('edit-month').value}.${document.getElementById('edit-year').value}`
      };
      
      await api.put(`/api/user/${currentUser.tgId}`, data);
      currentUser = { ...currentUser, ...data };
      showToast('Данные сохранены');
    });
    
    // Кнопка входа админа
    document.getElementById('admin-login-btn')?.addEventListener('click', () => {
      if (currentUser?.isAdmin) {
        openAdminPanel();
      } else {
        document.getElementById('admin-modal').classList.add('active');
      }
    });
    
    // Форма входа админа
    document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('admin-password').value;
      
      if (password === 'login12AsXristian') {
        await api.put(`/api/user/${currentUser.tgId}`, { isAdmin: true });
        currentUser.isAdmin = true;
        closeModal();
        openAdminPanel();
        showToast('Вы вошли как администратор');
      } else {
        showToast('Неверный пароль');
      }
    });
    
    // Табы админки
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.onclick = async () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const content = document.getElementById('admin-content');
        switch(tab.dataset.adminTab) {
          case 'users': content.innerHTML = renderAdminUsers(); setupAdminUserEvents(); break;
          case 'topics': content.innerHTML = renderAdminTopics(); setupAdminTopicEvents(); break;
          case 'homework': content.innerHTML = renderAdminHomework(); setupAdminHWEvents(); break;
          case 'settings': content.innerHTML = renderAdminSettings(); setupAdminSettingsEvents(); break;
        }
      };
    });
  }
}

// Админ функции
let selectedUserId = null;

async function openAdminPanel() {
  allUsers = await api.get('/api/users');
  document.getElementById('admin-panel').classList.add('active');
  document.getElementById('admin-content').innerHTML = renderAdminUsers();
  setupAdminUserEvents();
}

function closeAdminPanel() {
  document.getElementById('admin-panel').classList.remove('active');
}

function closeModal() {
  document.getElementById('admin-modal').classList.remove('active');
}

function setupAdminUserEvents() {
  document.querySelectorAll('.user-item').forEach(item => {
    item.onclick = () => {
      document.querySelectorAll('.user-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedUserId = item.dataset.userId;
      document.getElementById('target-user-id').value = selectedUserId;
    };
  });
}

async function adminAction(action) {
  const targetId = document.getElementById('target-user-id')?.value || selectedUserId;
  if (!targetId) {
    showToast('Выберите пользователя');
    return;
  }
  
  const user = allUsers.find(u => u.tgId === targetId);
  if (!user) {
    showToast('Пользователь не найден');
    return;
  }
  
  let update = {};
  switch(action) {
    case 'addSticker': update.stickers = (user.stickers || 0) + 1; break;
    case 'removeSticker': update.stickers = Math.max(0, (user.stickers || 0) - 1); break;
    case 'addAbsence': update.absences = (user.absences || 0) + 1; break;
    case 'removeAbsence': update.absences = Math.max(0, (user.absences || 0) - 1); break;
  }
  
  await api.put(`/api/user/${targetId}`, update);
  allUsers = await api.get('/api/users');
  
  if (targetId === currentUser.tgId) {
    currentUser = { ...currentUser, ...update };
  }
  
  document.getElementById('admin-content').innerHTML = renderAdminUsers();
  setupAdminUserEvents();
  showToast('Обновлено');
}


// Админ - Темы
function setupAdminTopicEvents() {
  document.getElementById('add-topic-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.post('/api/topics', {
      title: document.getElementById('topic-title').value,
      date: document.getElementById('topic-date').value,
      description: document.getElementById('topic-desc').value,
      isCurrent: document.getElementById('topic-current').checked
    });
    topics = await api.get('/api/topics');
    closeTopicModal();
    document.getElementById('admin-content').innerHTML = renderAdminTopics();
    setupAdminTopicEvents();
    showToast('Тема добавлена');
  });
}

function showAddTopicModal() {
  document.getElementById('topic-modal').classList.add('active');
}

function closeTopicModal() {
  document.getElementById('topic-modal').classList.remove('active');
}

async function toggleTopicCurrent(id) {
  const topic = topics.find(t => t.id === id);
  await api.put(`/api/topics/${id}`, { isCurrent: !topic.isCurrent });
  topics = await api.get('/api/topics');
  document.getElementById('admin-content').innerHTML = renderAdminTopics();
  setupAdminTopicEvents();
}

async function toggleTopicHidden(id) {
  const topic = topics.find(t => t.id === id);
  await api.put(`/api/topics/${id}`, { isHidden: !topic.isHidden });
  topics = await api.get('/api/topics');
  document.getElementById('admin-content').innerHTML = renderAdminTopics();
  setupAdminTopicEvents();
}

async function deleteTopic(id) {
  if (confirm('Удалить тему?')) {
    await api.delete(`/api/topics/${id}`);
    topics = await api.get('/api/topics');
    document.getElementById('admin-content').innerHTML = renderAdminTopics();
    setupAdminTopicEvents();
    showToast('Тема удалена');
  }
}

// Админ - ДЗ
function setupAdminHWEvents() {
  document.getElementById('add-hw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.post('/api/homework', {
      title: document.getElementById('hw-title').value,
      dueDate: document.getElementById('hw-date').value,
      description: document.getElementById('hw-desc').value
    });
    homework = await api.get('/api/homework');
    closeHWModal();
    document.getElementById('admin-content').innerHTML = renderAdminHomework();
    setupAdminHWEvents();
    showToast('ДЗ добавлено');
  });
}

function showAddHWModal() {
  document.getElementById('hw-modal').classList.add('active');
}

function closeHWModal() {
  document.getElementById('hw-modal').classList.remove('active');
}

async function toggleHWHidden(id) {
  const hw = homework.find(h => h.id === id);
  await api.put(`/api/homework/${id}`, { isHidden: !hw.isHidden });
  homework = await api.get('/api/homework');
  document.getElementById('admin-content').innerHTML = renderAdminHomework();
  setupAdminHWEvents();
}

async function deleteHW(id) {
  if (confirm('Удалить ДЗ?')) {
    await api.delete(`/api/homework/${id}`);
    homework = await api.get('/api/homework');
    document.getElementById('admin-content').innerHTML = renderAdminHomework();
    setupAdminHWEvents();
    showToast('ДЗ удалено');
  }
}

let currentHWId = null;

function showMarkHWModal(hwId) {
  currentHWId = hwId;
  const hw = homework.find(h => h.id === hwId);
  const userList = document.getElementById('hw-user-list');
  
  userList.innerHTML = allUsers.map(u => {
    const isCompleted = hw.completedBy?.includes(u.tgId);
    return `
      <div class="user-item ${isCompleted ? 'selected' : ''}" onclick="toggleHWCompletion('${u.tgId}')">
        ${u.photo ? `<img src="${u.photo}" alt="">` : `<div class="user-avatar-placeholder">👤</div>`}
        <div class="user-info">
          <div class="user-name">${u.firstName} ${u.lastName}</div>
        </div>
        <div>${isCompleted ? '✅' : '⬜'}</div>
      </div>
    `;
  }).join('');
  
  document.getElementById('mark-hw-modal').classList.add('active');
}

function closeMarkHWModal() {
  document.getElementById('mark-hw-modal').classList.remove('active');
}

async function toggleHWCompletion(userId) {
  const hw = homework.find(h => h.id === currentHWId);
  let completedBy = hw.completedBy || [];
  
  if (completedBy.includes(userId)) {
    completedBy = completedBy.filter(id => id !== userId);
  } else {
    completedBy.push(userId);
  }
  
  await api.put(`/api/homework/${currentHWId}`, { completedBy });
  homework = await api.get('/api/homework');
  showMarkHWModal(currentHWId);
}

// Админ - Настройки
function setupAdminSettingsEvents() {
  document.getElementById('admin-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.put('/api/settings', {
      adminUsername: document.getElementById('admin-username').value,
      giftThreshold: parseInt(document.getElementById('gift-threshold').value)
    });
    settings = await api.get('/api/settings');
    showToast('Настройки сохранены');
  });
}

// Уведомления
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Запуск
init();
