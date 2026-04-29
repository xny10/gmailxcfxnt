import { grabOTP } from "./lib/gmail.js";
import { formatOTPMessage } from "./lib/telegram.js";
import { readFileSync } from "fs";

// Load .env manually
const envFile = readFileSync(".env", "utf-8");
const env = Object.fromEntries(envFile.split("\n").filter(Boolean).map((l) => l.split("=").map((s, i, a) => i === 0 ? s.trim() : a.slice(1).join("=").trim())));

// ============ CONFIG ============
const config = {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  refreshToken: env.GOOGLE_REFRESH_TOKEN,
};
// ================================

const query = process.argv[2] || "subject:OTP OR subject:verification OR subject:code newer_than:1d";

console.log(`\n🔍 Searching Gmail: "${query}"\n`);

try {
  const results = await grabOTP(config, query);

  if (results.length === 0) {
    console.log("❌ Tidak ada email ditemukan.");
  } else {
    // Console output
    for (const r of results) {
      console.log(`📧 ${r.subject}`);
      console.log(`   From: ${r.from}`);
      console.log(`   Date: ${r.date}`);
      console.log(`   OTP Codes: ${r.codes.length > 0 ? r.codes.join(", ") : "none"}`);
      console.log(`   Snippet: ${r.snippet}`);
      console.log();
    }

    // Telegram-formatted output
    console.log("--- Telegram message preview ---");
    console.log(formatOTPMessage(results).replace(/<[^>]+>/g, ""));
  }
} catch (err) {
  console.error("❌ Error:", err.message);
}
