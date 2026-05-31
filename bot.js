const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

// --------------------
// ENV
// --------------------

require("dotenv").config();
const token = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;
const GROUP_ID = -1003874325893;
const ADMIN_ID = process.env.ADMIN_ID;

const TEAMS = [
  "🔥 Phoenix",
  "⚡ Spartan",
  "🛡 Titan"
];

if (!token || !BASE_URL) {
  console.log("❌ ENV mancanti");
  process.exit(1);
}

// --------------------
// APP
// --------------------

const app = express();
app.use(express.json());

// --------------------
// BOT
// --------------------

const bot = new TelegramBot(token, { webHook: true });

const WEBHOOK_PATH = `/bot${token}`;

async function initWebhook() {
  try {
    await bot.setWebHook(`${BASE_URL}${WEBHOOK_PATH}`);
    console.log("WEBHOOK ATTIVO:", `${BASE_URL}${WEBHOOK_PATH}`);
  }
  catch (err) {
    console.log("ERRORE WEBHOOK:", err);
  }
}

initWebhook();

// --------------------
// DATA STORAGE
// --------------------

const DATA_FILE = "./data.json";
const MISSIONS = [
  "Fai 10 minuti di camminata",
  "Respira 3 minuti quando arriva craving",
  "Bevi 1 bicchiere d’acqua e aspetta 5 minuti",
  "Fai 15 squat",
  "Scrivi perché vuoi smettere"
];
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const userData = loadData();

// --------------------
// USER INIT
// --------------------

function initUser(chatId) {
  if (!userData[chatId]) {
    userData[chatId] = {
      cravings: 0,
      smokes: 0,
      streak: 0,
      lastActive: null,
      premium: false,
      
      team: null,
xp: 0,
 lastMissionDate: null
    };
  }
}

// --------------------
// STREAK
// --------------------

function updateStreak(user) {
  const today = new Date().toDateString();

  if (user.lastActive !== today) {
    user.streak += 1;
    user.lastActive = today;
  }
}

// --------------------
// WEBHOOK TELEGRAM
// --------------------

app.post(WEBHOOK_PATH, express.json(), (req, res) => {
  console.log("UPDATE ARRIVATO:", req.body);

  bot.processUpdate(req.body);

  res.sendStatus(200);
});

// --------------------
// START
// --------------------

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  initUser(chatId);
  if (!userData[chatId].team) {
  const teams = ["Alpha", "Beta", "Gamma"];

  userData[chatId].team =
    teams[Math.floor(Math.random() * teams.length)];
}
  if (!userData[chatId].team) {
  const randomTeam =
    TEAMS[Math.floor(Math.random() * TEAMS.length)];

  userData[chatId].team = randomTeam;
}
  saveData(userData);

bot.sendMessage(
  chatId,
  `🚭 Benvenuto nella Challenge 30 Giorni

🏆 Squadra assegnata:
${userData[chatId].team}

Premi un pulsante per iniziare.`,
{
  reply_markup: {
      inline_keyboard: [
  [{ text: "🔥 CRAVING", callback_data: "CRAVING" }],
  [{ text: "🚬 HO FUMATO", callback_data: "SMOKE" }],
  [{ text: "🎯 MISSIONE", callback_data: "MISSION" }],
  [{ text: "📊 STATS", callback_data: "STATS" }],
  [{ text: "💳 PREMIUM", callback_data: "BUY" }]
    ]
    }
  });
  });


bot.onText(/\/buy/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "💳 Link pagamento: https://tuo-link-pagamento.com");
});
// --------------------
// CALLBACKS
// --------------------

bot.on("callback_query", (query) => {
  if (!query.message) return;

  const chatId = query.message.chat.id;
  const action = query.data;

  initUser(chatId);
  updateStreak(userData[chatId]);

  if (action === "MISSION") {
    const today = new Date().toDateString();

    if (userData[chatId].lastMissionDate === today) {
      bot.sendMessage(chatId, "✅ Hai già completato la missione oggi.");
      bot.answerCallbackQuery(query.id);
      return;
    }

    const mission =
      MISSIONS[Math.floor(Math.random() * MISSIONS.length)];

    userData[chatId].lastMissionDate = today;
    userData[chatId].xp += 10;

    const team = userData[chatId].team;

    bot.sendMessage(
      chatId,
      `🎯 MISSIONE DEL GIORNO

${mission}

+10 XP`
    );

    bot.sendMessage(
      GROUP_ID,
      `🏆 ${team} ha completato una missione (+10 XP)`
    );

    saveData(userData);
    bot.answerCallbackQuery(query.id);
    return;
  }

  // --------------------
  // PREMIUM CHECK
  // --------------------

  if (
    (action === "STATS" || action === "CRAVING") &&
    !userData[chatId].premium
  ) {
    bot.sendMessage(chatId, "🔒 Funzione disponibile solo Premium.");
    bot.answerCallbackQuery(query.id);
    return;
  }

  let response = "";

  // --------------------
  // CRAVING
  // --------------------

  if (action === "CRAVING") {
    userData[chatId].cravings++;
    response = `🔥 Craving #${userData[chatId].cravings}\nRespira 60 secondi.`;

    bot.sendMessage(GROUP_ID, "🧠 Craving interrotto.");
  }

  // --------------------
  // SMOKE
  // --------------------

  if (action === "SMOKE") {
    userData[chatId].smokes++;
    response = `🚬 Sigaretta registrata\nTotale: ${userData[chatId].smokes}`;

    bot.sendMessage(GROUP_ID, "🚬 Ricaduta registrata.");
  }

  // --------------------
  // STATS
  // --------------------

 if (action === "STATS") {
  response =
`📊 STATISTICHE

🔥 Craving: ${userData[chatId].cravings}
🚬 Sigarette: ${userData[chatId].smokes}
🏆 Streak: ${userData[chatId].streak}

👥 Team: ${userData[chatId].team}
⭐ XP: ${userData[chatId].xp}`;
}
  // --------------------
  // BUY (LINK PAGAMENTO)
  // --------------------

  if (action === "BUY") {
    bot.sendMessage(
      chatId,
      "💳 Premium:\n\nPaga qui e poi verrai attivato:\nhttps://tuo-link-pagamento.com"
    );

    bot.answerCallbackQuery(query.id);
    return;
  }

  saveData(userData);

  bot.sendMessage(chatId, response);
  bot.answerCallbackQuery(query.id);

});
// --------------------
// ADMIN PREMIUM
// --------------------

bot.onText(/\/premium (.+)/, (msg, match) => {
  const chatId = msg.chat.id;

  if (String(chatId) !== String(ADMIN_ID)) {
    bot.sendMessage(chatId, "Non autorizzato.");
    return;
  }

  const targetId = match[1];

  initUser(targetId);
  userData[targetId].premium = true;

  saveData(userData);

  bot.sendMessage(chatId, "Utente reso premium");
});

// --------------------
// SERVER
// --------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SERVER AVVIATO SU PORTA ${PORT}`);
});

bot.onText(/\/team/, (msg) => {
  const chatId = msg.chat.id;

  initUser(chatId);

  bot.sendMessage(
    chatId,
    "🏆 La tua squadra è:\n\n" +
      (userData[chatId].team || "Non assegnata")
  );
});
