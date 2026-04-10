# ADR-013: SaaS Priority Level

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Strategy

---

## Question

Is the multi-tenant SaaS potential of LİFFY and LEENA a near-term revenue goal or a long-term option to preserve?

## Decision

**Long-term option. Not a priority, but keep the door open.**

### Context

- Suer has friends running similar exhibition companies who would likely ask to use the tools
- When they use LİFFY/LEENA, Suer gains access to their data — strategic intelligence advantage
- LEENA is particularly well-suited for standalone use (fuar registration only)
- Realistically, this won't happen in 1-2 years — maybe never
- But the possibility is appealing and worth preserving

### What This Means in Practice

**DO:**
- Keep LİFFY and LEENA generic — no Elan Expo-specific business logic in their codebase
- Maintain clean API boundaries between systems
- Use the SaaS test: "Would another organizer need this exact feature?"

**DON'T:**
- Build multi-tenant infrastructure now (tenant isolation, billing, onboarding)
- Spend time on SaaS packaging, pricing, or marketing
- Let SaaS considerations slow down Elan Expo-specific features in ELIZA

### The Data Angle

When friends use LİFFY/LEENA, they would know Suer sees their data. This is a feature, not a bug — it's a strategic advantage that creates value for both parties (Suer gets market intelligence, friends get free/cheap tools).

## Consequences

- Architecture stays clean (good for Elan Expo regardless of SaaS)
- No multi-tenant development cost in 2026-2027
- If opportunity arises, the systems are ready to accommodate external users with minimal changes
- LEENA standalone (registration-only mode) could be the easiest first SaaS offering

## Related Decisions

- ADR-002 (SaaS preservation — architectural approach)
- ADR-007 (Floorplan ownership — domain separation enables SaaS)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
