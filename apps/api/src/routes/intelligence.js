const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');
const fs = require('fs');
const path = require('path');

// GET /api/intelligence/router-rules — Parse router.js and return rules info
router.get('/router-rules', async (req, res) => {
  try {
    const routerPath = path.resolve(__dirname, '../../../../packages/ai/router.js');
    const content = fs.readFileSync(routerPath, 'utf-8');

    // Extract RULES array entries
    const rules = [];
    const ruleRegex = /{\s*intent:\s*'([^']+)',\s*keywords:\s*\[([\s\S]*?)\]\s*,?\s*}/g;
    let match;
    while ((match = ruleRegex.exec(content)) !== null) {
      const intent = match[1];
      const keywordsBlock = match[2];

      // Extract keyword groups: each [...] is a group
      const groupRegex = /\[([^\]]+)\]/g;
      let groupMatch;
      const keywordGroups = [];
      while ((groupMatch = groupRegex.exec(keywordsBlock)) !== null) {
        const phrases = groupMatch[1]
          .split(',')
          .map(s => s.trim().replace(/^'|'$/g, ''))
          .filter(s => s.length > 0);
        keywordGroups.push(phrases);
      }

      rules.push({
        intent,
        keyword_count: keywordGroups.length,
        sample_keywords: keywordGroups.slice(0, 3).map(g => g.join(' + ')),
      });
    }

    // Extract EXPO_BRANDS
    const expoBrandsMatch = content.match(/const EXPO_BRANDS\s*=\s*\[([\s\S]*?)\];/);
    const expo_brands = expoBrandsMatch
      ? expoBrandsMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || []
      : [];

    // Extract AGENT_NAMES
    const agentNamesMatch = content.match(/const AGENT_NAMES\s*=\s*\[([\s\S]*?)\];/);
    const agent_names = agentNamesMatch
      ? agentNamesMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || []
      : [];

    res.json({
      rules,
      expo_brands,
      agent_names,
      total_rules: rules.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/intelligence/intent-stats — Intent distribution from message_logs
router.get('/intent-stats', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
    const since = `NOW() - INTERVAL '${days} days'`;

    const intentResult = await query(`
      SELECT
        intent,
        COUNT(*) AS count,
        COALESCE(SUM(total_tokens), 0) AS tokens,
        ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration,
        COUNT(CASE WHEN model_intent = 'router' THEN 1 END) AS router_count,
        COUNT(CASE WHEN model_intent != 'router' OR model_intent IS NULL THEN 1 END) AS haiku_count
      FROM message_logs
      WHERE created_at >= ${since} AND intent IS NOT NULL
      GROUP BY intent
      ORDER BY count DESC
    `);

    const totalResult = await query(`
      SELECT COUNT(*) AS total
      FROM message_logs
      WHERE created_at >= ${since}
    `);

    const intents = intentResult.rows.map(row => ({
      intent: row.intent,
      count: parseInt(row.count),
      tokens: parseInt(row.tokens),
      avg_duration: parseInt(row.avg_duration) || 0,
      router_pct: parseInt(row.count) > 0
        ? Math.round((parseInt(row.router_count) / parseInt(row.count)) * 100)
        : 0,
      haiku_pct: parseInt(row.count) > 0
        ? Math.round((parseInt(row.haiku_count) / parseInt(row.count)) * 100)
        : 0,
    }));

    res.json({
      intents,
      total_messages: parseInt(totalResult.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/intelligence/benchmark — Read benchmark questions
router.get('/benchmark', async (req, res) => {
  try {
    const benchmarkPath = path.resolve(__dirname, '../../../../docs/benchmark/questions.json');
    const content = fs.readFileSync(benchmarkPath, 'utf-8');
    const questions = JSON.parse(content);

    const questionList = Array.isArray(questions) ? questions : (questions.questions || []);
    const categories = [...new Set(questionList.map(q => q.category).filter(Boolean))];

    res.json({
      questions: questionList,
      total: questionList.length,
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/intelligence/clarification-stats — Clarification analytics
router.get('/clarification-stats', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
    const since = `NOW() - INTERVAL '${days} days'`;

    // Total clarifications
    const totalResult = await query(`
      SELECT COUNT(*) AS total
      FROM message_logs
      WHERE intent = 'clarification' AND created_at >= ${since}
    `);
    const total_clarifications = parseInt(totalResult.rows[0].total);

    // Infer slot from response_text patterns
    const slotResult = await query(`
      SELECT
        COUNT(CASE WHEN response_text ILIKE '%hangi edisyon%' OR response_text ILIKE '%which edition%' OR response_text ILIKE '%which year%' OR response_text ILIKE '%hangi yil%' THEN 1 END) AS year_slot,
        COUNT(CASE WHEN response_text ILIKE '%hangi fuar%' OR response_text ILIKE '%which expo%' OR response_text ILIKE '%quel expo%' THEN 1 END) AS expo_slot,
        COUNT(CASE WHEN response_text ILIKE '%neye gore%' OR response_text ILIKE '%by what%' OR response_text ILIKE '%hangi metrik%' OR response_text ILIKE '%which metric%' THEN 1 END) AS metric_slot
      FROM message_logs
      WHERE intent = 'clarification' AND created_at >= ${since}
    `);

    // Resolve rate: check if next message from same user within 10 min got a non-clarification intent
    const resolveResult = await query(`
      WITH clarifications AS (
        SELECT id, user_phone, created_at
        FROM message_logs
        WHERE intent = 'clarification' AND created_at >= ${since}
      ),
      follow_ups AS (
        SELECT DISTINCT ON (c.id) c.id AS clar_id, m.intent AS follow_intent
        FROM clarifications c
        JOIN message_logs m ON m.user_phone = c.user_phone
          AND m.created_at > c.created_at
          AND m.created_at <= c.created_at + INTERVAL '10 minutes'
          AND m.id != c.id
        ORDER BY c.id, m.created_at ASC
      )
      SELECT
        COUNT(*) AS with_followup,
        COUNT(CASE WHEN follow_intent IS NOT NULL AND follow_intent != 'clarification' THEN 1 END) AS resolved
      FROM follow_ups
    `);

    const with_followup = parseInt(resolveResult.rows[0]?.with_followup || 0);
    const resolved = parseInt(resolveResult.rows[0]?.resolved || 0);
    const resolve_rate = with_followup > 0
      ? Math.round((resolved / with_followup) * 100)
      : 0;

    res.json({
      total_clarifications,
      by_slot: {
        year: parseInt(slotResult.rows[0].year_slot),
        expo: parseInt(slotResult.rows[0].expo_slot),
        metric: parseInt(slotResult.rows[0].metric_slot),
      },
      resolve_rate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
