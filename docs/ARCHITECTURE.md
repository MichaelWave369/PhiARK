# PhiARK R0.1 Architecture and PhiOS integration

## Current, actually implemented

- Node.js 20+ with built-in modules only. No npm dependencies or network downloads.
- Operator-directed, **local-file** imports of plain text, Markdown, PDF, EPUB.
- SHA-256-addressed immutable document objects under `PHIARK_DATA_DIR/objects/`.
- JSON metadata catalog with source, author, license (unverified), review status (unreviewed), safety criticality, timestamp.
- Browser library with local search in titles/metadata and small text/Markdown contents.
- Separate CLI integrity check that reads every stored object and compares its SHA-256 and size.
- Read-only HTTP server on loopback (default `127.0.0.1:3691`) and no remote assets, analytics, or cloud AI.
- A **candidate source** catalog, not downloaded or approved content.

## Explicit non-capabilities

- No automatic downloading, verification of scholarly claims, content moderation, medical certification, peer-review certification, license clearing, encrypted storage, accounts, authorization, full-text PDF/EPUB indexing, index of external Kiwix ZIMs, or local AI.
- No PhiOS App Platform registration or actual OS installation in this PR. PhiOS launch/intake must be separately reviewed and authorized.
- No Kolibri / Kiwix service deployment, no automatic host networking, no bootable media or PhiPie image.
- Content hashes establish stored-byte integrity only. They do not establish source trust or factual correctness.
- PDF viewers and EPUB readers may vary by device. EPUB downloads rather than being parsed in PhiARK.

## PhiOS launcher proposal (not yet installed)

```json
{
  "id": "phiark-knowledge-vault",
  "displayName": "PhiARK Knowledge Vault",
  "entry": "node src/server.mjs",
  "localUrl": "http://127.0.0.1:3691/",
  "networkRequirement": "none",
  "effects": ["read:local-vault", "http:loopback"],
  "requiresExplicitOperatorApproval": true
}
```

Treat this as **design data**, not an active permission grant or verified PhiOS App Platform manifest. Use PhiOS governed intake and exact revision/digest validation when integrating.

## Future removable-disk / PhiPie seam

Set `PHIARK_DATA_DIR` to a writable data partition or external storage mount. Keep application code separate from content and backups. Move both the object directory and `catalog.json` together. Verify after copying. **A bootable disk needs a separate verified operating-system image, hardware drivers, architecture-specific installer, and secure update process.** Node itself is not an OS.

Kiwix ZIM and Kolibri channel collections should be installed/imported with their own offline runtimes and linked from the future unified PhiOS library UI. Do not try to parse them with the PhiARK text search engine.

## Minimum verification

Run `npm test` and `npm run vault -- verify`. Start the server, import a known local guide, turn off internet/network access, reload the page, open the guide, and search. Verify again after export to a second disk. Follow the instructions on the target PhiOS / PhiPie hardware, not just a virtual machine.
