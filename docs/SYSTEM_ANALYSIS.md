# ELIZA — Comprehensive System Analysis
Generated: 2026-03-16 | Analyst: Claude Code

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
| rewritten_question | Question after conversationMemory rewrite |
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

---

## 2. INTENT COVERAGE ANALYSIS

### Router Keyword Rules (20+ intents)
| # | Intent | Coverage Quality |
|---|--------|-----------------|
| 1 | days_to_event | Good — TR/EN/FR |
| 2 | payment_status | Good — but no actual balance data (TODO in code) |
| 3 | rebooking_rate | Good — TR/EN/FR |
| 4 | price_per_m2 | Good — multi-scenario |
| 5 | monthly_trend | Moderate — covers key patterns |
| 6 | expo_progress | Good — includes multi-metric patterns (m2+gelir, kontrat+gelir) |
| 7 | agent_performance | Good — TR/EN/FR performance patterns + period support |
| 8 | expo_agent_breakdown | Good — "kim satmis" + expo patterns |
| 9 | top_agents | Good — includes "satis yapmayan" |
| 10 | agent_country_breakdown | Moderate — 4 patterns |
| 11 | agent_expo_breakdown | Moderate — 3 patterns |
| 12 | exhibitors_by_country | Moderate |
| 13 | country_count | Good — TR/EN/FR |
| 14 | revenue_summary | Excellent — time-period + month range + compare keywords |
| 15 | contract_list | Good — listele/list keywords for individual rows |
| 16 | expo_list | Good — risk + general |

### buildQuery Intents (25 intents)
| Intent | In Router? | SQL Quality |
|--------|-----------|-------------|
| expo_progress | Yes | Good — JOINs expos + edition_contracts, multi-metric |
| agent_performance | Yes | Good — expo variant + plain variant + period support |
| agent_country_breakdown | Yes | Good |
| agent_expo_breakdown | Yes | Good |
| expo_agent_breakdown | Yes | Good |
| country_count | Yes | Good |
| exhibitors_by_country | Yes | Good — expo-specific + general |
| top_agents | Yes | Good — period/relative_days variants |
| revenue_summary | Yes | Excellent — 6 time period + month range + compare variants |
| contract_list | Yes | Good — period/agent/expo filters, individual rows |
| expo_list | Yes | Good — risk + year + upcoming |
| expo_company_list | No | Good — GROUP BY prevents duplicates |
| monthly_trend | Yes | Good — agent variant |
| cluster_performance | No | Good — year + upcoming |
| payment_status | Yes | **Weak — no actual balance/payment data (TODO)** |
| rebooking_rate | Yes | Good — expo/country/general |
| price_per_m2 | Yes | Good — expo + general |
| days_to_event | Yes | Good |
| company_search | No | Moderate — uses expo_name/agent_name for company search |
| general_stats | N/A | Basic — current year summary |

### Router Gap: 4 Intents Not in Router
These intents can ONLY be reached via Haiku Semantic Frame fallback:
1. **expo_company_list** — "SIEMA'daki firmalar" → Haiku must classify
2. **cluster_performance** — "Nigeria cluster" → Haiku must classify
3. **company_search** — "XYZ firmasi" → Haiku must classify
4. **compound** — multi-question → always Haiku

### Semantic Frame Extraction
- **Primary:** extractSemanticFrame() replaces extractIntent()
- **Fast path:** Router keyword match → {intent, entities, confidence: 1.0} — 0 API cost
- **Fallback:** Haiku FRAME_PROMPT → structured JSON frame with task types, ambiguity_flags, answerability
- **14 few-shot examples** including multi-metric expo questions
- **COMPOUND vs SINGLE INTENT rule:** same entity + multiple metrics = single intent (expo_progress), NOT compound
- **Backward-compatible:** frame entities mapped to buildQuery/generateAnswer format

### Hybrid Text-to-SQL
- **Trigger:** intent=general_stats AND entities empty (router + Haiku failed)
- **Safety:** validateSQL + 3s timeout + max 5 JOINs + NO_QUERY handling
- **Scope:** CEO-only (data_scope=all) — non-CEO falls back to template path (ISSUE-019 fix)
- **Cost:** Double Sonnet (SQL gen + answer)

### Intent Flow Summary
```
Question → Router (20+ rules, 0 API)
  -> match → buildQuery directly
  -> no match → Haiku Semantic Frame (25 valid intents)
    -> classified → Ambiguity Gate
      -> unanswerable → refuse
      -> critical → clarification (year > expo > metric)
      -> answerable → buildQuery
    -> general_stats + no entities + CEO → Hybrid SQL (Sonnet)
      -> SQL generated → execute with timeout
      -> NO_QUERY → fallback to general_stats template

Special redirects: revenue_summary + expo_name → expo_progress (edition view), revenue_summary + agent_name → agent_performance (agent filter)
```

---

## 3. RESPONSE QUALITY ANALYSIS

### Sonnet Answer Prompt (15 rules)
Quality rules in `generateAnswer()`:
1. Key insight first
2. Max 2-3 sentences
3. State totals first
4. No bullets/lists/markdown
5. No headers/bold/formatting
6. Number format: 1.234, EUR1.234, %45
7. Date format: 22 Eylul 2026
8. Out-of-scope handling
9. Never invent data
10. Max 3 items in lists
11. Language matching
12. Real total when rows are trimmed
13-14. Assumption transparency (Sonnet states which filters/defaults applied)
15. Terminology per language (TR: katilimci/fuar/gelir, FR: exposant/salon/chiffre d'affaires)

### Formatting (handler.js)
- `rowToLine()` builds labeled lines: "Elif AY — 11 kontrat — 234 m2 — EUR76.715"
- Date formats: TR "19-Mayis-2026", EN "Sep 22 2026", FR "19-mai-2026"
- Currency: TR "EUR76.715", EN "EUR76,715", FR "76 715 EUR"
- Max 5 rows + "... ve X sonuc daha" + dashboard link
- Data rows are NOT sent to WhatsApp (only Sonnet answer)
- Dashboard deep links: 11 expo intents → /expos?year=YYYY, 8 sales intents → /sales

---

## 4. ARCHITECTURAL ISSUES

### 4.1 payment_status — No Real Payment Data
- Current SQL returns `revenue_eur` as "total" — this is contract value, NOT payment status
- No `balance`, `received_payment`, `remaining_payment` fields in local DB
- These fields exist in Zoho (Balance1, Received_Payment, Remaining_Payment) but not synced
- **Severity: HIGH** — payment_status intent is misleading

### 4.2 company_search — Wrong Entity Source
- Uses `expo_name` or `agent_name` entity as company name search term
- No dedicated `company_name` entity extraction
- **Severity: MEDIUM** — company_search may not work reliably

### 4.3 cluster_performance — Uses Country as Cluster
- `cluster_name` entity is never reliably extracted by router or Haiku
- Falls back to empty string → returns all expos
- **Severity: MEDIUM** — cluster queries return unfiltered data

### 4.4 ELAN EXPO Exclusion — String Interpolation
- Uses string interpolation (not parameterized) for ELAN EXPO exclusion
- Not a SQL injection risk (constant value) but inconsistent
- **Severity: LOW** — cosmetic

### 4.5 applyScope — Alias Detection
- Regex-based alias detection works for current SQL templates
- Hybrid SQL now CEO-only, so alias mismatch risk is mitigated
- **Severity: LOW** — hybrid SQL scope bypass fixed (ISSUE-019)

---

## 5. TOP ISSUES & RECOMMENDATIONS

### Issue #1: payment_status Returns Revenue, Not Payments (HIGH)
**Problem:** payment_status intent shows contract revenue, not actual payment balance.
**Fix:** Sync balance/received/remaining fields from Zoho, update SQL template.
**Effort:** 3-4 hours

### Issue #2: No Production DB Access for Analysis (MEDIUM)
**Problem:** `.env` only has localhost DB. Cannot analyze production logs.
**Fix:** Add `PROD_DATABASE_URL` to `.env`, create analysis scripts.
**Effort:** 1 hour

### Issue #3: company_search Entity Extraction (MEDIUM)
**Problem:** No dedicated company_name entity — uses expo_name/agent_name as proxy.
**Fix:** Add company_name entity extraction to Haiku prompt + router.
**Effort:** 1-2 hours

---

## 6. SYSTEM HEALTH SUMMARY

| Component | Status | Score |
|-----------|--------|-------|
| Intent Router | 20+ rules, covers most patterns | 88% |
| Semantic Frame | Haiku structured extraction + ambiguity gate | 90% |
| SQL Templates | 25 intents, well-structured | 90% |
| Scope Enforcement | Templates + hybrid (CEO-only) | 90% |
| Conversation Memory | Conservative rewrite + always-independent bypass | 90% |
| Language Detection | Accent-normalized, word-boundary, 3 languages | 90% |
| Personality Engine | Time-aware, nickname-based, per-user | 95% |
| Clarification System | Multi-turn, 3 slots, cancel, context-aware | 90% |
| Fuzzy Matching | Expo names + country aliases + demonym stripping | 85% |
| Hybrid SQL | CEO-only, validated, timeout-protected | 75% |
| Payment Data | Revenue only, no actual payment tracking | 20% |
| Logging | Tokens, duration, intent, rewritten_question | 75% |
| Error Handling | try/catch everywhere, logged to DB | 80% |
| Dashboard | War Room + 5 admin pages + expo directory + sales | 90% |

### Local DB Stats
| Table | Rows | Notes |
|-------|------|-------|
| contracts | 3,521 | Synced from Zoho |
| expos | 1,227 | All editions, all years |
| edition_contracts | 3,012 | Valid + Transferred In |
| fiscal_contracts | 3,035 | Valid + Transferred Out |
| sales_agents | 109 | All agents |
| expo_metrics | 14 | Current upcoming expos |
| users | 2+ | CEO + team members |
| message_logs | 0 | Local only — production has data |
