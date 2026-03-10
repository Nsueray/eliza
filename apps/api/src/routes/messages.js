const express = require('express');
const router = express.Router();
const messages = require('../../../../packages/messages/index.js');

// GET /api/messages/templates — list available templates
router.get('/templates', (req, res) => {
  try {
    const templates = messages.getTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages/generate — generate a message draft
router.post('/generate', async (req, res) => {
  try {
    const { recipient, subject, template } = req.body;
    if (!recipient) {
      return res.status(400).json({ error: 'recipient is required' });
    }
    const result = await messages.generateMessage(recipient, subject, template);
    res.json({
      draft_id: result.draft.id,
      recipient: result.recipient.name,
      language: result.draft.language,
      template: result.draft.template_type,
      body: result.draft.body,
      expires_in: '10 minutes',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/messages/send — approve and send a draft (CEO only)
router.post('/send', async (req, res) => {
  try {
    const { draft_id } = req.body;
    if (!draft_id) {
      return res.status(400).json({ error: 'draft_id is required' });
    }
    const result = await messages.approveDraft(draft_id);
    res.json({
      sent: result.sent,
      recipient: result.draft.recipient_name,
      message: result.sent ? 'Mesaj gönderildi.' : 'Gönderim başarısız.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
