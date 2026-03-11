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

## Production URLs
- Dashboard: https://eliza.elanfairs.com
- API: https://eliza-api-8tkr.onrender.com
- Bot: https://eliza-bot-r1vx.onrender.com
- WhatsApp: +1 810-255-5377

## In Progress
- Phase 12c: CEO Notes with semantic recall

## Next Phases

### Phase 12: Conversation Memory (CRITICAL)
- 12a: Conversation history from message_logs (last 5 messages within 2 hours)
- 12b: Question rewrite via Haiku (follow-up → full question → normal pipeline)
- 12c: CEO Notes with semantic recall (.note command + entity matching)

### Phase 13: Answer Quality
- Enhanced Sonnet system prompt (key insight first, max 400 chars, action suggestions)
- Language validation
- Explainability for risk answers (velocity comparison)

### Phase 14: Hybrid Text-to-SQL
- Fallback for unknown intents (router → template → LLM SQL)
- Semantic layer in prompt (business definitions)
- Safety: EXPLAIN cost, join limit 5, statement_timeout 3s, confidence scoring

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
