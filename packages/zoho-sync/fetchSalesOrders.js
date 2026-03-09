require('dotenv').config({ path: '../../.env' });
const { getAccessToken } = require('./zohoAuth');

const SALES_ORDERS_URL = 'https://www.zohoapis.com/crm/v2/Sales_Orders';

async function fetchSalesOrders() {
  const token = await getAccessToken();

  const response = await fetch(SALES_ORDERS_URL, {
    headers: {
      Authorization: 'Zoho-oauthtoken ' + token,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Zoho API request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const records = data.data || [];

  console.log('Records fetched:', records.length);
  console.log('First record:', JSON.stringify(records[0], null, 2));
}

fetchSalesOrders().catch((error) => {
  console.error('Error:', error.message);
});
