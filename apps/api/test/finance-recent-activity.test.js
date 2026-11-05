// GET /api/finance/recent-activity — month + agent filter (temporary, pre-LEENA merge).
//
// Runs against a LOCAL throwaway Postgres only, with synthetic data (no real names).
// Every object is created inside a fresh schema that is dropped afterwards.
//
//   TEST_DATABASE_URL='postgresql://user@localhost:5432/scratch' node --test apps/api/test/
//
// Skips when TEST_DATABASE_URL is unset; refuses any non-local host. The repo .env is never
// loaded (dotenv is stubbed before packages/db is required).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const TEST_URL = process.env.TEST_DATABASE_URL;
const ROOT = path.resolve(__dirname, '../../..');
const SCHEMA = `finance_ra_test_${process.pid}`;

let server;
let base;
let pool;

function isLocal(url) {
  const { parse } = require(require.resolve('pg-connection-string', { paths: [path.join(ROOT, 'node_modules/pg')] }));
  const host = parse(url).host || '';
  return host.startsWith('/') || ['localhost', '127.0.0.1', '::1'].includes(host);
}

const skip = !TEST_URL ? 'TEST_DATABASE_URL not set' : false;

// ── Synthetic seed ──
// 2020-03: 35 payments (20 × Agent A, 15 × Agent B) → filtered call must return all 35.
// 2020-04: 5 payments (Agent A) + boundary rows on 2020-02-29 / 2020-04-01.
// Current month: 1 payment (Agent A) for the default-month check.
const MARCH = [];
for (let i = 0; i < 35; i++) {
  MARCH.push({
    contract: i < 20 ? 1 : 2,
    date: `2020-03-${String((i % 28) + 1).padStart(2, '0')}`,
    cents: 10000 + i * 137, // 100.00, 101.37, ...
  });
}
const sumCents = rows => rows.reduce((s, r) => s + r.cents, 0);

before(async () => {
  if (skip) return;
  if (!isLocal(TEST_URL)) throw new Error('TEST_DATABASE_URL must point to a local database');

  // Never read the repo .env: stub dotenv for every copy packages/db could resolve.
  for (const from of [path.join(ROOT, 'packages/db'), ROOT]) {
    try {
      const id = require.resolve('dotenv', { paths: [from] });
      require.cache[id] = { id, filename: id, loaded: true, exports: { config: () => ({ parsed: {} }) } };
    } catch { /* not installed at this level */ }
  }
  process.env.DATABASE_URL = TEST_URL;
  process.env.PGOPTIONS = `-c search_path=${SCHEMA}`;

  ({ pool } = require(path.join(ROOT, 'packages/db/index.js')));
  const q = (sql, params) => pool.query(sql, params);

  await q(`CREATE SCHEMA ${SCHEMA}`);
  await q(`CREATE TABLE expos (id SERIAL PRIMARY KEY, name TEXT)`);
  await q(`CREATE TABLE contracts (
    id SERIAL PRIMARY KEY, af_number TEXT UNIQUE NOT NULL, expo_id INT REFERENCES expos(id),
    company_name TEXT, sales_agent TEXT, revenue_eur NUMERIC, paid_eur NUMERIC)`);
  await q(`CREATE TABLE contract_payments (
    id SERIAL PRIMARY KEY, contract_id INT NOT NULL REFERENCES contracts(id), af_number TEXT NOT NULL,
    payment_date DATE, amount_eur DECIMAL(12,2), note TEXT,
    amount_local DECIMAL(12,2), currency VARCHAR(10) DEFAULT 'EUR')`);
  await q(`CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY, sync_type VARCHAR(50), module VARCHAR(50), started_at TIMESTAMP,
    completed_at TIMESTAMP, records_synced INT, records_updated INT, status VARCHAR(20), error_message TEXT)`);

  await q(`INSERT INTO expos (name) VALUES ('Expo X 2020')`);
  await q(`INSERT INTO contracts (af_number, expo_id, company_name, sales_agent, revenue_eur, paid_eur) VALUES
    ('AF-T1', 1, 'Firm 001', 'Agent A', 50000, 9000),
    ('AF-T2', 1, 'Firm 002', 'Agent B', 30000, 4000),
    ('AF-T3', 1, 'Firm 003', 'Agent C', 10000, 0),
    ('AF-T4', 1, 'Firm 004', '', 1000, 0)`);

  for (const p of MARCH) {
    await q(`INSERT INTO contract_payments (contract_id, af_number, payment_date, amount_eur, note)
             VALUES ($1, $2, $3, $4, 'test')`, [p.contract, `AF-T${p.contract}`, p.date, p.cents / 100]);
  }
  for (let i = 0; i < 5; i++) {
    await q(`INSERT INTO contract_payments (contract_id, af_number, payment_date, amount_eur, amount_local, currency)
             VALUES (1, 'AF-T1', $1, 200, 330000, 'NGN')`, [`2020-04-${String(i + 10).padStart(2, '0')}`]);
  }
  await q(`INSERT INTO contract_payments (contract_id, af_number, payment_date, amount_eur) VALUES
    (2, 'AF-T2', '2020-02-29', 999), (2, 'AF-T2', '2020-04-01', 888), (2, 'AF-T2', NULL, 777),
    (1, 'AF-T1', CURRENT_DATE, 55)`);

  await q(`INSERT INTO sync_log (sync_type, module, started_at, completed_at, status) VALUES
    ('payments', 'received_payments', '2020-05-01 05:00', '2020-05-01 06:00', 'success'),
    ('payments', 'received_payments', '2020-05-02 05:00', '2020-05-02 06:00', 'success'),
    ('payments', 'received_payments', '2020-05-03 05:00', '2020-05-03 06:00', 'error'),
    ('incremental', 'contracts', '2020-05-04 05:00', '2020-05-04 06:00', 'success')`);

  const express = require(require.resolve('express', { paths: [path.join(ROOT, 'apps/api')] }));
  const app = express();
  app.use('/api/finance', require(path.join(ROOT, 'apps/api/src/routes/finance.js')));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/finance`;
});

after(async () => {
  if (skip) return;
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
  }
});

async function get(qs) {
  const res = await fetch(`${base}/recent-activity${qs}`);
  return { status: res.status, body: await res.json() };
}

test('month filter returns every payment of the month — no row cap (35 → 35), even with limit=20', { skip }, async () => {
  for (const qs of ['?month=2020-03', '?month=2020-03&limit=20']) {
    const { status, body } = await get(qs);
    assert.equal(status, 200);
    assert.equal(body.month, '2020-03');
    assert.equal(body.rows.length, 35);
    assert.ok(body.rows.every(r => r.event_date.startsWith('2020-03-')));
  }
});

test('summary is computed over the full filter, not the visible rows', { skip }, async () => {
  const { body } = await get('?month=2020-03');
  assert.equal(body.summary.payment_count, 35);
  assert.equal(Math.round(body.summary.total_eur * 100), sumCents(MARCH));
  const rowCents = body.rows.reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0);
  assert.equal(rowCents, sumCents(MARCH));
});

test('agent filter is exact and combines with month', { skip }, async () => {
  const { body } = await get(`?month=2020-03&agent=${encodeURIComponent('Agent B')}`);
  const expected = MARCH.filter(p => p.contract === 2);
  assert.equal(body.agent, 'Agent B');
  assert.equal(body.rows.length, 15);
  assert.ok(body.rows.every(r => r.sales_agent === 'Agent B'));
  assert.equal(body.summary.payment_count, 15);
  assert.equal(Math.round(body.summary.total_eur * 100), sumCents(expected));

  const none = await get(`?month=2020-03&agent=${encodeURIComponent('Agent')}`);
  assert.equal(none.body.rows.length, 0, 'no partial/ILIKE match');
  assert.equal(none.body.summary.total_eur, 0);
});

test('month boundaries: first and last day included, neighbours excluded', { skip }, async () => {
  const { body } = await get('?month=2020-04');
  assert.equal(body.rows.length, 6); // 5 × Agent A + 2020-04-01
  assert.ok(body.rows.some(r => r.event_date === '2020-04-01'));
  assert.ok(!body.rows.some(r => r.event_date === '2020-02-29'));
});

test('rows: date desc and carry agent, contract totals, local amount + currency', { skip }, async () => {
  const { body } = await get('?month=2020-04');
  const dates = body.rows.map(r => r.event_date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  const ngn = body.rows.find(r => r.currency === 'NGN');
  assert.equal(ngn.sales_agent, 'Agent A');
  assert.equal(ngn.company_name, 'Firm 001');
  assert.equal(ngn.expo_name, 'Expo X 2020');
  assert.equal(ngn.af_number, 'AF-T1');
  assert.equal(Number(ngn.amount), 200);
  assert.equal(Number(ngn.amount_local), 330000);
  assert.equal(Number(ngn.contract_total_eur), 50000);
  assert.equal(Number(ngn.contract_paid_eur), 9000);
});

test('agent without month defaults to the current month', { skip }, async () => {
  const { body } = await get(`?agent=${encodeURIComponent('Agent A')}`);
  const now = await pool.query(`SELECT to_char(CURRENT_DATE, 'YYYY-MM') AS m`);
  assert.equal(body.month, now.rows[0].m);
  assert.equal(body.rows.length, 1);
  assert.equal(Number(body.rows[0].amount), 55);
});

test('agents list is DISTINCT contracts.sales_agent (blank excluded); last sync = latest successful payment sync', { skip }, async () => {
  const { body } = await get('?month=2020-03');
  assert.deepEqual(body.agents, ['Agent A', 'Agent B', 'Agent C']);
  assert.ok(body.last_payment_sync_at);
  const expected = await pool.query(`SELECT '2020-05-02 06:00'::timestamp AS t`);
  assert.equal(new Date(body.last_payment_sync_at).getTime(), new Date(expected.rows[0].t).getTime());
});

test('invalid month → 400', { skip }, async () => {
  for (const m of ['2020-13', '2020-3', 'march', '2020-03-01']) {
    const { status } = await get(`?month=${m}`);
    assert.equal(status, 400, m);
  }
});

test('legacy unfiltered call is unchanged: plain array, 20 rows, date desc', { skip }, async () => {
  for (const qs of ['', '?limit=20']) {
    const { status, body } = await get(qs);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 20);
    const t = body.map(r => new Date(r.event_date).getTime());
    assert.deepEqual(t, [...t].sort((a, b) => b - a));
    assert.ok(!('sales_agent' in body[0]), 'legacy row shape not extended');
  }
  const capped = await get('?limit=500');
  assert.equal(capped.body.length, 43); // 35 + 5 + 3 dated rows (NULL date excluded); legacy max is 50
});
