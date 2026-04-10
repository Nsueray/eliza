# ADR-005: ELIZA Writes Authority Data, Not Field Data

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Architecture
**Supersedes:** Original "ELIZA never writes" principle

---

## Context

The original ELIZA design principle was: "ELIZA reads from LİFFY and LEENA, never writes its own operational data." This was correct when ELIZA was purely an intelligence layer reading from Zoho.

But ELIZA has already evolved — it writes targets, alerts, message_logs, conversation memory. The "never writes" principle was already broken in practice.

With ELL v2.1, ELIZA needs to write contracts and payments. The original principle needs revision.

## Decision

The revised principle: **ELIZA writes data that requires authority. It does not write data that requires fieldwork.**

| Category | ELIZA Behavior | Examples |
|----------|---------------|----------|
| Authority data | ELIZA WRITES (source of truth) | Contracts, payments, companies, users, approvals, audit logs |
| Intelligence data | ELIZA WRITES (always did) | Targets, alerts, metrics, message_logs, conversation memory |
| Fieldwork data | ELIZA DOES NOT WRITE | Leads, quotes, emails, floorplans, visitor data |

## The Test

"Does creating this data require authorization or approval?" → ELIZA.
"Does creating this data require being in the field or doing outreach?" → LİFFY or LEENA.

## Why Not Keep "ELIZA Never Writes"

- ELIZA already writes intelligence data — the principle was inconsistent
- Contracts and payments require authority, not fieldwork — they belong where authority lives
- Keeping them in Zoho (or putting them in LİFFY) means the authority system doesn't own the authority data

## Consequences

- ELIZA's codebase now includes CRUD for contracts and payments
- ELIZA needs proper transaction handling and data validation
- Audit logging is mandatory for all write operations
- The WhatsApp bot remains read-only — it queries, never writes business data

## Related Decisions

- ADR-001 (ELIZA as commercial core)
- ADR-003 (Quote-contract separation)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
