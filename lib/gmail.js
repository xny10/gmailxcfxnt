import { google } from "googleapis";

/**
 * Create authenticated Gmail client using refresh token
 */
function getGmailClient({ clientId, clientSecret, refreshToken }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Search Gmail for recent emails matching a query
 * @param {object} gmail - Gmail API client
 * @param {string} query - Gmail search query (e.g. "from:noreply subject:OTP")
 * @param {number} maxResults - Max emails to fetch (default 5)
 * @returns {Array} Array of { subject, from, date, snippet, body }
 */
async function searchEmails(gmail, query, maxResults = 5) {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = res.data.messages || [];
  const results = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = detail.data.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    const snippet = detail.data.snippet || "";

    // Extract body text
    let body = "";
    const payload = detail.data.payload;

    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
      const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
      const part = textPart || htmlPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }

    results.push({ subject, from, date, snippet, body });
  }

  return results;
}

/**
 * Extract OTP codes from text using common patterns
 * Supports 4-8 digit codes
 */
function extractOTP(text) {
  // Common OTP patterns
  const patterns = [
    /(?:code|kode|otp|pin|verifikasi|verification|sandi)\s*[:=]?\s*(\d{4,8})/gi,
    /(\d{4,8})\s*(?:is your|adalah)/gi,
    /\b(\d{6})\b/g, // fallback: any 6-digit number
  ];

  const codes = new Set();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      codes.add(match[1]);
    }
  }

  return [...codes];
}

/**
 * Main function: search Gmail and extract OTP
 * @param {object} config - { clientId, clientSecret, refreshToken }
 * @param {string} query - Gmail search query
 * @returns {Array} Array of { subject, from, date, codes, snippet }
 */
async function grabOTP(config, query = "subject:OTP OR subject:verification OR subject:code newer_than:1d") {
  const gmail = getGmailClient(config);
  const emails = await searchEmails(gmail, query, 5);

  return emails.map((email) => {
    const allText = `${email.subject} ${email.snippet} ${email.body}`;
    const codes = extractOTP(allText);

    return {
      subject: email.subject,
      from: email.from,
      date: email.date,
      codes,
      snippet: email.snippet.substring(0, 200),
    };
  });
}

export { getGmailClient, searchEmails, extractOTP, grabOTP };
