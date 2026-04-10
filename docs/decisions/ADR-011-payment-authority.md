# ADR-011: Payment Authority Scope

**Status:** OPEN
**Date:** 2026-04-10
**Category:** Business Rule
**Blocks:** Phase 1 (payment module design)

---

## Question

Who beyond Yaprak should have payment recording permissions? Should there be a dedicated Finance role?

## Options

| Option | Pros | Cons |
|--------|------|------|
| **Yaprak only** | Maximum control, single point of authority | Yaprak becomes bottleneck, no backup |
| **Yaprak + Country Managers** | Distributed, local payments recorded locally | Country managers may not have finance discipline |
| **Yaprak + dedicated Finance role** | Proper separation of duties, scalable | Need to hire/assign finance person |
| **Yaprak + CEO** | Two trusted people, simple | CEO shouldn't do data entry |

## Considerations

- In Zoho today, who records payments? This should guide the answer
- Nigeria and Morocco offices may have local payment collections (NGN, MAD)
- Currency conversion (local → EUR) needs to be handled correctly
- Audit trail captures who recorded every payment regardless of who is authorized

## Suer's Notes

*(to be filled during discussion)*

## Decision

*(pending)*
