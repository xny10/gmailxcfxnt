import { grabOTP } from "../lib/gmail.js";

const GMAIL_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Search Gmail for emails sent to this address
    const query = `to:${email} newer_than:1d`;
    const results = await grabOTP(GMAIL_CONFIG, query);

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
