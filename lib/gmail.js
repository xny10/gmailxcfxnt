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

    // Extract body text (recursively handle nested MIME parts)
    const body = extractBody(detail.data.payload);

    results.push({ subject, from, date, snippet, body });
  }

  return results;
}

/**
 * Extract primary OTP code only (filter out noise like footer numbers)
 */
function extractOTP(text) {
  const clean = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, " ");
  const codes = [];

  // Priority 1: code near OTP keywords (highest confidence)
  const keywordPatterns = [
    /(?:code|kode|otp|pin|verifikasi|verification|sandi|masuk|akses sementara|temporary access)\s*[:=\s]*(\d{4,8})/gi,
    /(\d{4,8})\s*(?:is your|adalah)/gi,
  ];

  for (const p of keywordPatterns) {
    let m;
    while ((m = p.exec(clean)) !== null) {
      codes.push(m[1]);
    }
  }

  if (codes.length > 0) return [...new Set(codes)];

  // Priority 2: large/styled code in HTML (font-size > 20px, bold, big heading)
  const styledPattern = /(?:font-size\s*:\s*(?:2[0-9]|[3-9]\d)\s*px|<h[12][^>]*>|font-weight\s*:\s*(?:bold|[7-9]00))[^>]*>\s*(\d{4,8})\s*</gi;
  let m;
  while ((m = styledPattern.exec(text)) !== null) {
    codes.push(m[1]);
  }

  if (codes.length > 0) return [...new Set(codes)];

  // Priority 3: standalone big number in its own HTML element (e.g. <td>0955</td>)
  const standalonePattern = /<(?:td|div|span|p|h\d)[^>]*>\s*(\d{4,8})\s*<\/(?:td|div|span|p|h\d)>/gi;
  while ((m = standalonePattern.exec(text)) !== null) {
    const num = m[1];
    // Filter out years and common noise
    if (!/^(19|20)\d{2}$/.test(num) && !/^0{2,}/.test(num)) {
      codes.push(num);
    }
  }

  return [...new Set(codes)];
}

/**
 * Extract button/CTA links from HTML (e.g. "Dapatkan Kode", "Sign In")
 */
function extractButtonLinks(text) {
  const textKeywords = /dapatkan kode|get code|sign in|masuk|verify|verifikasi|konfirmasi|confirm|login|akses|access|reset|update|ya,?\s*itu saya|itu saya|yes,?\s*it'?s me|ya saya|iya saya|setujui|approve|authorize|otorisasi|lanjutkan|continue|activate|aktifkan/i;
  const urlKeywords = /otp[_-]?cta|update-primary-location|verify|verification|confirm|activate|authorize|household|approve|magic[_-]?link|one[_-]?click|login|signin|auth/i;

  const results = [];
  const seen = new Set();

  const anchorPattern = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = anchorPattern.exec(text)) !== null) {
    const url = m[1].replace(/&amp;/g, "&");
    const linkText = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // Match if either text OR url matches button patterns
    if ((textKeywords.test(linkText) || urlKeywords.test(url)) && !seen.has(url)) {
      seen.add(url);
      results.push({ url, label: linkText || "Open Link" });
    }
  }

  return results;
}

/**
 * Extract all links from HTML/text content
 */
function extractLinks(text) {
  const urlPattern = /https?:\/\/[^\s"'<>\]]+/gi;
  const matches = text.match(urlPattern) || [];
  const seen = new Set();
  return matches.filter((url) => {
    const clean = url.replace(/[).,;]+$/, "");
    if (seen.has(clean)) return false;
    seen.add(clean);
    return true;
  }).map((url) => url.replace(/[).,;]+$/, ""));
}

/**
 * Main function: search Gmail and extract OTP + links
 * @param {object} config - { clientId, clientSecret, refreshToken }
 * @param {string} query - Gmail search query
 * @returns {Array} Array of { subject, from, date, codes, links, snippet, body }
 */
async function grabOTP(config, query = "subject:OTP OR subject:verification OR subject:code newer_than:1d") {
  const gmail = getGmailClient(config);
  const emails = await searchEmails(gmail, query, 5);

  return emails.map((email) => {
    const allText = `${email.subject} ${email.snippet} ${email.body}`;
    const codes = extractOTP(allText);
    const buttonLinks = extractButtonLinks(email.body || "");

    return {
      subject: email.subject,
      from: email.from,
      date: email.date,
      codes,
      links: buttonLinks,
      snippet: email.snippet.substring(0, 200),
      body: email.body,
    };
  });
}

/**
 * Recursively extract body from MIME payload
 */
function extractBody(payload) {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    // Try text/html first (Netflix codes are in HTML), then text/plain
    let htmlBody = "";
    let textBody = "";

    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        textBody = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        // Recurse into nested parts (multipart/alternative inside multipart/related)
        const nested = extractBody(part);
        if (nested) htmlBody = htmlBody || nested;
      }
    }

    return htmlBody || textBody;
  }

  return "";
}

export { getGmailClient, searchEmails, extractOTP, extractLinks, extractButtonLinks, extractBody, grabOTP };
