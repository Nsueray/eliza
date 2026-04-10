# ADR-004: Shared Database with Schema-Level Ownership

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Architecture

---

## Context

Three systems need to share data without sync delays. Options were: separate databases with API calls, separate databases with sync, or a shared database.

## Decision

All three systems share a single PostgreSQL database with schema-level domain separation.

**The critical rule:** Each schema has exactly one owner service. Only the owner writes to its schema. Other services may read, but never write.

| Schema | Owner | Tables | Who Reads |
|--------|-------|--------|-----------|
| core | ELIZA | contracts, payments, companies, users, permissions, expos, audit_log | LİFFY, LEENA |
| sales | LİFFY | leads, quotes, outreach, pipeline, email_campaigns, opportunities | ELIZA |
| ops | LEENA | exhibitors, floorplans, stands, visitors, catalogs, fuar_websites | ELIZA |
| intelligence | ELIZA | message_logs, conversation_memory, expo_metrics, targets, alerts | — |

**Short term:** ownership enforced by convention and code review.
**Long term:** enforced by PostgreSQL database roles and permissions.

## Why Not Separate Databases

- Sync between databases creates delay, drift, and complexity
- Same-database reads are instant — when LİFFY writes a quote, ELIZA sees it immediately
- No need for message queues or event buses at this scale
- Render PostgreSQL is already a single instance

## Risk: Single Point of Failure

Mitigated by:
- Render automated daily backups
- Read replicas for analytics (future)
- Connection pooling per service
- Schema-level separation means a bug in LİFFY can't corrupt core data

## Consequences

- All three services need the same DATABASE_URL
- Schema migration must be coordinated
- Each service's codebase must clearly separate "my writes" from "their reads"
- Future: if scale demands it, schemas can be split into separate databases because the ownership boundaries are already clean

## Related Decisions

- ADR-001 (ELIZA as commercial core)
- ADR-005 (ELIZA write policy)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
