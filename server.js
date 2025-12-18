const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));

// Обработка ошибок парсинга JSON (слишком большой payload)
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Файл слишком большой' });
  }
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: 'Неверный формат данных' });
  }
  next(err);
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN not set! Please set it in environment variables.');
}
const REPO_OWNER = process.env.REPO_OWNER || 'mraiko23';
const REPO_NAME = process.env.REPO_NAME || 'xristianindb';
const FILE_PATH = 'db.json';

// Задачи питомца
const PET_TASKS = [
  { id: 'feed', emoji: '🍎', text: 'Покорми меня!', action: 'Покормить' },
  { id: 'play', emoji: '⚽', text: 'Поиграй со мной!', action: 'Играть' },
  { id: 'sleep', emoji: '😴', text: 'Уложи меня спать!', action: 'Уложить' },
  { id: 'wash', emoji: '🛁', text: 'Помой меня!', action: 'Помыть' },
  { id: 'pet', emoji: '💕', text: 'Погладь меня!', action: 'Погладить' },
  { id: 'walk', emoji: '🚶', text: 'Погуляй со мной!', action: 'Гулять' }
];

// Проверить и сгенерировать задачу для питомца
function checkAndGeneratePetTask(pet) {
  if (!pet || pet.isDead) return pet;
  
  const now = new Date();
  const mskHour = (now.getUTCHours() + 3) % 24;
  const today = now.toDateString();
  
  // Проверяем не истекла ли текущая задача
  if (pet.currentTask) {
    const deadline = new Date(pet.currentTask.deadline);
    if (now > deadline) {
      // Питомец погиб!
      pet.isDead = true;
      pet.diedAt = now.toISOString();
      pet.currentTask = null;
      return pet;
    }
    return pet; // Задача ещё активна
  }
  
  // Генерируем задачи только с 4:00 до 18:00 МСК
  if (mskHour < 4 || mskHour >= 18) return pet;
  
  // Сбрасываем счетчик если новый день
  if (pet.lastTaskDate !== today) {
    pet.tasksCompletedToday = 0;
  }
  
  // Максимум 4 задачи в день
  if ((pet.tasksCompletedToday || 0) >= 4) return pet;
  
  // Проверяем прошло ли достаточно времени с последней задачи (минимум 1 час)
  const lastTaskTime = pet.lastTaskGeneratedAt ? new Date(pet.lastTaskGeneratedAt).getTime() : 0;
  const hoursSinceLastTask = (Date.now() - lastTaskTime) / (1000 * 60 * 60);
  
  // Генерируем задачу с вероятностью, зависящей от времени
  // Чем больше времени прошло, тем выше шанс
  const chance = Math.min(0.8, hoursSinceLastTask * 0.15);
  
  if (Math.random() < chance) {
    const randomTask = PET_TASKS[Math.floor(Math.random() * PET_TASKS.length)];
    const deadline = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 часа
    
    pet.currentTask = {
      taskId: randomTask.id,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString()
    };
    pet.lastTaskGeneratedAt = now.toISOString();
  }
  
  return pet;
}

// Шаблон базы данных
const DB_TEMPLATE = {
  users: [],
  topics: [],
  homework: [],
  submissions: [],
  settings: {
    adminUsername: "@admin",
    giftThreshold: 5
  }
};

// Создать файл в GitHub
async function createFileInGitHub(filePath, content, message) {
  const base64Content = Buffer.from(content).toString('base64');
  
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message,
      content: base64Content
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to create ${filePath}:`, err);
    throw new Error(`Failed to create ${filePath}`);
  }
  
  console.log(`Created ${filePath} in GitHub`);
  return true;
}

// Проверить и создать db.json если не существует
async function ensureDBExists() {
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN not set!');
    return false;
  }
  
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });
  
  if (res.status === 404) {
    console.log('db.json not found, creating...');
    await createFileInGitHub(FILE_PATH, JSON.stringify(DB_TEMPLATE, null, 2), 'Initialize db.json');
    return true;
  }
  
  if (!res.ok) {
    console.error('Error checking db.json:', res.status);
    return false;
  }
  
  console.log('db.json exists');
  return true;
}

// Создать .gitkeep в uploads если папка не существует
async function ensureUploadsFolder() {
  if (!GITHUB_TOKEN) return false;
  
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/uploads/.gitkeep`, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });
  
  if (res.status === 404) {
    console.log('uploads folder not found, creating...');
    await createFileInGitHub('uploads/.gitkeep', '', 'Create uploads folder');
    return true;
  }
  
  return true;
}

// Получить данные из GitHub
async function getDB() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN не настроен на сервере');
  }
  
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });
  
  // Если файл не существует - создаём
  if (res.status === 404) {
    console.log('db.json not found, creating...');
    await createFileInGitHub(FILE_PATH, JSON.stringify(DB_TEMPLATE, null, 2), 'Initialize db.json');
    // Получаем заново
    return getDB();
  }
  
  const text = await res.text();
  
  if (!res.ok) {
    console.error('GitHub getDB error:', res.status, text);
    if (res.status === 401) {
      throw new Error('GitHub токен недействителен или отозван');
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }
  
  if (!text) {
    throw new Error('Пустой ответ от GitHub API');
  }
  
  const data = JSON.parse(text);
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  const dbData = JSON.parse(content);
  
  // Убедимся что все поля существуют
  if (!dbData.users) dbData.users = [];
  if (!dbData.topics) dbData.topics = [];
  if (!dbData.homework) dbData.homework = [];
  if (!dbData.submissions) dbData.submissions = [];
  if (!dbData.settings) dbData.settings = DB_TEMPLATE.settings;
  
  return { data: dbData, sha: data.sha };
}

// Загрузить файл в GitHub
async function uploadFileToGitHub(filename, base64Content) {
  const filePath = `uploads/${filename}`;
  
  // Проверяем существует ли файл
  let sha = null;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }
  } catch (e) {
    // Файл не существует, это нормально
  }
  
  const body = {
    message: `Upload ${filename}`,
    content: base64Content
  };
  if (sha) body.sha = sha;
  
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub upload failed: ${err.message}`);
  }
  
  // Возвращаем URL файла
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${filePath}`;
}

// Сохранить данные в GitHub с retry при конфликте
async function saveDB(data, sha, retries = 3) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update db.json',
        content: content,
        sha: sha
      })
    });
    
    if (res.ok) {
      return true;
    }
    
    const error = await res.json();
    console.log(`GitHub save attempt ${attempt + 1} failed:`, error.message);
    
    // Если конфликт sha - получаем новый и пробуем снова
    if (res.status === 409 && attempt < retries - 1) {
      console.log('SHA conflict, retrying with fresh data...');
      const fresh = await getDB();
      sha = fresh.sha;
      // Мержим данные
      Object.assign(fresh.data, data);
      data = fresh.data;
      continue;
    }
    
    throw new Error(error.message || 'GitHub save failed');
  }
}

// API endpoints
app.get('/api/db', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/db', async (req, res) => {
  try {
    const { sha } = await getDB();
    await saveDB(req.body, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Получить пользователя по Telegram ID
app.get('/api/user/:tgId', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    const userIdx = data.users?.findIndex(u => u.tgId === req.params.tgId);
    
    if (userIdx === -1 || userIdx === undefined) {
      return res.json(null);
    }
    
    let user = data.users[userIdx];
    
    // Проверяем и генерируем задачу для питомца
    if (user.pet && !user.pet.isDead) {
      const updatedPet = checkAndGeneratePetTask(user.pet);
      
      // Если что-то изменилось - сохраняем
      if (JSON.stringify(updatedPet) !== JSON.stringify(user.pet)) {
        user.pet = updatedPet;
        data.users[userIdx] = user;
        await saveDB(data, sha);
        console.log('Pet task updated for user:', req.params.tgId);
      }
    }
    
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
  try {
    console.log('Register request:', req.body.tgId, req.body.firstName);
    const { data, sha } = await getDB();
    if (!data.users) data.users = [];
    
    const existing = data.users.find(u => u.tgId === req.body.tgId);
    if (existing) {
      return res.json({ success: false, message: 'Уже зарегистрирован' });
    }
    
    data.users.push({
      tgId: req.body.tgId,
      username: req.body.username || '',
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      birthDate: req.body.birthDate,
      photo: req.body.photo || '',
      stickers: 0,
      absences: 0,
      isAdmin: false,
      theme: 'light',
      registeredAt: new Date().toISOString()
    });
    
    await saveDB(data, sha);
    console.log('User registered successfully:', req.body.tgId);
    res.json({ success: true });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Ошибка сервера: ' + e.message });
  }
});

// Обновить пользователя
app.put('/api/user/:tgId', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    const idx = data.users?.findIndex(u => u.tgId === req.params.tgId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    
    data.users[idx] = { ...data.users[idx], ...req.body };
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить все темы
app.get('/api/topics', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data.topics || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Добавить тему (админ)
app.post('/api/topics', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    if (!data.topics) data.topics = [];
    data.topics.push({
      id: Date.now().toString(),
      title: req.body.title,
      date: req.body.date,
      description: req.body.description || '',
      isHidden: false,
      isCurrent: req.body.isCurrent || false
    });
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновить/удалить тему
app.put('/api/topics/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    const idx = data.topics?.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Topic not found' });
    data.topics[idx] = { ...data.topics[idx], ...req.body };
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/topics/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    data.topics = data.topics?.filter(t => t.id !== req.params.id) || [];
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Домашние задания
app.get('/api/homework', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data.homework || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/homework', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    if (!data.homework) data.homework = [];
    data.homework.push({
      id: Date.now().toString(),
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.dueDate,
      isHidden: false,
      completedBy: []
    });
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/homework/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    const idx = data.homework?.findIndex(h => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Homework not found' });
    data.homework[idx] = { ...data.homework[idx], ...req.body };
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/homework/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    data.homework = data.homework?.filter(h => h.id !== req.params.id) || [];
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить всех пользователей (для админа)
app.get('/api/users', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data.users || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить настройки (юзернейм админа и тд)
app.get('/api/settings', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data.settings || { adminUsername: '@admin', giftThreshold: 5 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    data.settings = { ...data.settings, ...req.body };
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Заявки на проверку ДЗ
app.get('/api/submissions', async (req, res) => {
  try {
    const { data } = await getDB();
    res.json(data.submissions || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    if (!data.submissions) data.submissions = [];
    
    const submissionId = Date.now().toString();
    const mediaFiles = [];
    
    // Загружаем медиафайлы в GitHub
    if (req.body.media && req.body.media.length > 0) {
      for (let i = 0; i < req.body.media.length; i++) {
        const mediaItem = req.body.media[i];
        
        if (!mediaItem.data) {
          console.log('Skipping media item without data');
          continue;
        }
        
        // Определяем расширение из MIME типа
        let ext = '.jpg';
        const mimeMatch = mediaItem.data.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          const mime = mimeMatch[1];
          if (mime.includes('png')) ext = '.png';
          else if (mime.includes('gif')) ext = '.gif';
          else if (mime.includes('webp')) ext = '.webp';
          else if (mime.includes('mp4') || mime.includes('video')) ext = '.mp4';
          else if (mime.includes('webm')) ext = '.webm';
          else if (mime.includes('mov') || mime.includes('quicktime')) ext = '.mov';
        }
        
        const base64Data = mediaItem.data.replace(/^data:[^;]+;base64,/, '');
        const filename = `${submissionId}_${i}${ext}`;
        
        try {
          console.log(`Uploading ${filename} to GitHub...`);
          const url = await uploadFileToGitHub(filename, base64Data);
          console.log(`Uploaded: ${url}`);
          
          mediaFiles.push({
            url: url,
            type: mediaItem.type,
            name: mediaItem.name || filename
          });
        } catch (uploadErr) {
          console.error(`Error uploading ${filename}:`, uploadErr.message);
        }
      }
    }
    
    data.submissions.push({
      id: submissionId,
      hwId: req.body.hwId,
      hwTitle: req.body.hwTitle,
      tgId: req.body.tgId,
      userName: req.body.userName,
      media: mediaFiles,
      comment: req.body.comment || '',
      status: 'pending',
      submittedAt: new Date().toISOString()
    });
    
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    console.error('Submission error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/submissions/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    const idx = data.submissions?.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Submission not found' });
    data.submissions[idx] = { ...data.submissions[idx], ...req.body };
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/submissions/:id', async (req, res) => {
  try {
    const { data, sha } = await getDB();
    data.submissions = data.submissions?.filter(s => s.id !== req.params.id) || [];
    await saveDB(data, sha);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Эндпоинт для пинга
app.get('/ping', (req, res) => {
  res.json({ status: 'alive', time: new Date().toISOString() });
});

// Эндпоинт для инициализации (можно вызвать вручную)
app.get('/api/init', async (req, res) => {
  try {
    await ensureDBExists();
    await ensureUploadsFolder();
    res.json({ success: true, message: 'Initialized successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://xrist.onrender.com';

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Инициализация GitHub репозитория
  try {
    console.log('Initializing GitHub repository...');
    await ensureDBExists();
    await ensureUploadsFolder();
    console.log('GitHub repository initialized successfully');
  } catch (e) {
    console.error('Failed to initialize GitHub repository:', e.message);
  }
  
  // Self-ping каждые 90 секунд чтобы Render не засыпал
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/ping`);
      console.log('Self-ping OK:', new Date().toISOString());
    } catch (e) {
      console.log('Self-ping failed:', e.message);
    }
  }, 90000); // 90 секунд = 1.5 минуты
});
