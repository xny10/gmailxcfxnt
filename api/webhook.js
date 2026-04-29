import { grabOTP } from "../lib/gmail.js";
import { sendMessage, formatOTPMessage } from "../lib/telegram.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_IDS = (process.env.ALLOWED_CHAT_IDS || "").split(",").map((s) => s.trim());

const GMAIL_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, msg: "Bot is running" });
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Security: only respond to allowed chat IDs
    if (ALLOWED_CHAT_IDS.length > 0 && ALLOWED_CHAT_IDS[0] !== "" && !ALLOWED_CHAT_IDS.includes(chatId)) {
      await sendMessage(BOT_TOKEN, chatId, "⛔ Unauthorized.");
      return res.status(200).json({ ok: true });
    }

    // /start command
    if (text === "/start") {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "👋 <b>Gmail OTP Bot</b>\n\n" +
          "Perintah:\n" +
          "• /otp — Ambil OTP terbaru dari Gmail\n" +
          "• /otp [query] — Search custom\n" +
          "• /search [query] — Search email Gmail\n\n" +
          "Contoh:\n" +
          "<code>/otp from:google</code>\n" +
          "<code>/search invoice newer_than:3d</code>"
      );
      return res.status(200).json({ ok: true });
    }

    // /otp command
    if (text.startsWith("/otp")) {
      const customQuery = text.replace("/otp", "").trim();
      const query = customQuery || "subject:OTP OR subject:verification OR subject:code newer_than:1d";

      await sendMessage(BOT_TOKEN, chatId, "⏳ Mencari OTP di Gmail...");

      const results = await grabOTP(GMAIL_CONFIG, query);
      const msg = formatOTPMessage(results);
      await sendMessage(BOT_TOKEN, chatId, msg);

      return res.status(200).json({ ok: true });
    }

    // /search command
    if (text.startsWith("/search")) {
      const query = text.replace("/search", "").trim();
      if (!query) {
        await sendMessage(BOT_TOKEN, chatId, "⚠️ Usage: <code>/search [query]</code>\nContoh: <code>/search from:google newer_than:1d</code>");
        return res.status(200).json({ ok: true });
      }

      await sendMessage(BOT_TOKEN, chatId, "🔍 Searching Gmail...");

      const results = await grabOTP(GMAIL_CONFIG, query);
      const msg = formatOTPMessage(results);
      await sendMessage(BOT_TOKEN, chatId, msg);

      return res.status(200).json({ ok: true });
    }

    // Unknown command
    await sendMessage(BOT_TOKEN, chatId, "❓ Command tidak dikenal. Ketik /start untuk bantuan.");
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
