const express = require('express');
const router = express.Router();
const attention = require('../../../../packages/attention/index.js');

// GET /api/attention/items — run scan and return flagged items
router.get('/items', async (req, res) => {
  try {
    const items = await attention.scan();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attention/reviewed — mark entity as reviewed by CEO
router.post('/reviewed', async (req, res) => {
  try {
    const { entity_type, entity_name } = req.body;
    if (!entity_type || !entity_name) {
      return res.status(400).json({ error: 'entity_type and entity_name required' });
    }
    await attention.markReviewed(entity_type, entity_name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
