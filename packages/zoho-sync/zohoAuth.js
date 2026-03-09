require('dotenv').config();

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';

async function getAccessToken() {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Missing Zoho OAuth credentials in environment variables');
  }

  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Zoho token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(`Zoho token refresh returned no access_token: ${JSON.stringify(data)}`);
  }

  console.log('Zoho access token refreshed');
  return data.access_token;
}

module.exports = { getAccessToken };
