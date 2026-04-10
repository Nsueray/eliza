# ADR-001: ELIZA is the Commercial System of Record

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Architecture

---

## Context

Elan Expo has been using Zoho CRM for 10+ years as its primary operational system. Three new systems (ELIZA, LİFFY, LEENA) were being developed in parallel, but contracts and payments — the company's core business data — remained in Zoho. This meant ELL systems were auxiliary tools, not the business core.

ChatGPT proposed making ELIZA the unified center for everything. Claude proposed a domain-separated model.

## Decision

ELIZA becomes the **commercial** system of record — not the system of record for everything.

- **ELIZA** owns: contracts, payments, companies, users/permissions, approval workflows, audit logs, intelligence/analytics
- **LİFFY** owns: leads, outreach, pipeline, email campaigns, quotes
- **LEENA** owns: floorplans, exhibitor operations, visitor management, catalogs, fuar websites

Each system is authoritative for its own domain.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Keep Zoho as core, ELL as auxiliary | Zoho API limits, no real-time data, dual entry, no audit trail |
| New "ELL" system from scratch | Unnecessary cost, complexity, throws away existing work |
| Everything in ELIZA (ChatGPT proposal) | Kills LİFFY/LEENA SaaS potential, makes ELIZA a monolith, violates domain separation |
| Contracts in LİFFY (Claude initial proposal) | Wrong — sales agents don't create contracts, LİFFY is for fieldwork not authority |

## Consequences

- ELIZA's codebase grows to include CRUD for contracts and payments (previously read-only)
- Zoho sync becomes a migration bridge, not a permanent feature
- All three systems must agree on shared database schema conventions
- ELIZA's original "never writes" principle is revised (see ADR-005)

## Related Decisions

- ADR-002 (SaaS preservation)
- ADR-003 (Quote-contract separation)
- ADR-004 (Shared database)
- ADR-005 (ELIZA write policy)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
