const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../../../../packages/db/index.js');

const client = new Anthropic();
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

const SQL_TEMPLATES = {
  risk_expos: {
    sql: `SELECT e.name, e.country, e.start_date,
      COALESCE(SUM(c.m2),0) AS sold_m2,
      e.target_m2,
      CASE WHEN e.target_m2 > 0
        THEN ROUND((COALESCE(SUM(c.m2),0) / e.target_m2 * 100)::numeric, 1)
        ELSE 0 END AS progress_pct
      FROM expos e
      LEFT JOIN contracts c ON c.expo_id = e.id
      WHERE e.start_date > NOW()
      GROUP BY e.id
      HAVING e.target_m2 > 0 AND COALESCE(SUM(c.m2),0) < e.target_m2 * 0.6
      ORDER BY progress_pct ASC
      LIMIT 10`,
    params: [],
  },
  top_agents: {
    sql: `SELECT sales_agent, COUNT(*) AS contracts,
      ROUND(SUM(revenue_eur)::numeric,2) AS revenue_eur
      FROM contracts
      WHERE contract_date >= NOW() - INTERVAL '30 days'
      GROUP BY sales_agent
      ORDER BY revenue_eur DESC
      LIMIT 10`,
    params: [],
  },
  expo_summary: {
    sql: `SELECT e.name, e.country, e.start_date, e.end_date,
      COUNT(c.id) AS contracts,
      COALESCE(SUM(c.m2),0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
      FROM expos e
      LEFT JOIN contracts c ON c.expo_id = e.id
      WHERE e.name ILIKE '%' || $1 || '%'
      GROUP BY e.id`,
    paramKeys: ['expo_name'],
  },
  exhibitors_by_country: {
    sql: `SELECT e.name, COUNT(*) AS exhibitors
      FROM contracts c
      JOIN expos e ON c.expo_id = e.id
      WHERE c.country ILIKE '%' || $1 || '%'
      GROUP BY e.name
      ORDER BY exhibitors DESC`,
    paramKeys: ['country'],
  },
  revenue_by_year: {
    sql: `SELECT EXTRACT(YEAR FROM contract_date)::integer AS year,
      COUNT(*) AS contracts,
      ROUND(SUM(revenue_eur)::numeric,2) AS revenue_eur
      FROM contracts
      WHERE contract_date IS NOT NULL
      GROUP BY year ORDER BY year`,
    params: [],
  },
  general_stats: {
    sql: `SELECT COUNT(*) AS contracts,
      ROUND(SUM(revenue_eur)::numeric,2) AS total_revenue_eur,
      COUNT(DISTINCT expo_id) AS expos,
      COUNT(DISTINCT sales_agent) AS agents
      FROM contracts`,
    params: [],
  },
};

async function classifyQuestion(question) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Classify this question into one of these query types: risk_expos, top_agents, expo_summary, exhibitors_by_country, revenue_by_year, general_stats. Also extract any parameters (country, expo_name, year). Return JSON only: { "type": "...", "params": {} }\n\nQuestion: ${question}`,
    }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to classify question');
  return JSON.parse(jsonMatch[0]);
}

async function generateAnswer(question, data) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are ELIZA, the AI assistant for Elan Expo. Answer this question based on the data. Be concise and use numbers. Question: ${question}. Data: ${JSON.stringify(data)}`,
    }],
  });

  return response.content[0].text.trim();
}

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const classification = await classifyQuestion(question);
    const template = SQL_TEMPLATES[classification.type];

    if (!template) {
      return res.status(400).json({ error: `Unknown query type: ${classification.type}` });
    }

    let params = [];
    if (template.paramKeys) {
      params = template.paramKeys.map(key => classification.params[key] || '');
    }

    const result = await query(template.sql, params);
    const data = result.rows;

    const answer = await generateAnswer(question, data);

    res.json({
      question,
      type: classification.type,
      answer,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
