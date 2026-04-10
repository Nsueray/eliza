# ADR-009: Sales Team Adoption Strategy

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Operations

---

## Question

Should LİFFY quote submission replace Zoho quote creation immediately, or run in parallel during a transition period?

## Decision

**Pilot with Bengü first, then expand. Value-first positioning, not forced migration.**

### Pilot Users
1. **Bengü** (confirmed) — aggressive sales agent, heavy data miner and email campaigner. Ideal first user.
2. **Second pilot** from Kenya or Morocco office — possibly Semih from Morocco.

### Adoption Strategy
- **DO NOT** position as "Zoho is being replaced"
- **DO** position as "this new platform makes your data mining and campaign management easier"
- Start with LİFFY's strength: mine → campaign → manage contacts
- Gradually add CRM features so LİFFY becomes indispensable
- Quote submission comes after agents are already using LİFFY daily for campaigns

### Phased Feature Rollout for Pilots
1. **First:** Data mining + email campaigns (LİFFY's current strength)
2. **Then:** CRM — manage campaign responses, track follow-ups, contact management
3. **Then:** Quote creation and submission to ELIZA
4. **Finally:** Full pipeline management

## Rationale

- Forced migration creates resistance — agents will find workarounds
- Value-first approach means agents WANT to use LİFFY
- Bengü is the right first user: high volume, tech-comfortable, will stress-test naturally
- Campaign data currently has no CRM follow-up in LİFFY — this gap must be closed before quote features

## Consequences

- LİFFY CRM features (post-campaign contact management) must be built before quote integration
- Bengü's feedback will shape the product for other agents
- Other agents remain on Zoho until pilot validates the workflow

## Related Decisions

- ADR-008 (Zoho exit — parallel approach)
- ADR-010 (Floorplan — not in Phase 1)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
