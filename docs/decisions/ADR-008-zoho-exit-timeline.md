# ADR-008: Zoho Exit Timeline

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Strategy

---

## Question

How aggressive should the Zoho migration be?

## Decision

**Parallel operation, target Zoho shutdown by 1 January 2027.**

No hard cutover — too risky. Phased approach:

1. **Now:** Zoho stays as-is. Every new Zoho contract is mirrored to ELIZA via API/webhook. Yaprak receives an approval notification in ELIZA for each new contract — she starts using ELIZA for review even while Zoho remains the entry point.

2. **Pilot phase:** Bengü starts using LİFFY as a real user (positioned as "this tool makes your data mining and campaigns easier", not "Zoho is going away"). A second pilot from Kenya or Morocco office (possibly Semih).

3. **Gradual reduction:** As ELIZA contract management matures and Yaprak is comfortable, Zoho is reduced to single-user. New contracts are created in ELIZA directly.

4. **Target:** 1 January 2027 — Zoho subscription cancelled or reduced to minimum.

## Rationale

- Hard cutover risks data loss and team resistance
- Parallel lets us validate data integrity daily
- Positioning LİFFY as value-add (not replacement) drives organic adoption
- Yaprak needs time to build muscle memory with ELIZA's approval workflow

## Consequences

- Zoho subscription cost continues through 2026
- Need Zoho → ELIZA webhook/API mirror for contracts during transition
- Two systems to monitor temporarily — but ELIZA is the one being validated

## Related Decisions

- ADR-009 (Sales adoption — pilot approach)
- ADR-001 (ELIZA as commercial core)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
