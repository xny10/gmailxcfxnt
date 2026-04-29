/**
 * Send a message via Telegram Bot API
 */
async function sendMessage(botToken, chatId, text, parseMode = "HTML") {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

/**
 * Format OTP results into a nice Telegram message
 */
function formatOTPMessage(results) {
  if (!results || results.length === 0) {
    return "❌ Tidak ada email OTP ditemukan.";
  }

  let msg = "📬 <b>OTP dari Gmail:</b>\n\n";

  for (const r of results) {
    const codesStr = r.codes.length > 0
      ? r.codes.map((c) => `<code>${c}</code>`).join(", ")
      : "<i>tidak ditemukan</i>";

    msg += `📧 <b>${escapeHtml(r.subject)}</b>\n`;
    msg += `👤 ${escapeHtml(r.from)}\n`;
    msg += `🕐 ${r.date}\n`;
    msg += `🔑 Kode: ${codesStr}\n`;
    msg += `📝 ${escapeHtml(r.snippet)}\n\n`;
  }

  return msg;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export { sendMessage, formatOTPMessage, escapeHtml };
