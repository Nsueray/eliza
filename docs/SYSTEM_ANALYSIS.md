# ELIZA — Comprehensive System Analysis
Generated: 2026-03-12 | Analyst: Claude Code

---

## 1. MESSAGE LOGS ANALYSIS

### Production Data Status
- **Local DB (localhost):** 0 messages in `message_logs` — all logging occurs on production Render DB
- **Production DB URL:** Not available in local `.env` — only `DATABASE_URL=postgresql://localhost:5432/eliza`
- **Recommendation:** Add `PROD_DATABASE_URL` to `.env` for future analysis, or run analysis directly on Render

### message_logs Schema
| Column | Purpose |
|--------|---------|
| user_phone | WhatsApp phone (lookup key) |
| user_name, user_role | User context |
| message_text | Original question (pre-rewrite) |
| response_text | Final response (post-personality) |
| intent | Resolved intent name |
| input_tokens, output_tokens, total_tokens | API usage |
| model_intent | 'router' / 'claude-haiku-4-5-20251001' / 'hybrid_sql' |
| model_answer | 'claude-sonnet-4-6' |
| duration_ms | End-to-end latency |
| is_command | Boolean (.brief, .help etc.) |
| error | Error message if failed |

### Token Cost Estimation (per message)
Based on code analysis:
- **Router match (best case):** 0 intent tokens + ~300-500 Sonnet answer tokens = minimal cost
- **Haiku fallback:** ~500-800 Haiku intent tokens + ~300-500 Sonnet answer tokens
- **Hybrid SQL:** ~800-1200 Sonnet SQL gen tokens + ~300-500 Sonnet answer tokens = 2x cost
- **With rewrite:** Add ~300-500 Haiku rewrite tokens

### Missing from Logs
- `rewritten_question` — the question after conversationMemory rewrite is NOT logged, only original `message_text`
- `hybrid_sql` — when hybrid SQL is used, the generated SQL is not logged
- `scope_applied` — no indication of whether scope was applied or which user scope was active

---

## 2. INTENT COVERAGE ANALYSIS

### Router Keyword Rules (12 intents)
| # | Intent | Keyword Count | Coverage Quality |
|---|--------|--------------|-----------------|
| 1 | days_to_event | 10 phrases | Good — TR/EN/FR |
| 2 | payment_status | 11 phrases | Good — but no actual balance data (TODO in code) |
| 3 | rebooking_rate | 10 phrases | Good — TR/EN/FR |
| 4 | price_per_m2 | 13 phrases | Good — multi-scenario |
| 5 | monthly_trend | 6 phrases | Moderate — missing "monthly sales", "aylık satış" |
| 6 | top_agents | 12 phrases | Good — includes "satis yapmayan" |
| 7 | agent_country_breakdown | 4 phrases | Weak — only 4 patterns |
| 8 | agent_expo_breakdown | 3 phrases | Weak — only 3 patterns |
| 9 | exhibitors_by_country | 5 phrases | Moderate |
| 10 | country_count | 6 phrases | Good — TR/EN/FR |
| 11 | revenue_summary | 26 phrases | Excellent — many time-period variations |
| 12 | expo_list | 14 phrases | Good — risk + general |

**Total keyword phrases:** ~120

### buildQuery Intents (19 intents)
| Intent | In Router? | In buildQuery? | SQL Quality |
|--------|-----------|---------------|-------------|
| expo_progress | No | Yes | Good — JOINs expos + edition_contracts |
| agent_performance | No | Yes | Good — expo variant + plain variant |
| agent_country_breakdown | Yes | Yes | Good |
| agent_expo_breakdown | Yes | Yes | Good |
| country_count | Yes | Yes | Good |
| exhibitors_by_country | Yes | Yes | Good — expo-specific + general |
| top_agents | Yes | Yes | Good — period/relative_days variants |
| revenue_summary | Yes | Yes | Excellent — 6 time period variants |
| expo_list | Yes | Yes | Good — risk + year + upcoming |
| expo_agent_breakdown | No | Yes | Good |
| expo_company_list | No | Yes | Good — GROUP BY prevents duplicates |
| monthly_trend | Yes | Yes | Good — agent variant |
| cluster_performance | No | Yes | Good — year + upcoming |
| payment_status | Yes | Yes | **Weak — no actual balance/payment data (TODO)** |
| rebooking_rate | Yes | Yes | Good — expo/country/general |
| price_per_m2 | Yes | Yes | Good — expo + general |
| days_to_event | Yes | Yes | Good |
| company_search | No | Yes | Moderate — uses expo_name/agent_name for company search |
| general_stats | N/A | Yes (default) | Basic — current year summary |

### Router Gap: 7 Intents Not in Router
These intents can ONLY be reached via Haiku LLM fallback:
1. **expo_progress** — "SIEMA 2026 nasıl gidiyor?" → Haiku must classify
2. **agent_performance** — "Elif ne kadar sattı?" → Haiku must classify
3. **expo_agent_breakdown** — "SIEMA'da kim satmış?" → Haiku must classify
4. **expo_company_list** — "SIEMA'daki firmalar" → Haiku must classify
5. **cluster_performance** — "Nigeria cluster" → Haiku must classify
6. **company_search** — "XYZ firması" → Haiku must classify
7. **compound** — multi-question → always Haiku

**Impact:** The most common CEO questions ("SIEMA nasıl?", "Elif kaç satmış?") ALWAYS require a Haiku API call. Adding router rules for these would save ~50% of intent API costs.

### Hybrid Text-to-SQL
- **Code:** `generateSQL()` exists (line 868), called when `intent=general_stats` with empty entities
- **Trigger:** Router fails → Haiku returns `general_stats` with no entities → hybrid activates
- **Safety:** validateSQL + 3s timeout + max 5 JOINs + NO_QUERY handling
- **Cost:** Uses Sonnet (expensive) for SQL generation + Sonnet for answer = double Sonnet cost
- **Production usage:** Unknown (no access to production logs)

### Intent Flow Summary
```
Question → Router (12 rules, 0 API)
  ↳ match → buildQuery directly
  ↳ no match → Haiku LLM (19 valid intents)
    ↳ classified → buildQuery
    ↳ general_stats + no entities → Hybrid SQL (Sonnet)
      ↳ SQL generated → execute with timeout
      ↳ NO_QUERY → fallback to general_stats template
```

---

## 3. RESPONSE QUALITY ANALYSIS

### Sonnet Answer Prompt (12 rules)
Quality rules in `generateAnswer()`:
1. Key insight first
2. Max 2-3 sentences
3. State totals first
4. No bullets/lists/markdown
5. No headers/bold/formatting
6. Number format: 1.234, €1.234, %45
7. Date format: 22 Eylül 2026
8. Out-of-scope handling
9. Never invent data
10. Max 3 items in lists
11. Language matching
12. Real total when rows are trimmed

### Potential Issues (Code-based)

**Data Trimming:**
- `generateAnswer()` sends max 5 rows to Sonnet (`trimmedData = data.slice(0, 5)`)
- Adds `Total rows: N (showing first 5)` note
- Rule 12 tells Sonnet to use real total
- Risk: Sonnet may still describe only visible rows

**Response Length:**
- `max_tokens: 300` for answer — good constraint
- WhatsApp 4000 char limit not enforced in code (personality wrapper can add ~100 chars)
- No character count validation before sending

**Language Detection:**
- Accent-normalized word scoring (handler.js `detectLang`)
- Default: Turkish (if no match)
- Risk: Short queries like "SIEMA 2026?" → no language words → defaults to TR
- Sonnet prompt says "respond in ${langName}" but Sonnet may not always comply

**"No Data" Handling:**
- If query returns empty `data`: Sonnet sees `Data: []` → should say "No data found"
- If hybrid SQL fails: falls back to `general_stats` template → returns current year summary (misleading)
- No explicit "I don't understand" response — always tries to return something

### Formatting (handler.js)
- `rowToLine()` builds labeled lines: "Elif AY — 11 kontrat — 234 m² — €76.715"
- Date formats: TR "19-Mayıs-2026", EN "Sep 22 2026", FR "19-mai-2026"
- Currency: TR "€76.715", EN "€76,715", FR "76 715 €"
- Max 5 rows + "... ve X sonuç daha" + dashboard link
- Data rows are NOT sent to WhatsApp anymore (only Sonnet answer)

---

## 4. ARCHITECTURAL ISSUES

### 4.1 payment_status — No Real Payment Data
```javascript
// TODO: Add balance field from Zoho Balance1 formula field
case 'payment_status':
```
- Current SQL returns `revenue_eur` as "total" — this is contract value, NOT payment status
- No `balance`, `received_payment`, `remaining_payment` fields in local DB
- These fields exist in Zoho (Balance1, Received_Payment, Remaining_Payment) but not synced
- **Severity: HIGH** — payment_status intent is misleading

### 4.2 company_search — Wrong Entity Source
```javascript
case 'company_search':
  params: [`%${e.expo_name || e.agent_name || ''}%`]
```
- Uses `expo_name` or `agent_name` entity as company name search term
- No dedicated `company_name` entity extraction in router or Haiku prompt
- If user says "ABC firması hakkında bilgi" → Haiku may not extract "ABC" into expo_name
- **Severity: MEDIUM** — company_search may not work reliably

### 4.3 cluster_performance — Uses Country as Cluster
```javascript
case 'cluster_performance':
  WHERE e.country ILIKE $1 // uses cluster_name which comes from... where?
  params: [`%${e.cluster_name || ''}%`]
```
- `cluster_name` entity is never extracted by router or Haiku (not in entity list)
- Falls back to empty string → `%` → returns all expos
- Haiku intent prompt mentions cluster but extraction is unreliable
- **Severity: MEDIUM** — cluster queries return unfiltered data

### 4.4 ELAN EXPO Exclusion — String Interpolation
```javascript
const EXCL_AGENT = `AND c.sales_agent != '${INTERNAL_AGENT}'`;
```
- Uses string interpolation (not parameterized) for ELAN EXPO exclusion
- Not a SQL injection risk (constant value) but inconsistent with parameterized approach
- Applied in 8 of 19 intents — some intents may miss it
- `agent_country_breakdown` does NOT exclude ELAN EXPO — should it?
- **Severity: LOW** — cosmetic, not a bug

### 4.5 applyScope — Alias Detection Fragility
```javascript
const hasAliasC = /\bc\.\w+/i.test(sql);
const salesAgentCol = hasAliasC ? 'c.sales_agent' : 'sales_agent';
```
- Regex-based alias detection works for current SQL templates
- If a template uses alias `ct.` or `fc.` instead of `c.`, scope injection breaks silently
- Hybrid SQL from Sonnet may use different aliases → scope not applied correctly
- **Severity: MEDIUM** — hybrid SQL scope enforcement may fail

### 4.6 Hybrid SQL — No Scope Enforcement
```javascript
if (sqlResult.sql) {
  const validatedSQL = validateSQL(sqlResult.sql);
  await query('SET statement_timeout = 3000');
  const result = await query(validatedSQL);
```
- `applyScope()` is NOT called on hybrid SQL results
- A manager/agent using hybrid SQL sees ALL data (no scope filtering)
- **Severity: HIGH** — data scope bypass for non-CEO users via hybrid SQL

### 4.7 Conversation Memory — Backward Compatibility
```javascript
// getHistory now returns { messages, lastMessageTime }
// BUT error path and empty path return the same format
if (!userPhone) return { messages: [], lastMessageTime: null };
```
- handler.js destructures: `const { messages: history, lastMessageTime: lmt } = await getHistory(...)`
- If getHistory throws before try/catch, destructuring fails → handler error
- Old callers (if any) expecting array would break
- **Severity: LOW** — only one caller (handler.js), already updated

### 4.8 Self-Reference Replacement — Overly Broad
```javascript
questionText = questionText
  .replace(/\bmy\b/gi, agentName)
```
- "my" → agent name for ALL non-CEO users
- "what is my role?" → "what is Elif AY role?" → incorrect
- "show my data" → "show Elif AY data" → works
- No context check — always replaces
- **Severity: LOW** — edge case, unlikely in practice

---

## 5. TOP 5 ISSUES & RECOMMENDATIONS

### Issue #1: Hybrid SQL Bypasses Data Scope (CRITICAL)
**Problem:** `generateSQL()` output is not passed through `applyScope()`. Any non-CEO user whose question falls into hybrid SQL sees unfiltered data.
**Fix:** Add `applyScope()` call after `validateSQL()` in the hybrid SQL path:
```javascript
if (sqlResult.sql) {
  let validatedSQL = validateSQL(sqlResult.sql);
  const scoped = applyScope(validatedSQL, [], intent, user);
  validatedSQL = scoped.sql;
  await query('SET statement_timeout = 3000');
  const result = await query(validatedSQL, scoped.params);
}
```
**Effort:** 30 minutes | **Impact:** Security fix

### Issue #2: payment_status Returns Revenue, Not Payments (HIGH)
**Problem:** The payment_status intent shows contract revenue, not actual payment balance. No balance/received/remaining fields are synced from Zoho.
**Fix:**
1. Add `balance`, `received_payment`, `remaining_payment` to contracts sync from Zoho (fields: Balance1, Received_Payment, Remaining_Payment)
2. Update `payment_status` SQL to show actual balance data
3. Until sync is ready: add disclaimer to payment responses
**Effort:** 3-4 hours | **Impact:** Feature completion

### Issue #3: 7 Core Intents Missing from Router (MEDIUM)
**Problem:** expo_progress, agent_performance, expo_agent_breakdown, expo_company_list, cluster_performance, company_search, compound — all require Haiku API call. The most common CEO patterns ("SIEMA nasıl?", "Elif kaç satmış?") are not routed.
**Fix:** Add router rules:
```javascript
// expo_progress
{ intent: 'expo_progress', keywords: [
  ['nasil gidiyor'], ['progress'], ['ilerleme'], ['durum'],
  ['kac m2 satilmis'], ['how is', 'doing'],
]},
// agent_performance
{ intent: 'agent_performance', keywords: [
  ['kac satmis'], ['ne kadar satmis'], ['performans'],
  ['how much', 'sold'], ['kac m2 satmis'],
]},
```
**Effort:** 1-2 hours | **Impact:** Cost reduction (~50% fewer Haiku calls)

### Issue #4: No Production DB Access for Analysis (MEDIUM)
**Problem:** `.env` only has `localhost` DB. Cannot analyze production message_logs, token usage, error rates, or user behavior.
**Fix:**
1. Add `PROD_DATABASE_URL` or `RENDER_EXTERNAL_DATABASE_URL` to `.env`
2. Create `scripts/analyze-logs.js` that connects to production and generates reports
3. Add `npm run analyze` command
**Effort:** 1 hour | **Impact:** Enables data-driven improvement

### Issue #5: Missing Log Fields for Debugging (LOW-MEDIUM)
**Problem:** message_logs doesn't capture: rewritten question, hybrid SQL query, scope applied, conversation history used.
**Fix:** Add columns to message_logs:
```sql
ALTER TABLE message_logs ADD COLUMN rewritten_question TEXT;
ALTER TABLE message_logs ADD COLUMN generated_sql TEXT;
ALTER TABLE message_logs ADD COLUMN scope_applied VARCHAR(20);
```
Update `logMessage()` in handler.js to populate these fields.
**Effort:** 1-2 hours | **Impact:** Debugging and quality analysis

---

## 6. SYSTEM HEALTH SUMMARY

| Component | Status | Score |
|-----------|--------|-------|
| Intent Router | 12/19 intents covered | 63% |
| SQL Templates | 19 intents, well-structured | 90% |
| Scope Enforcement | Works for templates, NOT for hybrid | 70% |
| Conversation Memory | Working (FIX 4: greeting suppression done) | 85% |
| Language Detection | Accent-normalized, word-boundary | 90% |
| Personality Engine | Time-aware, nickname-based, repetition-aware | 95% |
| Hybrid SQL | Exists but no scope, not battle-tested | 50% |
| Payment Data | Revenue only, no actual payment tracking | 20% |
| Logging | Basic — missing rewrite/SQL/scope fields | 60% |
| Error Handling | try/catch everywhere, logged to DB | 80% |

### Local DB Stats
| Table | Rows | Notes |
|-------|------|-------|
| contracts | 3,521 | Synced from Zoho |
| expos | 1,227 | All editions, all years |
| edition_contracts | 3,012 | Valid + Transferred In |
| fiscal_contracts | 3,035 | Valid + Transferred Out |
| sales_agents | 109 | All agents |
| expo_metrics | 14 | Current upcoming expos |
| users | 2 | CEO + Elif |
| message_logs | 0 | Local only — production has data |

---

## Priority Action Plan

| # | Action | Severity | Effort | Files |
|---|--------|----------|--------|-------|
| 1 | Fix hybrid SQL scope bypass | CRITICAL | 30 min | queryEngine.js |
| 2 | Add production DB URL for analysis | MEDIUM | 15 min | .env |
| 3 | Add router rules for top 4 missing intents | MEDIUM | 1-2 hrs | router.js |
| 4 | Sync payment fields from Zoho | HIGH | 3-4 hrs | zoho-sync, queryEngine.js |
| 5 | Add debug columns to message_logs | LOW | 1-2 hrs | migration, handler.js |
