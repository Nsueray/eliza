# ADR-002: LİFFY and LEENA Remain SaaS-Ready

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Strategy

---

## Context

LİFFY is currently a generic lead generation and outreach platform — any exhibition organizer could use it. LEENA will be a generic fuar operations platform. If Elan Expo-specific business logic (contract creation, payment tracking, approval workflows) is placed inside LİFFY or LEENA, they lose multi-tenant SaaS potential.

## Decision

LİFFY and LEENA remain generic. All Elan Expo-specific business logic (contract conversion, approval workflows, payment authority) lives in ELIZA. LİFFY and LEENA connect to ELIZA via API.

When used by another organizer (SaaS mode), they connect to that organizer's own backend instead.

## The Test

Before adding any feature to LİFFY or LEENA, ask: "Would another exhibition organizer need this exact feature?" If yes → it belongs there. If no → it belongs in ELIZA.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Merge everything into ELIZA | Kills SaaS potential, creates monolith |
| Accept LİFFY/LEENA will be Elan-only tools | Wastes the generic work already done, limits future revenue |

## Consequences

- LİFFY quote form is simple (company, expo, stand size, price) — contract complexity is hidden in ELIZA
- LEENA receives exhibitor data via API — it doesn't need to know how contracts work
- API interface between systems must be standardized and documented

## Related Decisions

- ADR-001 (ELIZA as commercial core)
- ADR-003 (Quote-contract separation)
- ADR-007 (Floorplan ownership)
- ADR-013 (SaaS priority — OPEN)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
