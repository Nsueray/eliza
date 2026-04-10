# ADR-010: Floorplan Integration Depth

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Architecture

---

## Question

Should LİFFY show real-time stand availability from LEENA during quoting, or is a static availability list sufficient for Phase 1?

## Decision

**No floorplan in Phase 1. Build LİFFY CRM first. Floorplan comes in Phase 2-3 after LEENA is ready.**

### Critical Business Insight

Floorplans at Elan Expo are NOT just "availability maps." They are **active sales weapons:**

- Every sales agent creates **hundreds of custom floorplans** for different prospects
- Example: selling to Pepsi → agent puts Coca-Cola on the floorplan (even if Coca-Cola hasn't signed yet) to create competitive urgency
- Agents clone, modify, and customize floorplans per prospect and send them attached to proposal emails
- This means floorplan is a **per-agent, per-prospect sales tool**, not a static directory

### Architecture Implication

Two distinct floorplan layers:

1. **Master Floorplan** (LEENA, owned by project team / Yaprak)
   - Official layout: aisles, islands, corridors, confirmed exhibitors
   - Sales agents CANNOT modify this
   - Source of truth for stand assignment and operations

2. **Sales Floorplan Template** (LEENA → LİFFY)
   - Project team creates a template from master (with key exhibitors, layout)
   - Sales agents clone this template into their own versions
   - Agents can add/remove/move exhibitors freely in their copy
   - Attached to proposal emails sent to prospects

### Priority Order
1. **Now:** LİFFY CRM (campaign → contact management → follow-up tracking)
2. **Then:** LEENA master floorplan
3. **Then:** LİFFY sales floorplan (clone from LEENA template, customize per prospect)

## Consequences

- LİFFY Phase 1 has no floorplan features — agents continue current manual process
- LEENA floorplan must support "export template for sales" functionality
- LİFFY needs a floorplan clone/edit feature eventually — this is significant development
- Each agent may have 100+ floorplan versions — storage and management implications

## Related Decisions

- ADR-007 (Floorplan owned by LEENA)
- ADR-009 (Sales adoption — CRM first)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
