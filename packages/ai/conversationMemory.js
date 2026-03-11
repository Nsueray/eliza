const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const client = new Anthropic();
const REWRITE_MODEL = process.env.AI_INTENT_MODEL || 'claude-haiku-4-5-20251001';

const REWRITE_PROMPT = `You are a question rewriter for a business intelligence system about exhibitions/expos.
Given conversation history and a new question, rewrite the new question to be fully self-contained.
If the question is already clear and self-contained, return it unchanged.
Only output the rewritten question, nothing else.

Examples:
History: User asked 'SIEMA 2026 kaç m²?' → ELIZA answered with data
New question: 've geçen yıl?'
Rewritten: 'SIEMA 2025 kaç m²?'

History: User asked 'top agents 2026' → ELIZA answered with list
New question: 'peki Elif ne kadar sattı?'
Rewritten: 'Elif 2026 toplam ne kadar sattı?'

History: User asked 'Madesign risk durumu' → ELIZA answered
New question: 'peki SIEMA?'
Rewritten: 'SIEMA risk durumu nedir?'

History: User asked 'Elif 2026 satışları' → ELIZA answered
New question: 'hangi ülkelerden?'
Rewritten: 'Elif 2026 hangi ülkelerden satış yapmış?'

History: User asked 'SIEMA 2026 agent breakdown' → ELIZA answered
New question: 'what about Foodexpo?'
Rewritten: 'Foodexpo 2026 agent breakdown'`;

/**
 * Get recent conversation history for a user.
 * Returns last 5 messages within 2 hours, in chronological order.
 */
async function getHistory(userPhone) {
  if (!userPhone) return [];

  try {
    const result = await query(`
      SELECT message_text, response_text
      FROM message_logs
      WHERE user_phone = $1
        AND created_at > NOW() - INTERVAL '2 hours'
        AND is_command = false
        AND message_text IS NOT NULL
        AND response_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `, [userPhone]);

    if (result.rows.length === 0) return [];

    // Reverse to chronological order (oldest first)
    const rows = result.rows.reverse();
    const history = [];
    for (const row of rows) {
      history.push({ role: 'user', content: row.message_text });
      history.push({ role: 'assistant', content: row.response_text });
    }
    return history;
  } catch (err) {
    console.error('getHistory error:', err.message);
    return [];
  }
}

/**
 * Rewrite a follow-up question to be self-contained using conversation history.
 * Returns { question, _usage } where question is the rewritten (or original) text.
 */
async function rewriteQuestion(currentQuestion, history) {
  const noRewrite = {
    question: currentQuestion,
    _usage: { input_tokens: 0, output_tokens: 0, model: 'none' },
  };

  // No history or too little context → no rewrite needed
  if (!history || history.length < 2) return noRewrite;

  // Format history for prompt
  const historyText = history.map(h => {
    const prefix = h.role === 'user' ? 'User' : 'ELIZA';
    // Truncate long responses to keep prompt small
    const content = h.content.length > 300 ? h.content.slice(0, 300) + '...' : h.content;
    return `${prefix}: ${content}`;
  }).join('\n');

  try {
    const response = await client.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 200,
      system: REWRITE_PROMPT,
      messages: [{
        role: 'user',
        content: `Conversation history:\n${historyText}\n\nNew question: ${currentQuestion}`,
      }],
    });

    const rewritten = response.content[0].text.trim();
    const usage = {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      model: REWRITE_MODEL,
    };

    // If Haiku returned empty or something weird, use original
    if (!rewritten || rewritten.length === 0) return noRewrite;

    return { question: rewritten, _usage: usage };
  } catch (err) {
    console.error('rewriteQuestion error:', err.message);
    return noRewrite;
  }
}

module.exports = { getHistory, rewriteQuestion };
