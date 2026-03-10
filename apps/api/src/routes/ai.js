const express = require('express');
const router = express.Router();
const queryEngine = require('../../../../packages/ai/queryEngine.js');

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const { intent, entities, data, answer } = await queryEngine.run(question);

    res.json({
      question,
      intent,
      answer,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
