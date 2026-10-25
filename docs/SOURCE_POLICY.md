# PhiARK source and safety policy (R0.1)

PhiARK distinguishes **availability, authenticity, accuracy, currentness, permission and safety**. None implies the others.

## Catalog states

- `catalog/sources.json`: external **candidates** only. No bytes present, no assurance of accuracy or legal redistribution.
- `data/catalog.json`: records actual, operator-imported local bytes. `reviewStatus: unreviewed` and `licenseStatus: unverified` are intentionally fixed in R0.1.
- `npm run vault -- verify`: verifies SHA-256 and byte count of physically present stored objects. This is not a safety or content review.

## Rules for later curation

1. Record an official publisher/organization identity and the exact item URL, edition, publication/revision date, author and language. Never invent missing metadata.
2. Capture original licensing terms and permission to store, modify, and redistribute **that exact item**. Do not assume a publisher's entire catalog uses one license.
3. Categorize safety critical topics (first aid, medical, food preservation, drinking water, electricity, structures) and request domain-specific expert review before promotion.
4. Check contradictory or outdated methods; preserve earlier versions as historical if appropriate but mark them not current.
5. Require a distinct step to mark a guide **reviewed** in a future release; R0.1 cannot confer this status.
6. Preserve local integrity and a separately verified backup. Prefer primary sources and more than one independent reference for consequential instructions.
7. Use human-readable recipes/procedures with units and failure conditions; never let an AI invent citations or give unverifiable material an endorsement.

**Practical knowledge does not mean uncritical acceptance of any particular institution.** Evidence, replicability, transparency and independent cross-checking outrank logos and politics. A government or university document may be useful when its methods are reproducible and current; any source can be wrong.

## Future source lifecycle

`CANDIDATE → ACQUIRED → HASH_VERIFIED → RIGHTS_REVIEWED → FACT_REVIEWED → APPROVED`

R0.1 implements candidate links, manual acquisition/import, and hash verification only. No automatic approval transitions.
