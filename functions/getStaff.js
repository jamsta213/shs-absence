/**
 * functions/getStaff.js
 *
 * Cloudflare Pages Function — reads staff from Google Sheets "Staff Data" tab.
 * Uses the Web Crypto API to sign JWTs — no npm packages required.
 *
 * Environment variables (set in Cloudflare Pages → Settings → Environment variables):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full contents of your service account JSON key file
 *   SPREADSHEET_ID               — your Google Sheet ID
 */

export async function onRequestGet(context) {
  try {
    const credentials = JSON.parse(context.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const spreadsheetId = context.env.SPREADSHEET_ID;

    const token = await getAccessToken(credentials);

    const range = encodeURIComponent('Staff Data');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Sheets API error: ${err}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // name = column index 31 (AH), site = column index 30 (AG) — matches original code.gs
    const staffList = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = row[31] || '';
      const site = row[30] || '';
      if (name) staffList.push({ name, site });
    }

    staffList.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify(staffList), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('getStaff error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* ── JWT helper (Web Crypto API — works in Cloudflare Workers/Pages) ── */

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const b64url = obj =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  // Strip PEM headers and decode
  const pemBody = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
  }

  return tokenData.access_token;
}
