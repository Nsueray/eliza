const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

// GET /api/reference/countries
router.get('/countries', async (req, res) => {
  try {
    const result = await query(`
      SELECT code, code3, name_en, name_tr, name_fr, region
      FROM core_countries
      WHERE is_active = true
      ORDER BY name_en
    `);
    res.json({ countries: result.rows });
  } catch (err) {
    console.error('Reference countries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/reference/sectors
router.get('/sectors', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, parent_id, slug, name_en, name_tr, name_fr, level, display_order
      FROM core_sectors
      WHERE is_active = true
      ORDER BY level, display_order, name_en
    `);
    res.json({ sectors: result.rows });
  } catch (err) {
    console.error('Reference sectors error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// GET /api/reference/currencies
router.get('/currencies', async (req, res) => {
  try {
    const result = await query(`
      SELECT code, name_en, symbol
      FROM core_currencies
      WHERE is_active = true
      ORDER BY code
    `);
    res.json({ currencies: result.rows });
  } catch (err) {
    console.error('Reference currencies error:', err.message);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

// GET /api/reference/languages
router.get('/languages', async (req, res) => {
  try {
    const result = await query(`
      SELECT code, name_en, name_native
      FROM core_languages
      WHERE is_active = true
      ORDER BY name_en
    `);
    res.json({ languages: result.rows });
  } catch (err) {
    console.error('Reference languages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// PUT /api/reference/countries/:code — Update a country
router.put('/countries/:code', async (req, res) => {
  try {
    const { name_en, name_tr, name_fr, region, is_active } = req.body;
    const result = await query(`
      UPDATE core_countries
      SET name_en = COALESCE($1, name_en),
          name_tr = COALESCE($2, name_tr),
          name_fr = COALESCE($3, name_fr),
          region = COALESCE($4, region),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE code = $6
      RETURNING *
    `, [name_en, name_tr, name_fr, region, is_active, req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Country not found' });
    res.json({ country: result.rows[0] });
  } catch (err) {
    console.error('Update country error:', err.message);
    res.status(500).json({ error: 'Failed to update country' });
  }
});

// PUT /api/reference/sectors/:id — Update a sector
router.put('/sectors/:id', async (req, res) => {
  try {
    const { name_en, name_tr, name_fr, display_order, is_active } = req.body;
    const result = await query(`
      UPDATE core_sectors
      SET name_en = COALESCE($1, name_en),
          name_tr = COALESCE($2, name_tr),
          name_fr = COALESCE($3, name_fr),
          display_order = COALESCE($4, display_order),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [name_en, name_tr, name_fr, display_order, is_active, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sector not found' });
    res.json({ sector: result.rows[0] });
  } catch (err) {
    console.error('Update sector error:', err.message);
    res.status(500).json({ error: 'Failed to update sector' });
  }
});

// PUT /api/reference/currencies/:code — Update a currency
router.put('/currencies/:code', async (req, res) => {
  try {
    const { name_en, symbol, is_active } = req.body;
    const result = await query(`
      UPDATE core_currencies
      SET name_en = COALESCE($1, name_en),
          symbol = COALESCE($2, symbol),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
      WHERE code = $4
      RETURNING *
    `, [name_en, symbol, is_active, req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Currency not found' });
    res.json({ currency: result.rows[0] });
  } catch (err) {
    console.error('Update currency error:', err.message);
    res.status(500).json({ error: 'Failed to update currency' });
  }
});

// PUT /api/reference/languages/:code — Update a language
router.put('/languages/:code', async (req, res) => {
  try {
    const { name_en, name_native, is_active } = req.body;
    const result = await query(`
      UPDATE core_languages
      SET name_en = COALESCE($1, name_en),
          name_native = COALESCE($2, name_native),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
      WHERE code = $4
      RETURNING *
    `, [name_en, name_native, is_active, req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Language not found' });
    res.json({ language: result.rows[0] });
  } catch (err) {
    console.error('Update language error:', err.message);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

module.exports = router;
