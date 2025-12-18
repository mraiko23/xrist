// Telegram Web App
const tg = window.Telegram?.WebApp;

// Состояние
let currentUser = null;
let allUsers = [];
let topics = [];
let homework = [];
let submissions = [];
let settings = { adminUsername: '@admin', giftThreshold: 5 };
let tgUser = null;

// API
const api = {
  async get(url) { 
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return { error: `HTTP ${res.status}` };
      }
      return res.json();
    } catch (e) {
      console.error('API GET error:', e);
      return { error: e.message };
    }
  },
  async post(url, data) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('API POST failed:', res.status, text);
        return { error: `Ошибка сервера (${res.status})` };
      }
      return res.json();
    } catch (e) {
      console.error('API POST error:', e);
      return { error: e.message };
    }
  },
  async put(url, data) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        return { error: `HTTP ${res.status}` };
      }
      return res.json();
    } catch (e) {
      console.error('API PUT error:', e);
      return { error: e.message };
    }
  },
  async delete(url) { 
    try {
      const res = await fetch(url, { method: 'DELETE' });
      return res.json();
    } catch (e) {
      console.error('API DELETE error:', e);
      return { error: e.message };
    }
  }
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
    [settings, topics, homework, submissions] = await Promise.all([
      api.get('/api/settings').catch(() => ({ adminUsername: '@admin', giftThreshold: 5 })),
      api.get('/api/topics').catch(() => []),
      api.get('/api/homework').catch(() => []),
      api.get('/api/submissions').catch(() => [])
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
    
    if (result.error) {
      showToast(result.error);
      return;
    }
    if (result.success) {
      currentUser = await api.get(`/api/user/${tgUser.id}`);
      showScreen('main-screen');
      setupNav();
      renderPage('progress');
      showToast('Добро пожаловать! 🎉');
    } else {
      showToast(result.message || 'Ошибка регистрации');
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
    case 'progress': c.innerHTML = renderProgress(); setupInfiniteRoad(); break;
    case 'topics': c.innerHTML = renderTopics(); setupTabs(); break;
    case 'pet': c.innerHTML = renderPet(); setupPetEvents(); break;
    case 'diary': c.innerHTML = renderDiary(); break;
    case 'settings': c.innerHTML = renderSettings(); setupSettingsEvents(); break;
  }
}


// === СТРАНИЦЫ ===

let loadedSteps = 0;
let isLoadingMore = false;

function renderProgress() {
  const stickers = currentUser?.stickers || 0;
  const threshold = settings.giftThreshold || 5;
  const toGift = threshold - (stickers % threshold);
  const showAlert = stickers > 0 && stickers % threshold === 0;
  
  // Начальное количество шагов
  loadedSteps = Math.max(stickers + 10, 20);

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
      
      <div class="road-container" id="road-container">
        <div class="road" id="road">${generateRoadItems(1, loadedSteps)}</div>
        <div class="load-more" id="load-more">
          <div class="load-spinner"></div>
        </div>
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

// Генерация шагов дорожки
function generateRoadItems(from, to) {
  const stickers = currentUser?.stickers || 0;
  const threshold = settings.giftThreshold || 5;
  let html = '';
  
  for (let i = from; i <= to; i++) {
    const done = i <= stickers;
    const isCurrent = i === stickers + 1;
    const isGift = i % threshold === 0;
    
    let circleClass = 'step-circle';
    if (done) circleClass += ' done';
    if (isCurrent) circleClass += ' current';
    if (isGift) circleClass += ' gift';
    
    const label = isGift ? `<span class="gift-label">🎁 Подарок!</span>` : `Шаг ${i}`;
    
    html += `
      <div class="road-item" data-step="${i}">
        <div class="${circleClass}">${!done && !isGift ? i : ''}</div>
        <div class="step-info">
          <div class="step-num">#${i}</div>
          <div class="step-label">${label}</div>
        </div>
      </div>
    `;
  }
  return html;
}

// Бесконечная подгрузка
function setupInfiniteRoad() {
  const container = document.getElementById('road-container');
  if (!container) return;
  
  container.addEventListener('scroll', () => {
    if (isLoadingMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Если доскроллили почти до конца
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMoreSteps();
    }
  });
  
  // Прокрутить к текущему шагу
  setTimeout(() => {
    const currentStep = document.querySelector('.step-circle.current');
    if (currentStep) {
      currentStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 300);
}

function loadMoreSteps() {
  isLoadingMore = true;
  const loader = document.getElementById('load-more');
  if (loader) loader.style.display = 'flex';
  
  // Имитация загрузки
  setTimeout(() => {
    const road = document.getElementById('road');
    const newFrom = loadedSteps + 1;
    const newTo = loadedSteps + 15;
    
    road.insertAdjacentHTML('beforeend', generateRoadItems(newFrom, newTo));
    loadedSteps = newTo;
    
    if (loader) loader.style.display = 'none';
    isLoadingMore = false;
  }, 300);
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
    const dataAttr = type === 'hw' ? `data-hw-id="${t.id}"` : `data-topic-id="${t.id}"`;
    return `
      <div class="${type === 'hw' ? 'homework-card clickable' : 'topic-card clickable'} ${isDone ? 'completed' : ''}" ${dataAttr}>
        <h4>${isDone ? '✅ ' : ''}${t.title}</h4>
        <div class="date">📅 ${t.date || t.dueDate}</div>
        ${t.description ? `<p class="preview">${t.description.substring(0, 50)}${t.description.length > 50 ? '...' : ''}</p>` : ''}
        <div class="tap-hint">Нажми для подробностей →</div>
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
    
    <!-- Модалка подробностей -->
    <div class="detail-modal" id="detail-modal">
      <div class="detail-content">
        <button class="detail-close" id="detail-close">✕</button>
        <div id="detail-body"></div>
      </div>
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
  
  // Клик на темы
  document.querySelectorAll('[data-topic-id]').forEach(el => {
    el.onclick = () => showTopicDetail(el.dataset.topicId);
  });
  
  // Клик на ДЗ
  document.querySelectorAll('[data-hw-id]').forEach(el => {
    el.onclick = () => showHWDetail(el.dataset.hwId);
  });
  
  // Закрыть модалку
  document.getElementById('detail-close')?.addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeDetailModal();
  });
}

function showTopicDetail(id) {
  const t = topics.find(x => x.id === id);
  if (!t) return;
  
  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <div class="detail-icon">📚</div>
    <div class="detail-badge ${t.isCurrent ? 'current' : 'past'}">${t.isCurrent ? 'Текущая тема' : 'Пройденная тема'}</div>
    <h2 class="detail-title">${t.title}</h2>
    <div class="detail-date">
      <span>📅</span>
      <span>${t.date}</span>
    </div>
    ${t.description ? `
      <div class="detail-section">
        <h3>Описание</h3>
        <p>${t.description}</p>
      </div>
    ` : ''}
    <div class="detail-section">
      <h3>Что изучаем</h3>
      <p>На этом занятии мы разбираем тему "${t.title}". Внимательно слушай и задавай вопросы!</p>
    </div>
  `;
  
  document.getElementById('detail-modal').classList.add('active');
}

function showHWDetail(id) {
  const h = homework.find(x => x.id === id);
  if (!h) return;
  
  const isDone = (h.completedBy || []).includes(currentUser?.tgId);
  const mySubmission = submissions.find(s => s.hwId === id && s.tgId === currentUser?.tgId);
  const dueDate = new Date(h.dueDate);
  const now = new Date();
  const isOverdue = dueDate < now && !isDone;
  const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  
  let statusBadge = '';
  let statusText = '';
  if (isDone) {
    statusBadge = 'done';
    statusText = 'Выполнено!';
  } else if (mySubmission) {
    if (mySubmission.status === 'pending') {
      statusBadge = 'pending';
      statusText = '⏳ На проверке';
    } else if (mySubmission.status === 'rejected') {
      statusBadge = 'overdue';
      statusText = '❌ Отклонено';
    }
  } else if (isOverdue) {
    statusBadge = 'overdue';
    statusText = 'Просрочено';
  } else {
    statusBadge = 'pending';
    statusText = `Осталось ${daysLeft} дн.`;
  }
  
  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <div class="detail-icon">${isDone ? '✅' : mySubmission?.status === 'pending' ? '⏳' : '📝'}</div>
    <div class="detail-badge ${statusBadge}">${statusText}</div>
    <h2 class="detail-title">${h.title}</h2>
    <div class="detail-date">
      <span>📅</span>
      <span>Сдать до: ${h.dueDate}</span>
    </div>
    ${h.description ? `
      <div class="detail-section">
        <h3>📋 Задание</h3>
        <p>${h.description}</p>
      </div>
    ` : ''}
    ${!isDone && (!mySubmission || mySubmission.status === 'rejected') ? `
      <div class="detail-section submit-section">
        <h3>📤 Отправить на проверку</h3>
        <form id="submit-hw-form" data-hw-id="${h.id}" data-hw-title="${h.title}">
          <div class="media-upload">
            <label class="upload-btn" for="hw-media">
              <span id="media-preview-text">📷 Прикрепить фото/видео</span>
            </label>
            <input type="file" id="hw-media" accept="image/*,video/*" multiple style="display:none">
            <div id="media-preview" class="media-preview"></div>
            <div class="upload-hint">Можно выбрать несколько файлов</div>
          </div>
          <textarea id="hw-comment" placeholder="Комментарий (необязательно)" rows="2"></textarea>
          <button type="submit" class="btn btn-primary">📤 Отправить</button>
        </form>
      </div>
    ` : ''}
    ${mySubmission && mySubmission.status === 'rejected' ? `
      <div class="detail-section rejection-info">
        <h3>❌ Причина отклонения</h3>
        <p>${mySubmission.rejectReason || 'Не указана'}</p>
      </div>
    ` : ''}
    <div class="detail-section">
      <h3>💡 Подсказка</h3>
      <p>Если возникли вопросы, обратись к преподавателю или напиши ${settings.adminUsername}</p>
    </div>
    <div class="detail-stats">
      <div class="detail-stat">
        <span class="num">${(h.completedBy || []).length}</span>
        <span class="label">выполнили</span>
      </div>
    </div>
  `;
  
  document.getElementById('detail-modal').classList.add('active');
  
  // Обработчики формы отправки
  const form = document.getElementById('submit-hw-form');
  const mediaInput = document.getElementById('hw-media');
  
  if (mediaInput) {
    mediaInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      const preview = document.getElementById('media-preview');
      preview.innerHTML = '';
      
      if (files.length > 0) {
        // Проверяем размер
        const MAX_FILE_SIZE = 20 * 1024 * 1024;
        let hasLargeFile = false;
        let totalSize = 0;
        
        files.forEach(f => {
          totalSize += f.size;
          if (f.size > MAX_FILE_SIZE) hasLargeFile = true;
        });
        
        const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
        const sizeWarning = totalSize > 50 * 1024 * 1024 || hasLargeFile;
        
        document.getElementById('media-preview-text').textContent = 
          `✅ Выбрано: ${files.length} файл(ов) (${sizeMB}MB)${sizeWarning ? ' ⚠️' : ''}`;
        
        if (sizeWarning) {
          preview.innerHTML = '<div class="size-warning">⚠️ Файлы слишком большие! Макс: 20MB на файл, 50MB всего</div>';
        }
        
        files.forEach((file, idx) => {
          const isVideo = file.type.startsWith('video/');
          // Для превью используем URL.createObjectURL вместо base64 (быстрее)
          const objectUrl = URL.createObjectURL(file);
          if (isVideo) {
            preview.innerHTML += `<div class="preview-item video"><video src="${objectUrl}"></video></div>`;
          } else {
            preview.innerHTML += `<div class="preview-item"><img src="${objectUrl}" alt="preview"></div>`;
          }
        });
      }
    });
  }
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hwId = form.dataset.hwId;
      const hwTitle = form.dataset.hwTitle;
      const comment = document.getElementById('hw-comment')?.value || '';
      const files = mediaInput?.files ? Array.from(mediaInput.files) : [];
      
      // Проверка размера файлов (макс 20MB на файл, 50MB всего)
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
      const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
      let totalSize = 0;
      
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          showToast(`Файл "${file.name}" слишком большой (макс 20MB)`);
          return;
        }
        totalSize += file.size;
      }
      
      if (totalSize > MAX_TOTAL_SIZE) {
        showToast('Общий размер файлов слишком большой (макс 50MB)');
        return;
      }
      
      // Показываем загрузку
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '⏳ Загрузка...';
      submitBtn.disabled = true;
      
      try {
        // Конвертируем все файлы в base64
        const mediaData = [];
        for (const file of files) {
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve({
              data: ev.target.result,
              type: file.type.startsWith('video/') ? 'video' : 'image',
              name: file.name
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          mediaData.push(data);
        }
        
        const result = await api.post('/api/submissions', {
          hwId,
          hwTitle,
          tgId: currentUser.tgId,
          userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
          media: mediaData,
          comment
        });
        
        if (result.success) {
          submissions = await api.get('/api/submissions');
          closeDetailModal();
          showToast('Отправлено на проверку! ✅');
          renderPage('topics');
        } else {
          showToast(result.error || 'Ошибка отправки');
        }
      } catch (err) {
        console.error('Submit error:', err);
        showToast('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal')?.classList.remove('active');
}

// ===== ПИТОМЕЦ (ТАМАГОЧИ) =====
const PET_ANIMALS = [
  { id: 'elephant', emoji: '🐘', name: 'Слонёнок' },
  { id: 'cat', emoji: '🐱', name: 'Котёнок' },
  { id: 'dog', emoji: '🐶', name: 'Щенок' },
  { id: 'rabbit', emoji: '🐰', name: 'Зайчик' },
  { id: 'bear', emoji: '🐻', name: 'Мишка' },
  { id: 'panda', emoji: '🐼', name: 'Панда' },
  { id: 'fox', emoji: '🦊', name: 'Лисёнок' },
  { id: 'lion', emoji: '🦁', name: 'Львёнок' },
  { id: 'monkey', emoji: '🐵', name: 'Обезьянка' },
  { id: 'penguin', emoji: '🐧', name: 'Пингвин' },
  { id: 'chick', emoji: '🐥', name: 'Цыплёнок' },
  { id: 'frog', emoji: '🐸', name: 'Лягушонок' }
];

const PET_TASKS = [
  { id: 'feed', emoji: '🍎', text: 'Покорми меня!', action: 'Покормить' },
  { id: 'play', emoji: '⚽', text: 'Поиграй со мной!', action: 'Поиграть' },
  { id: 'sleep', emoji: '😴', text: 'Уложи меня спать!', action: 'Уложить' },
  { id: 'wash', emoji: '🛁', text: 'Помой меня!', action: 'Помыть' },
  { id: 'pet', emoji: '💕', text: 'Погладь меня!', action: 'Погладить' },
  { id: 'walk', emoji: '🚶', text: 'Погуляй со мной!', action: 'Погулять' }
];

const PET_PHRASES = [
  '💭 Как дела?',
  '💭 Ты мой лучший друг!',
  '💭 Мне так хорошо с тобой!',
  '💭 Давай играть!',
  '💭 Я тебя люблю!',
  '💭 Ты самый лучший!',
  '💭 Мур-мур...',
  '💭 Хочу обнимашки!',
  '💭 Ты сегодня красивый!',
  '💭 Скучал по тебе!',
  '💭 Ура, ты пришёл!',
  '💭 Давай веселиться!',
  '💭 Ты мой герой!',
  '💭 Спасибо что заботишься!',
  '💭 Мне повезло с тобой!'
];

function getPetData() {
  return currentUser?.pet || null;
}

function renderPet() {
  const pet = getPetData();
  
  if (!pet || pet.isDead) {
    return renderPetCreate(pet?.isDead);
  }
  
  return renderPetAlive(pet);
}

function renderPetCreate(wasDead = false) {
  return `
    <div class="pet-page">
      <div class="pet-create-card">
        <div class="pet-create-icon">${wasDead ? '😢' : '🥚'}</div>
        <h2>${wasDead ? 'Твой питомец погиб...' : 'Заведи питомца!'}</h2>
        <p>${wasDead ? 'Но ты можешь завести нового друга!' : 'Выбери себе милого друга и заботься о нём каждый день!'}</p>
        
        <div class="pet-select-grid">
          ${PET_ANIMALS.map(a => `
            <div class="pet-select-item" data-pet-id="${a.id}">
              <span class="pet-select-emoji">${a.emoji}</span>
              <span class="pet-select-name">${a.name}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="pet-name-input" style="display:none">
          <input type="text" id="pet-name" placeholder="Имя питомца" maxlength="20">
          <button class="btn btn-primary" id="create-pet-btn">Создать! 🎉</button>
        </div>
      </div>
    </div>
  `;
}

function renderPetAlive(pet) {
  const animal = PET_ANIMALS.find(a => a.id === pet.animalId) || PET_ANIMALS[0];
  const task = pet.currentTask ? PET_TASKS.find(t => t.id === pet.currentTask.taskId) : null;
  const phrase = getRandomPhrase(pet);
  const timeLeft = task ? getTaskTimeLeft(pet.currentTask) : null;
  const isUrgent = timeLeft && timeLeft.hours < 1;
  
  // Определяем состояние питомца
  let petState = 'idle';
  let stateEmoji = '';
  if (pet.lastAction) {
    const timeSinceAction = Date.now() - new Date(pet.lastAction.time).getTime();
    if (timeSinceAction < 3000) {
      petState = pet.lastAction.type;
      if (petState === 'feed') stateEmoji = '😋';
      else if (petState === 'play') stateEmoji = '🎉';
      else if (petState === 'sleep') stateEmoji = '😴';
      else if (petState === 'wash') stateEmoji = '✨';
      else if (petState === 'pet') stateEmoji = '🥰';
      else if (petState === 'walk') stateEmoji = '🏃';
    }
  }
  
  return `
    <div class="pet-page">
      <div class="pet-card">
        <div class="pet-header">
          <div class="pet-name-display">${pet.name}</div>
          <div class="pet-streak">🔥 ${pet.streak || 0} дней</div>
        </div>
        
        <div class="pet-container">
          <div class="pet-phrase ${phrase ? 'show' : ''}">${phrase || ''}</div>
          <div class="pet-avatar ${petState !== 'idle' ? 'pet-action-' + petState : ''}" id="pet-avatar">
            ${animal.emoji}
            ${stateEmoji ? `<span class="pet-state-emoji">${stateEmoji}</span>` : ''}
          </div>
          <div class="pet-shadow"></div>
        </div>
        
        <div class="pet-mood-bar">
          <div class="mood-icons">
            <span>🍎</span>
            <span>⚽</span>
            <span>😴</span>
            <span>💕</span>
          </div>
        </div>
        
        ${task ? `
          <div class="pet-task ${isUrgent ? 'urgent' : ''}">
            <div class="task-icon">${task.emoji}</div>
            <div class="task-info">
              <div class="task-text">${task.text}</div>
              <div class="task-timer ${isUrgent ? 'urgent' : ''}">
                ⏰ ${timeLeft ? `${timeLeft.hours}ч ${timeLeft.minutes}м` : 'Время вышло!'}
              </div>
            </div>
            <button class="task-btn" id="complete-task-btn">${task.action}</button>
          </div>
        ` : `
          <div class="pet-happy">
            <span>😊</span>
            <span>Питомец доволен!</span>
          </div>
        `}
        
        <div class="pet-actions">
          <button class="pet-action-btn" data-action="feed">🍎</button>
          <button class="pet-action-btn" data-action="play">⚽</button>
          <button class="pet-action-btn" data-action="sleep">😴</button>
          <button class="pet-action-btn" data-action="pet">💕</button>
        </div>
      </div>
    </div>
  `;
}

function getRandomPhrase(pet) {
  // Показываем фразу с вероятностью 30%
  if (Math.random() > 0.3) return null;
  return PET_PHRASES[Math.floor(Math.random() * PET_PHRASES.length)];
}

function getTaskTimeLeft(task) {
  if (!task || !task.deadline) return null;
  const deadline = new Date(task.deadline).getTime();
  const now = Date.now();
  const diff = deadline - now;
  
  if (diff <= 0) return null;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
}

let selectedPetId = null;

function setupPetEvents() {
  // Выбор питомца
  document.querySelectorAll('.pet-select-item').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.pet-select-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedPetId = el.dataset.petId;
      document.querySelector('.pet-name-input').style.display = 'block';
      document.getElementById('pet-name').focus();
    };
  });
  
  // Создание питомца
  document.getElementById('create-pet-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('pet-name').value.trim();
    if (!selectedPetId) { showToast('Выбери питомца!'); return; }
    if (!name) { showToast('Введи имя!'); return; }
    
    const pet = {
      animalId: selectedPetId,
      name: name,
      createdAt: new Date().toISOString(),
      streak: 0,
      lastTaskDate: null,
      currentTask: null,
      isDead: false,
      lastAction: null
    };
    
    await api.put(`/api/user/${currentUser.tgId}`, { pet });
    currentUser.pet = pet;
    showToast(`${name} теперь твой друг! 🎉`);
    renderPage('pet');
  });
  
  // Выполнение задачи
  document.getElementById('complete-task-btn')?.addEventListener('click', async () => {
    const pet = getPetData();
    if (!pet || !pet.currentTask) return;
    
    const task = PET_TASKS.find(t => t.id === pet.currentTask.taskId);
    
    // Анимация
    pet.lastAction = { type: pet.currentTask.taskId, time: new Date().toISOString() };
    pet.currentTask = null;
    pet.tasksCompletedToday = (pet.tasksCompletedToday || 0) + 1;
    
    // Обновляем streak если это первая задача за день
    const today = new Date().toDateString();
    if (pet.lastTaskDate !== today) {
      pet.streak = (pet.streak || 0) + 1;
      pet.lastTaskDate = today;
      pet.tasksCompletedToday = 1;
    }
    
    await api.put(`/api/user/${currentUser.tgId}`, { pet });
    currentUser.pet = pet;
    
    showToast(`${task?.action || 'Выполнено'}! 🎉`);
    renderPage('pet');
  });
  
  // Действия с питомцем (просто анимации)
  document.querySelectorAll('.pet-action-btn').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      const pet = getPetData();
      if (!pet) return;
      
      pet.lastAction = { type: action, time: new Date().toISOString() };
      currentUser.pet = pet;
      
      // Перерисовываем для анимации
      renderPage('pet');
      
      const messages = {
        feed: 'Ням-ням! 😋',
        play: 'Ура, играем! 🎉',
        sleep: 'Баю-бай... 😴',
        pet: 'Мур-мур! 🥰'
      };
      showToast(messages[action] || '💕');
    };
  });
  
  // Проверяем нужна ли новая задача
  checkPetTask();
}

async function checkPetTask() {
  const pet = getPetData();
  if (!pet || pet.isDead) return;
  
  // Проверяем не истекла ли текущая задача
  if (pet.currentTask) {
    const timeLeft = getTaskTimeLeft(pet.currentTask);
    if (!timeLeft) {
      // Питомец погиб!
      pet.isDead = true;
      pet.diedAt = new Date().toISOString();
      await api.put(`/api/user/${currentUser.tgId}`, { pet });
      currentUser.pet = pet;
      showToast('😢 Твой питомец погиб...');
      renderPage('pet');
      return;
    }
  }
  
  // Проверяем нужна ли новая задача (с 4:00 до 18:00 МСК)
  const now = new Date();
  const mskHour = (now.getUTCHours() + 3) % 24;
  
  if (mskHour >= 4 && mskHour < 18) {
    const today = now.toDateString();
    const tasksToday = pet.tasksCompletedToday || 0;
    
    // Максимум 4 задачи в день
    if (!pet.currentTask && tasksToday < 4) {
      // Проверяем прошло ли достаточно времени с последней задачи
      const lastTaskTime = pet.lastTaskGeneratedAt ? new Date(pet.lastTaskGeneratedAt).getTime() : 0;
      const hoursSinceLastTask = (Date.now() - lastTaskTime) / (1000 * 60 * 60);
      
      // Генерируем задачу с вероятностью, зависящей от времени
      if (hoursSinceLastTask > 2 || Math.random() < 0.1) {
        const randomTask = PET_TASKS[Math.floor(Math.random() * PET_TASKS.length)];
        const deadline = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 часа
        
        pet.currentTask = {
          taskId: randomTask.id,
          createdAt: new Date().toISOString(),
          deadline: deadline.toISOString()
        };
        pet.lastTaskGeneratedAt = new Date().toISOString();
        
        // Сбрасываем счетчик если новый день
        if (pet.lastTaskDate !== today) {
          pet.tasksCompletedToday = 0;
        }
        
        await api.put(`/api/user/${currentUser.tgId}`, { pet });
        currentUser.pet = pet;
        renderPage('pet');
      }
    }
  }
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
  submissions = await api.get('/api/submissions');
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
      <button class="admin-tab ${adminTab === 'submissions' ? 'active' : ''}" data-tab="submissions">📥 Заявки</button>
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
    case 'submissions': return renderSubmissions();
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
    case 'submissions': setupSubmissionEvents(); break;
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
      <button class="action-btn ${selectedUser && allUsers.find(u => String(u.tgId) === String(selectedUser))?.isBlocked ? 'add' : 'remove'}" data-act="block">
        ${selectedUser && allUsers.find(u => String(u.tgId) === String(selectedUser))?.isBlocked ? '✓Разбан' : '🚫Бан'}
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
      const user = allUsers.find(u => String(u.tgId) === String(selectedUser));
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
      const user = allUsers.find(u => String(u.tgId) === String(id));
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
  const now = new Date();
  const currentHW = (homework || []).filter(h => new Date(h.dueDate) >= now);
  const pastHW = (homework || []).filter(h => new Date(h.dueDate) < now);
  
  const renderHWCard = (h) => {
    const isPast = new Date(h.dueDate) < now;
    return `
      <div class="homework-card ${isPast ? 'past-hw' : ''}">
        <h4>${h.title} ${h.isHidden ? '👁️‍🗨️' : ''} ${isPast ? '⏰' : ''}</h4>
        <div class="date">📅 ${h.dueDate} | ✅ ${(h.completedBy || []).length}</div>
        <div class="action-grid" style="margin-top:10px">
          <button class="action-btn edit" data-hid="${h.id}" data-hact="mark">Отметить</button>
          ${!isPast ? `<button class="action-btn edit" data-hid="${h.id}" data-hact="past" style="background:#e17055">⏰ Прошло</button>` : ''}
          <button class="action-btn ${h.isHidden ? 'add' : 'remove'}" data-hid="${h.id}" data-hact="hide">${h.isHidden ? 'Показать' : 'Скрыть'}</button>
          <button class="action-btn remove" data-hid="${h.id}" data-hact="del">Удалить</button>
        </div>
      </div>
    `;
  };
  
  return `
    <button class="btn btn-primary" id="add-hw-btn" style="margin-bottom:16px">+ Добавить ДЗ</button>
    
    ${currentHW.length ? `<div class="hw-section-title">📝 Текущие (${currentHW.length})</div>` : ''}
    ${currentHW.map(renderHWCard).join('')}
    
    ${pastHW.length ? `<div class="hw-section-title" style="margin-top:20px">⏰ Прошедшие (${pastHW.length})</div>` : ''}
    ${pastHW.map(renderHWCard).join('')}
    
    ${!homework?.length ? '<div class="empty-state"><p>Нет ДЗ</p></div>' : ''}
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
      else if (btn.dataset.hact === 'past') {
        // Устанавливаем дату на вчера чтобы сделать ДЗ прошедшим
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await api.put(`/api/homework/${id}`, { dueDate: yesterday.toISOString().split('T')[0] });
        showToast('ДЗ перемещено в прошедшие');
      }
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

// Заявки на проверку ДЗ
function renderSubmissions() {
  const pending = (submissions || []).filter(s => s.status === 'pending');
  const processed = (submissions || []).filter(s => s.status !== 'pending');
  
  return `
    <div class="submissions-tabs">
      <button class="sub-tab active" data-sub="pending">⏳ Ожидают (${pending.length})</button>
      <button class="sub-tab" data-sub="processed">✅ Обработанные</button>
    </div>
    <div id="pending-subs" class="sub-content active">
      ${pending.length ? pending.map(s => renderSubmissionCard(s)).join('') : '<div class="empty-state"><div class="icon">📭</div><p>Нет заявок</p></div>'}
    </div>
    <div id="processed-subs" class="sub-content">
      ${processed.length ? processed.map(s => renderSubmissionCard(s, true)).join('') : '<div class="empty-state"><div class="icon">📭</div><p>Нет обработанных</p></div>'}
    </div>
    
    <!-- Модалка просмотра заявки -->
    <div class="modal" id="view-sub-modal">
      <div class="modal-content" style="max-width:400px">
        <h3>📋 Заявка на проверку</h3>
        <div id="sub-detail"></div>
      </div>
    </div>
    
    <!-- Модалка отклонения -->
    <div class="modal" id="reject-modal">
      <div class="modal-content">
        <h3>❌ Отклонить заявку</h3>
        <form id="reject-form">
          <textarea id="reject-reason" placeholder="Причина отклонения" rows="3" required></textarea>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" id="close-reject">Отмена</button>
            <button type="submit" class="btn btn-primary" style="background:var(--danger)">Отклонить</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSubmissionCard(s, isProcessed = false) {
  const statusIcon = s.status === 'approved' ? '✅' : s.status === 'rejected' ? '❌' : '⏳';
  const date = new Date(s.submittedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const mediaCount = s.media?.length || (s.photo ? 1 : 0);
  const hasVideo = s.media?.some(m => m.type === 'video');
  
  return `
    <div class="submission-card ${s.status}" data-sub-id="${s.id}">
      <div class="sub-header">
        <div class="sub-user">
          <strong>${s.userName || 'Без имени'}</strong>
          <span class="sub-date">${date}</span>
        </div>
        <span class="sub-status">${statusIcon}</span>
      </div>
      <div class="sub-hw">📝 ${s.hwTitle || 'ДЗ'}</div>
      ${mediaCount > 0 ? `<div class="sub-has-photo">${hasVideo ? '🎬' : '📷'} ${mediaCount} файл(ов)</div>` : ''}
      ${s.comment ? `<div class="sub-comment">"${s.comment.substring(0, 50)}${s.comment.length > 50 ? '...' : ''}"</div>` : ''}
      ${!isProcessed ? `
        <div class="sub-actions">
          <button class="action-btn add" data-sub-act="approve" data-sid="${s.id}">✅ Принять</button>
          <button class="action-btn remove" data-sub-act="reject" data-sid="${s.id}">❌ Отклонить</button>
          <button class="action-btn edit" data-sub-act="view" data-sid="${s.id}">👁️</button>
        </div>
      ` : ''}
    </div>
  `;
}

let currentSubId = null;

function setupSubmissionEvents() {
  // Табы
  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
      document.getElementById(btn.dataset.sub === 'pending' ? 'pending-subs' : 'processed-subs')?.classList.add('active');
    };
  });
  
  // Действия с заявками
  document.querySelectorAll('[data-sub-act]').forEach(btn => {
    btn.onclick = async () => {
      const sid = btn.dataset.sid;
      const sub = submissions.find(s => s.id === sid);
      if (!sub) return;
      
      if (btn.dataset.subAct === 'view') {
        showSubmissionDetail(sub);
      } else if (btn.dataset.subAct === 'approve') {
        await approveSubmission(sub);
      } else if (btn.dataset.subAct === 'reject') {
        currentSubId = sid;
        document.getElementById('reject-modal').classList.add('active');
      }
    };
  });
  
  // Закрыть модалку отклонения
  document.getElementById('close-reject')?.addEventListener('click', () => {
    document.getElementById('reject-modal').classList.remove('active');
  });
  
  // Форма отклонения
  document.getElementById('reject-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = document.getElementById('reject-reason').value;
    await rejectSubmission(currentSubId, reason);
    document.getElementById('reject-modal').classList.remove('active');
  });
}

function showSubmissionDetail(sub) {
  const detail = document.getElementById('sub-detail');
  const date = new Date(sub.submittedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  
  // Поддержка URL (новый формат) и base64 (старый формат)
  let mediaHtml = '';
  if (sub.media && sub.media.length > 0) {
    mediaHtml = `<div class="sub-media-gallery">${sub.media.map(m => {
      // m.url для нового формата, m.data для старого
      const src = m.url || m.data;
      if (m.type === 'video') {
        return `<div class="gallery-item video"><video src="${src}" controls></video></div>`;
      }
      return `<div class="gallery-item"><img src="${src}" alt="Фото"></div>`;
    }).join('')}</div>`;
  } else if (sub.photo) {
    mediaHtml = `<div class="sub-photo-full"><img src="${sub.photo}" alt="Фото работы"></div>`;
  } else {
    mediaHtml = '<p style="color:var(--text-light);text-align:center">Файлы не прикреплены</p>';
  }
  
  detail.innerHTML = `
    <div class="sub-detail-info">
      <p><strong>👤 От:</strong> ${sub.userName}</p>
      <p><strong>📝 ДЗ:</strong> ${sub.hwTitle}</p>
      <p><strong>📅 Дата:</strong> ${date}</p>
      ${sub.comment ? `<p><strong>💬 Комментарий:</strong> ${sub.comment}</p>` : ''}
    </div>
    ${mediaHtml}
    <div class="modal-buttons" style="margin-top:20px">
      <button class="btn btn-secondary" onclick="document.getElementById('view-sub-modal').classList.remove('active')">Закрыть</button>
    </div>
  `;
  
  document.getElementById('view-sub-modal').classList.add('active');
}

async function approveSubmission(sub) {
  // Обновляем статус заявки
  await api.put(`/api/submissions/${sub.id}`, { status: 'approved' });
  
  // Отмечаем ДЗ как выполненное
  const hw = homework.find(h => h.id === sub.hwId);
  if (hw) {
    const completedBy = [...(hw.completedBy || [])];
    if (!completedBy.includes(sub.tgId)) {
      completedBy.push(sub.tgId);
      await api.put(`/api/homework/${sub.hwId}`, { completedBy });
    }
  }
  
  // Обновляем данные
  submissions = await api.get('/api/submissions');
  homework = await api.get('/api/homework');
  document.getElementById('admin-content').innerHTML = renderSubmissions();
  setupSubmissionEvents();
  showToast('Заявка принята ✅');
}

async function rejectSubmission(subId, reason) {
  await api.put(`/api/submissions/${subId}`, { status: 'rejected', rejectReason: reason });
  submissions = await api.get('/api/submissions');
  document.getElementById('admin-content').innerHTML = renderSubmissions();
  setupSubmissionEvents();
  showToast('Заявка отклонена');
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
