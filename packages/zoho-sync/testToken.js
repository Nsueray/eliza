require('dotenv').config({ path: '../../.env' });
const { getAccessToken } = require('./zohoAuth');

async function main() {
  try {
    const token = await getAccessToken();
    console.log('Zoho token:', token.substring(0, 20));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
