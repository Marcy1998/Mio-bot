const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const Stripe = require("stripe");

// --------------------
// ENV
// --------------------

const token = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;

const GROUP_ID = -1003874325893;
const ADMIN_ID = process.env.ADMIN_ID;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

if (
  !token ||
  !BASE_URL ||
  !process.env.STRIPE_SECRET_KEY ||
  !process.env.STRIPE_PRICE_ID ||
  !process.env.STRIPE_WEBHOOK_SECRET
) {
  console.log("❌ ENV mancanti");
  process.exit(1);
}

// --------------------
// APP
// --------------------

const app = express();

// ⚠️ STRIPE RAW BODY SOLO QUI
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("Stripe webhook error:", err.message);
      return res.sendStatus(400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const telegramId = session.metadata.telegram_id;

      if (telegramId) {
        initUser(telegramId);
        userData[telegramId].premium = true;
        saveData(userData);

        bot.sendMessage(telegramId, "✅ Premium attivato.");
      }
    }

    res.sendStatus(200);
  }
);

// JSON per Telegram
app.use(express.json());

// --------------------
// BOT
// --------------------

const bot = new TelegramBot(token, { webHook: true });

const WEBHOOK_PATH = `/bot${token}`;
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`;

bot.setWebHook(WEBHOOK_URL);

console.log("✅ WEBHOOK ATTIVO SU:", WEBHOOK_URL);

// --------------------
// DATA STORAGE
// --------------------

const DATA_FILE = "./data.json";

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (err) {
    console.log("loadData error:", err);
    return {};
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("saveData error:", err);
  }
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
      premium: false
    };
  }
}

// --------------------
// STREAK
// --------------------

function updateStreak(user) {
  const today = new Date().toDateString();

  if (user.lastActive !== today) {
    user.streak = (user.streak || 0) + 1;
    user.lastActive = today;
  }
}

// --------------------
// TELEGRAM WEBHOOK ROUTE
// --------------------

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --------------------
// START
// --------------------

bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;

  initUser(chatId);
  saveData(userData);

  bot.sendMessage(chatId, "Benvenuto 👇", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 CRAVING", callback_data: "CRAVING" }],
        [{ text: "🚬 HO FUMATO", callback_data: "SMOKE" }],
        [{ text: "😍 HO VOGLIA DI MANGIARE", callback_data: "SMOKE" }],
        [{ text: "📊 STATS", callback_data: "STATS" }],
        [{ text: "💳 PREMIUM", callback_data: "BUY" }]
      ]
    }
  });
});

// --------------------
// BUY COMMAND
// --------------------

bot.onText(/^\/buy$/, async (msg) => {
  const chatId = msg.chat.id;

  initUser(chatId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: `${BASE_URL}`,
      cancel_url: `${BASE_URL}`,
      metadata: {
        telegram_id: String(chatId)
      }
    });

    bot.sendMessage(chatId, `💳 Accedi al Premium:\n${session.url}`);
  } catch (err) {
    console.log("STRIPE ERROR:", err);
    bot.sendMessage(chatId, "Errore pagamento.");
  }
});

// --------------------
// CALLBACKS
// --------------------

bot.on("callback_query", async (query) => {
  if (!query.message) return;

  const chatId = query.message.chat.id;
  const action = query.data;

  initUser(chatId);
  updateStreak(userData[chatId]);

  // BUY
  if (action === "BUY") {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1
          }
        ],
        success_url: `${BASE_URL}`,
        cancel_url: `${BASE_URL}`,
        metadata: {
          telegram_id: String(chatId)
        }
      });

      bot.sendMessage(chatId, `💳 Accedi al Premium:\n${session.url}`);
    } catch (err) {
      console.log(err);
      bot.sendMessage(chatId, "Errore pagamento.");
    }

    bot.answerCallbackQuery(query.id);
    return;
  }

  // PREMIUM BLOCK
  if (
    (action === "STATS" || action === "CRAVING") &&
    !userData[chatId].premium
  ) {
    bot.sendMessage(chatId, "Funzione disponibile solo Premium.");
    bot.answerCallbackQuery(query.id);
    return;
  }

  let response = "";

  // CRAVING
  if (action === "CRAVING") {
    userData[chatId].cravings++;
    response = `🔥 Craving #${userData[chatId].cravings}\nRespira 60 secondi.`;

    bot.sendMessage(GROUP_ID, "🧠 Craving evitato.");
  }

  // SMOKE
  if (action === "SMOKE") {
    userData[chatId].smokes++;
    response = `🚬 Sigaretta registrata\nTotale: ${userData[chatId].smokes}`;

    bot.sendMessage(GROUP_ID, "🚬 Ricaduta registrata.");
  }

  // STATS
  if (action === "STATS") {
    response =
      `📊 STATISTICHE\n\n🔥 Craving: ${userData[chatId].cravings}\n🚬 Sigarette: ${userData[chatId].smokes}\n🏆 Streak: ${userData[chatId].streak}`;
  }

  saveData(userData);

  bot.sendMessage(chatId, response);
  bot.answerCallbackQuery(query.id);
});

// --------------------
// ADMIN PREMIUM
// --------------------

bot.onText(/^\/premium (.+)$/, (msg, match) => {
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
// SERVER START
// --------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 SERVER ATTIVO SU PORTA ${PORT}`);
});
