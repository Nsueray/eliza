# ELIZA Intelligence Upgrade Roadmap v2
## From Template Bot → CEO Operating System

Consolidated from: Claude (architect), Gemini (strategic), Grok (practical), ChatGPT (technical)

---

## Current Architecture

Question → Conversation Memory → Haiku Rewrite → Router (keyword) → Haiku (fallback intent) → SQL Template → applyScope (user filter) → PostgreSQL → Sonnet (answer) → Personality Engine → WhatsApp

---

## Completed

### Phase 12a+12b: Conversation Memory + Question Rewrite
- getHistory() from message_logs (last 5 messages, 2-hour window)
- rewriteQuestion() via Haiku (follow-up → full self-contained question)
- Entity carry-forward: expo names, agent names, countries, metrics
- Pipeline preserved: rewrite feeds into normal router → template flow

---

## Next Phases

### Phase 12c: CEO Notes + Semantic Recall
- .note command: CEO drops notes via WhatsApp
- Entity matching: if query mentions entity with note → append reminder
- Connect to Attention Engine: .note updates last_reviewed_at

### Phase 13: Answer Quality
- Enhanced Sonnet system prompt (key insight first, max 400 chars, action suggestions)
- Language validation (detected lang vs answer lang)
- Explainability for risk (velocity comparison, not just label)

### Phase 14: Hybrid Text-to-SQL ✅ COMPLETED
- Fallback for unknown intents (router → template → LLM SQL via Sonnet)
- Semantic layer in prompt (DB schema + business rules)
- Safety: validateSQL, statement_timeout 3s, join limit 5, NO_QUERY handling
- Trigger: intent=general_stats with empty entities

### Phase 15: Learning & Feedback
- .correct command via WhatsApp
- Preference memory (default year, entity preferences)
- Popular query analytics from message_logs

### Phase 16: Proactive Attention & Alerts
- Auto morning brief at 07:00
- Threshold alerts (velocity drop, inactive agent, cancellation trends)
- Attention reminders (unreviewed offices/expos)

### Phase 17: Action Layer Integration
- Alert → suggest action → CEO approval → execute
- Connect Message Generator to Attention Engine
- Human-in-the-loop preserved (non-negotiable)

### Phase 18: Organizational Memory (Future)
- Exhibitor patterns, office history, CEO decisions
- Full relationship tracking

---

## Execution Plan

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | 12c: CEO Notes | 2 hours | HIGH |
| 2 | 13: Answer Quality | 1 hour | MEDIUM |
| 3 | 14: Hybrid Text-to-SQL | 5-7 hours | HIGH |
| 4 | 15: Learning | 3 hours | MEDIUM |
| 5 | 16: Proactive Alerts | 3 hours | HIGH |
| 6 | 17: Action Layer | 3 hours | HIGH |
| 7 | 18: Org Memory | ongoing | HUGE |

---

## Key Design Decisions

1. message_logs over Redis/Map — already exists, survives restarts
2. Question rewrite over direct context injection — keeps pipeline deterministic
3. Semantic layer in prompt, not separate file — simpler
4. 2-hour conversation window with LIMIT 5 — covers work session
5. WhatsApp-native learning over admin page — shadow mode compatible
6. Explainability via velocity comparison, not SHAP — practical for CEO
7. No auto-template generation — too risky, manual review required
8. Human-in-the-loop preserved for all actions — non-negotiable
