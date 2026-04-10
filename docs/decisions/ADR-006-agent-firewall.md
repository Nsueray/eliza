# ADR-006: Transient Agents Access LİFFY Only

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Security

---

## Context

Elan Expo has offices in Nigeria, Morocco, Kenya, Algeria, and uses temporary/freelance sales agents. These agents have high turnover — they come and go. Giving them access to ELIZA (which holds contracts, payments, company data) creates security risk.

## Decision

Sales agents — especially transient ones — interact with LİFFY only. They never see ELIZA. They never see contracts, payments, or other agents' data. LİFFY is their entire world.

**The firewall:** the highest-turnover user group has access to the lowest-risk system.

| Agent Type | ELIZA | LİFFY | LEENA |
|-----------|-------|-------|-------|
| Staff sales agent | No access | Own pipeline only | No access |
| Temp/freelance agent | No access | Own pipeline, time-limited | No access |
| Country manager | Country-scoped | Country pipeline | Country ops |

## Why This Matters

- A departing agent with ELIZA access could see sensitive financial data
- Agents from different countries shouldn't see each other's pipeline
- LİFFY's data (leads, outreach activity) is low-risk — losing it is annoying, not dangerous
- Contract and payment data is high-risk — unauthorized access or modification could be damaging

## Consequences

- LİFFY must have its own scoped access control (agents see only their own data)
- Time-limited accounts for freelance agents (auto-deactivate after engagement ends)
- ELIZA's user list remains small and controlled: CEO, Elif, Yaprak, country managers, finance
- No "agent self-service" features in ELIZA — all agent-facing features go in LİFFY

## Related Decisions

- ADR-003 (Quote-contract separation)
- ADR-011 (Payment authority — OPEN)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
