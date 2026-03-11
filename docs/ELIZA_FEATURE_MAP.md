# ELIZA — System Feature Map
Version: v2 | Owner: Elan Expo

## Architecture
CEO → WhatsApp → Twilio → Bot → Intent Router →
Haiku (fallback) → SQL Templates → PostgreSQL → Sonnet → Response

## Intelligence Layers
1. Data Layer — Zoho sync, PostgreSQL
2. Insight Layer — War Room Dashboard
3. Attention Layer — Attention Engine
4. Risk Layer — Risk Engine
5. Action Layer — Alerts + Message Generator
6. Memory Layer — Notes + Patterns (planned)

## WhatsApp Commands
.brief — morning brief
.risk [expo] — expo risk
.attention — attention items
.msg [kisi] [konu] — mesaj taslagi
.today [not] — gunluk not
.note [not] — kalici not
.help — komutlar

## AI Pipeline
Question → router.js (0 API) → Haiku intent (fallback) →
SQL template → PostgreSQL → Sonnet answer → WhatsApp
Rule: Claude never generates SQL
Logging: every message logged with tokens, duration, intent to message_logs

## Models
Intent: claude-haiku-4-5-20251001
Answer: claude-sonnet-4-6

## Message Logging
- Table: message_logs (user, message, response, intent, tokens, duration, model, error)
- Token tracking: router (0 token) / Haiku (intent) / Sonnet (answer)
- API: GET /api/logs, GET /api/logs/summary
- Admin: /admin/logs (ozet + mesaj listesi)

## User Roles (implemented)
CEO — full access (data_scope: all)
Manager — team data (data_scope: team)
Agent — own data (data_scope: own)

## Key Business Rules
- ELAN EXPO: revenue dahil, count/m2/ranking haric
- Max 5 rows WhatsApp, dashboard link
- Tarih format: 19-Mayis-2026 (no auto-link)
- Dil: TR/EN/FR otomatik algilama
