# Gmail OTP Telegram Bot

Telegram bot yang otomatis ambil kode OTP dari Gmail via API. Deploy ke Vercel.

## Setup

### 1. Environment Variables

```env
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx
ALLOWED_CHAT_IDS=123456789
```

### 2. Buat Telegram Bot

1. Chat [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot` → ikuti instruksi
3. Copy **Bot Token** → simpan di `TELEGRAM_BOT_TOKEN`
4. Chat bot kamu, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` untuk dapat **Chat ID**
5. Simpan Chat ID di `ALLOWED_CHAT_IDS`

### 3. Test Lokal

```bash
node local-test.js
node local-test.js "from:google newer_than:1d"
```

### 4. Deploy ke Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables di Vercel Dashboard → Settings → Environment Variables.

### 5. Set Webhook Telegram

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<YOUR-VERCEL-URL>/api/webhook
```

## Bot Commands

| Command | Fungsi |
|---------|--------|
| `/start` | Info & bantuan |
| `/otp` | Ambil OTP terbaru (1 hari terakhir) |
| `/otp from:google` | OTP dengan custom query |
| `/search invoice` | Search email apapun |

## Project Structure

```
├── api/webhook.js       # Vercel serverless endpoint (Telegram webhook)
├── lib/gmail.js         # Gmail API: search + extract OTP
├── lib/telegram.js      # Telegram helpers: send message + format
├── get-refresh-token.js # One-time script to get refresh token
├── local-test.js        # Local testing script
├── vercel.json          # Vercel config
└── .env                 # Credentials (gitignored)
```
