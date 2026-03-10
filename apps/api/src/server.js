const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const express = require('express');

const expoRoutes = require('./routes/expos');
const salesRoutes = require('./routes/sales');
const revenueRoutes = require('./routes/revenue');
const aiRoutes = require('./routes/ai');
const attentionRoutes = require('./routes/attention');
const alertRoutes = require('./routes/alerts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ELIZA API running', timestamp: new Date() });
});

app.use('/api/expos', expoRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/attention', attentionRoutes);
app.use('/api/alerts', alertRoutes);

app.listen(PORT, () => {
  console.log(`ELIZA API running on port ${PORT}`);
});
