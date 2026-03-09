require('dotenv').config();
const express = require('express');

const expoRoutes = require('./routes/expos');
const salesRoutes = require('./routes/sales');
const revenueRoutes = require('./routes/revenue');

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ELIZA API running', timestamp: new Date() });
});

app.use('/api/expos', expoRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/revenue', revenueRoutes);

app.listen(PORT, () => {
  console.log(`ELIZA API running on port ${PORT}`);
});
