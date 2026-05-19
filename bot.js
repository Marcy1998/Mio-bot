const TelegramBot = require('node-telegram-bot-api');

const token = "8867042762:AAGyz1s2Sozf9sM0psDG26wxN-wT9epLrwE";

const bot = new TelegramBot(token, { polling: true });

// memoria base (gratis, in RAM)
const userData = {};

function getResponse(text, chatId) {

  if (!userData[chatId]) {
    userData[chatId] = {
      cravings: 0,
      smokes: 0
    };
  }

  if (text === 'CRAVING') {
    userData[chatId].cravings++;

    return `Craving #${userData[chatId].cravings}.
Respira 60 secondi. Bevi acqua. Distraiti subito.`;

  }

  if (text === 'HO FUMATO') {
    userData[chatId].smokes++;

    return `Registrato.
Sigarette oggi: ${userData[chatId].smokes}
Non è perso, riparti ora.`;

  }

  if (text === '/stats') {
    return `Stats:
Craving: ${userData[chatId].cravings || 0}
Sigarette: ${userData[chatId].smokes || 0}`;
  }

  return "Scrivi CRAVING o HO FUMATO";
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  console.log("NUOVO UTENTE:", chatId);

  bot.sendMessage(
    chatId,
    "Benvenuto nel coach per smettere di fumare. Scrivi CRAVING o HO FUMATO."
  );
});


bot.on('message', (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  console.log("USER:", chatId, text);

  const reply = getResponse(text, chatId);

  bot.sendMessage(chatId, reply);
});