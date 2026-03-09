require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('ELIZA Database connected');
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query, pool };
