const express = require('express');
const router = express.Router();
const { query } = require('../../../packages/db/index.js');

// GET /api/logs — paginated message logs
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const userFilter = req.query.user || null;
    const intentFilter = req.query.intent || null;

    let where = 'WHERE 1=1';
    const params = [];

    if (userFilter) {
      params.push(`%${userFilter}%`);
      where += ` AND (user_name ILIKE $${params.length} OR user_phone ILIKE $${params.length})`;
    }
    if (intentFilter) {
      params.push(intentFilter);
      where += ` AND intent = $${params.length}`;
    }

    // Total count
    const countResult = await query(`SELECT COUNT(*) FROM message_logs ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    // Paginated rows
    params.push(limit, offset);
    const rows = await query(
      `SELECT id, user_phone, user_name, user_role, message_text, response_text,
              intent, input_tokens, output_tokens, total_tokens,
              model_intent, model_answer, duration_ms, is_command, error, created_at
       FROM message_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ logs: rows.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/summary — usage summary stats
router.get('/summary', async (req, res) => {
  try {
    const days = Math.min(90, parseInt(req.query.days) || 30);
    const since = `NOW() - INTERVAL '${days} days'`;

    // Overall stats
    const overall = await query(`
      SELECT
        COUNT(*) AS total_messages,
        COUNT(DISTINCT user_phone) AS unique_users,
        COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration_ms,
        COUNT(CASE WHEN error IS NOT NULL THEN 1 END) AS error_count
      FROM message_logs
      WHERE created_at >= ${since}
    `);

    // Per-user breakdown
    const byUser = await query(`
      SELECT user_name, user_phone, user_role,
        COUNT(*) AS messages,
        COALESCE(SUM(total_tokens), 0) AS tokens,
        ROUND(AVG(duration_ms)::numeric, 0) AS avg_ms
      FROM message_logs
      WHERE created_at >= ${since}
      GROUP BY user_name, user_phone, user_role
      ORDER BY messages DESC
    `);

    // Per-intent breakdown
    const byIntent = await query(`
      SELECT intent, COUNT(*) AS count,
        COALESCE(SUM(total_tokens), 0) AS tokens
      FROM message_logs
      WHERE created_at >= ${since} AND intent IS NOT NULL
      GROUP BY intent
      ORDER BY count DESC
    `);

    // Daily trend
    const daily = await query(`
      SELECT DATE(created_at) AS date,
        COUNT(*) AS messages,
        COALESCE(SUM(total_tokens), 0) AS tokens
      FROM message_logs
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // Model usage
    const byModel = await query(`
      SELECT model_answer AS model,
        COUNT(*) AS calls,
        COALESCE(SUM(total_tokens), 0) AS tokens
      FROM message_logs
      WHERE created_at >= ${since} AND model_answer IS NOT NULL
      GROUP BY model_answer
      ORDER BY tokens DESC
    `);

    res.json({
      overall: overall.rows[0],
      byUser: byUser.rows,
      byIntent: byIntent.rows,
      daily: daily.rows,
      byModel: byModel.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
