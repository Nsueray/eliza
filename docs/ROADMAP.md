# ELIZA — Roadmap

## Completed
- Phase 1: Data Infrastructure (PostgreSQL, Zoho Sync)
- Phase 2: War Room Dashboard
- Phase 3: AI Query Engine (19 intents, %98 benchmark)
- Phase 3b: Risk Engine (velocity model)
- Phase 4: Attention Engine
- Phase 5: Alert Generator + Morning Brief
- Phase 6: Message Generator (4 templates, 3 languages, .msg command)
- Phase 8a: WhatsApp Bot (Twilio, auth, personality)
- Phase 11: Deploy (Render — 3 services + PostgreSQL)
- Multi-user system (roles: ceo/manager/agent, data scope enforcement)
- Admin Panel (/admin — user CRUD, permissions)
- Message Logging (/admin/logs — tokens, duration, intent tracking)
- Personality Engine (nicknames, time-aware greetings)
- Data Scope Enforcement (user-level access control in queryEngine)
- Language Detection fix (accent-insensitive)
- Phase 12a+12b: Conversation Memory + Question Rewrite (Haiku)
- Phase 14: Hybrid Text-to-SQL (Sonnet SQL fallback for unknown intents)
- Intelligence Roadmap v4 — Immediate Execution Plan
  - Hybrid SQL scope fix (CEO-only restriction) — ISSUE-019
  - 3 new router rules (expo_progress, agent_performance, expo_agent_breakdown) — router now 15 rules
  - Unavailability response ("Bilmiyorum" — payment_balance, currency, salary, general_knowledge)
  - Sonnet assumption transparency (rules 13-14 in prompt)
  - Log enrichment (rewritten_question column, migration 008)
  - Year filter default (ISSUE-020 — expo/agent queries default to current year)
  - Benchmark: 96% PASS (48/50)
- Mini Clarification System
  - Ambiguity detection in router + Haiku (missing_year, missing_metric, missing_expo)
  - Year clarification: DB edition lookup → ask user when multiple editions exist
  - Expo clarification: upcoming expo list when expo not specified
  - Pending state: users.pending_clarification JSONB, 10min expire, max 1 turn
  - Handler: resolve numbered/text replies, rebuild question, clear pending
  - Migration: 009_pending_clarification.sql
- Admin Dashboard Upgrade
  - /admin/logs: message cards, Copy button (with "Copied!" feedback), filters (user/intent/status/date), Doughnut + Bar charts
  - /admin/intelligence: router rules, intent stats, benchmark viewer, clarification stats
  - /admin/system: service health, DB tables, sync status, active users, recent errors
  - Shared navigation: Logs | Intelligence | System | Users | War Room (all pages)
  - War Room + Expo Directory pages: full admin nav links added
  - API: /api/intelligence/* (4 endpoints), /api/system/status, enhanced /api/logs
  - Emoji unicode escapes replaced with plain text labels throughout
  - Health endpoint path fix (/api/health → /health)

## Production URLs
- Dashboard: https://eliza.elanfairs.com
- API: https://eliza-api-8tkr.onrender.com
- Bot: https://eliza-bot-r1vx.onrender.com
- WhatsApp: +1 810-255-5377

## In Progress

(none currently)

## Next Phases

### Phase 12c: CEO Notes with semantic recall
- .note command + entity matching
- Semantic recall from stored notes

### Phase 13: Answer Quality
- Enhanced Sonnet system prompt (key insight first, max 400 chars, action suggestions)
- Language validation
- Explainability for risk answers (velocity comparison)

### Phase 15: Learning & Feedback
- CEO corrections via WhatsApp (.correct command)
- Preference memory (default year, entity preferences)
- Popular query analytics from message_logs

### Phase 16: Proactive Attention & Alerts
- Auto morning brief at 07:00
- Threshold alerts (velocity drop, inactive agent, cancellation trends)
- Attention reminders (unreviewed offices/expos)

### Phase 17: Action Layer Integration
- Alert → suggest action → CEO approval → execute
- Connect Message Generator to Attention Engine

### Phase 18: Organizational Memory (Future)
- Exhibitor patterns, office history, CEO decisions
- Full relationship tracking

## Benchmark
→ node packages/ai/benchmark.js (target: >= 90% PASS)

## Known Issues
→ docs/KNOWN_ISSUES.md
