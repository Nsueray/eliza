# ADR-010: Floorplan Integration Depth

**Status:** OPEN
**Date:** 2026-04-10
**Category:** Architecture
**Blocks:** Phase 3 (LEENA integration)

---

## Question

Should LİFFY show real-time stand availability from LEENA during quoting, or is a static availability list sufficient for Phase 1?

## Options

| Option | Pros | Cons |
|--------|------|------|
| **Real-time floorplan view** | Agents see exactly what's available, visual stand selection | Complex to build, LEENA floorplan must be ready first |
| **Static availability list** | Simple, LİFFY just shows "Stand A4 — 20m² — Available" | Not visual, may be outdated between syncs |
| **No availability in Phase 1** | Fastest to ship, agents ask Yaprak like they do now | No improvement over current workflow |

## Considerations

- Floorplan is both sales-facing and ops-facing (see ADR-007)
- Real-time requires LEENA floorplan to be built first — this may delay Phase 2
- Static list could be a good interim: LİFFY shows available stands from ops.stands table

## Suer's Notes

*(to be filled during discussion)*

## Decision

*(pending)*
