/**
 * functions/submitAbsence.js
 *
 * Cloudflare Pages Function — appends an absence record to "Responses" sheet.
 * Uses the Web Crypto API to sign JWTs — no npm packages required.
 *
 * Environment variables (set in Cloudflare Pages → Settings → Environment variables):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full contents of your service account JSON key file
 *   SPREADSHEET_ID               — your Google Sheet ID
 */

export async function onRequestPost(context) {
  try {
    let data;
    try {
      data = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const credentials = JSON.parse(context.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const spreadsheetId = context.env.SPREADSHEET_ID;

    const token = await getAccessToken(credentials);

    // ── Find next free row in column A ──────────────────────
    const colARange = encodeURIComponent('Responses!A:A');
    const colARes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${colARange}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!colARes.ok) {
      const err = await colARes.text();
      throw new Error(`Sheets API error reading column A: ${err}`);
    }

    const colAData = await colARes.json();
    const nextRow = (colAData.values || []).length + 1;

    // ── Format date DD/MM/YYYY ───────────────────────────────
    const formatToUK = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };

    // ── Timestamp in UK time ────────────────────────────────
    const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });

    // ── Build row (columns A–N, matches original code.gs) ───
    const rowValues = [[
      timestamp,                    // A: Timestamp
      data.name        || '',       // B: Name
      data.site        || '',       // C: Site
      data.absType     || '',       // D: Absence Type
      data.sickReason  || '',       // E: Sickness Reason
      data.leaveReason || '',       // F: Leave Reason
      data.coverStatus || '',       // G: Cover Status
      data.duties      || '',       // H: Duties
      data.whoCover    || '',       // I: Who is covering
      formatToUK(data.start),       // J: First Day
      formatToUK(data.end),         // K: Last Day
      data.dayType     || '',       // L: Duration Type
      data.timeOut     || '',       // M: Time Out
      data.timeReturn  || '',       // N: Time Return
    ]];

    // ── Write to sheet ───────────────────────────────────────
    const writeRange = encodeURIComponent(`Responses!A${nextRow}:N${nextRow}`);
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rowValues }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Sheets API error writing row: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('submitAbsence error:', err);
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
