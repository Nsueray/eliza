require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ELIZA API running', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`ELIZA API running on port ${PORT}`);
});
