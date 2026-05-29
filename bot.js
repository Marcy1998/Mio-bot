const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN non impostato");
}

const bot = new TelegramBot(token, { polling: true });

const userData = {};

function getResponse(text, chatId) {
  const clean = String(text || "").trim().toUpperCase();

  if (!userData[chatId]) {
    userData[chatId] = { cravings: 0, smokes: 0 };
  }

  if (clean === "CRAVING") {
    userData[chatId].cravings++;
    return `Craving #${userData[chatId].cravings}`;
  }

  if (clean === "HO FUMATO") {
    userData[chatId].smokes++;
    return `Sigarette oggi: ${userData[chatId].smokes}`;
  }

  return "Scrivi CRAVING o HO FUMATO";
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Bot attivo. Scrivi CRAVING o HO FUMATO"
  );
});

bot.on("message", (msg) => {
  if (!msg.text) return;

  const reply = getResponse(msg.text, msg.chat.id);
  bot.sendMessage(msg.chat.id, reply);
});