const express = require('express');
const router = express.Router();
const alerts = require('../../../../packages/alerts/index.js');
const briefing = require('../../../../packages/briefing/index.js');

// GET /api/alerts — generate and return today's alerts
router.get('/', async (req, res) => {
  try {
    await alerts.generateAlerts();
    const items = await alerts.getUnsentAlerts();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/briefing — generate briefing (preview, doesn't send)
router.get('/briefing', async (req, res) => {
  try {
    const result = await briefing.generateBriefing();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/briefing/send — manually trigger briefing send
router.post('/briefing/send', async (req, res) => {
  try {
    const result = await briefing.sendBriefing();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
