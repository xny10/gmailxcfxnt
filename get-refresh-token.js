import { google } from "googleapis";
import open from "open";
import http from "http";
import { readFileSync } from "fs";

// Load .env manually
const envFile = readFileSync(".env", "utf-8");
const env = Object.fromEntries(envFile.split("\n").filter(Boolean).map((l) => l.split("=").map((s, i, a) => i === 0 ? s.trim() : a.slice(1).join("=").trim())));

// ================= CONFIG =================
const CLIENT_ID = env.GOOGLE_CLIENT_ID || "ISI_DI_.ENV";
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || "ISI_DI_.ENV";
const REDIRECT_URI = "http://localhost:3000/oauth2callback";
// ==========================================

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n🔗 Buka URL ini di browser:\n");
console.log(authUrl);

// buka otomatis browser
open(authUrl);

// buat server kecil untuk nerima callback
const server = http.createServer(async (req, res) => {
  if (req.url.includes("/oauth2callback")) {
    const url = new URL(req.url, "http://localhost:3000");
    const code = url.searchParams.get("code");

    res.end("✅ Authorization berhasil! Cek terminal kamu.");

    server.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);

      console.log("\n🎉 TOKENS BERHASIL DIDAPAT:\n");
      console.log("ACCESS TOKEN:\n", tokens.access_token);
      console.log("\nREFRESH TOKEN:\n", tokens.refresh_token);

      console.log("\n⚠️ SIMPAN INI DI .env:");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);

    } catch (err) {
      console.error("❌ Error ambil token:", err);
    }
  }
});

server.listen(3000, () => {
  console.log("\n🚀 Menunggu callback di http://localhost:3000 ...\n");
});
