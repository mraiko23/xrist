const TelegramBot = require('node-telegram-bot-api');

// Вставь сюда токен бота от BotFather
const BOT_TOKEN = '8058915581:AAGrht72oQLPBnmhW-iltQrGZEQNNA4F22M';

// URL твоего Mini App (нужен HTTPS!)
const WEBAPP_URL = 'http://localhost:3000/';

const bot = new TelegramBot(BOT_TOKEN, { 
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.code);
});

bot.on('error', (error) => {
  console.log('Bot error:', error.code);
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '📖 Добро пожаловать в Электронный дневник!\n\nНажми кнопку ниже, чтобы открыть приложение:', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '📓 Открыть дневник',
          web_app: { url: WEBAPP_URL }
        }
      ]]
    }
  });
});

console.log('Bot started! Waiting for messages...');
