# PhiARK R0.4: Verified Kiwix Archive Intake

## What ships

Six **exact, observed Kiwix Wikipedia ZIM editions** curated as candidates in `catalog/kiwix-selected-r04.json`. These are compact references, not first-aid instructions or an approved survival encyclopedia. Their sizes are approximations from the publisher index and may change. The catalog contains **NO downloaded ZIM bytes** or guessed SHA-256.

**Verified source:** official Kiwix `https://download.kiwix.org/zim/wikipedia/` directory, observed October 24, 2026. See also Kiwix's checksum instructions at `https://hub.kiwix.org/weblog/2026/03/question-time-q1-2026/`: the exact filename has a `.sha256` sidecar.

| ID | Exact edition | Approx. archive size |
|---|---|---|
| `firstaid-medicine` | `wikipedia_en_medicine_mini_2026-10.zim` | 166 MB |
| `chemistry` | `wikipedia_en_chemistry_mini_2026-10.zim` | 22 MB |
| `physics` | `wikipedia_en_physics_mini_2026-10.zim` | 51 MB |
| `climate` | `wikipedia_en_climate-change_mini_2026-10.zim` | 12 MB |
| `mathematics` | `wikipedia_en_mathematics_mini_2026-06.zim` | 56 MB |
| `knots` | `wikipedia_en_knots_maxi_2026-10.zim` | 13 MB |

Approximate combined size: **320 MB**. The word `firstaid` in our internal medicine selection ID does **not** mean it is a validated first-aid manual. Prefer current professionally vetted first aid instructions for consequential situations.

## Operator sequence (no implicit network access)

```bash
npm run kiwix -- list
npm run kiwix -- inventory
# Run ONLY on the operator's connected machine after inspecting the exact URL:
npm run kiwix -- acquire chemistry --i-approve-download
npm run kiwix -- verify chemistry
```

The acquisition command fetches a publisher `.sha256` **first**, downloads the exact ZIM from official Kiwix HTTPS hosts, streams to temporary files, checks the digest, stages both sidecar and archive, and registers the result only on success. It **never** downloads all six automatically and will refuse external/non-approved redirects. If a CDN mirror is not in the allowlist, acquire will fail with an explanation. **Do not disable host validation** to make it work. Download the files manually from Kiwix in that case, then use local import:

```bash
npm run kiwix -- import chemistry "/path/wikipedia_en_chemistry_mini_2026-10.zim" "/path/wikipedia_en_chemistry_mini_2026-10.zim.sha256"
npm run kiwix -- verify chemistry
```

Both filenames must be exact. Imports reject symlinks, corrupt content, and existing installations. R0.4 has a **1 GiB per-file bound** so an accidentally selected 119 GB archive isn't automatically attempted. The large-archive path will need separately designed storage/streaming budget approval.

Offline installations live beneath `PHIARK_DATA_DIR/kiwix/installed/<selection-id>/` and include an archive, publisher sidecar, and local receipt. `inventory` recomputes the archive hash instead of merely trusting a receipt. Missing or changed objects do not show as verified. Original ZIM bytes are kept **outside Git**.

## What checksum matching DOES and DOES NOT prove

- It does establish that the locally observed archive bytes match a SHA-256 supplied via the matching sidecar file.
- A sidecar freshly obtained via official Kiwix HTTPS has transport provenance, but it is not a separately verified publisher signature and a compromised endpoint could replace both files.
- A manually supplied sidecar may be from an unknown origin. The receipt explicitly records this distinction.
- It does **not** prove licensing/redistribution rights, correctness, medical safety, scientific validity, or that an offline reader is installed.

## Kiwix and PhiOS

Archive registration does not automatically start a reader. Install an appropriate Kiwix reader/kiwix-serve independently, then point it at the **verified** path. The local library and public React GitPage stay separate. The site shows exact archive **candidates**, not the local installed inventory. For a truly offline host, bundle a pinned Kiwix binary, its licenses, hardware architecture, and startup verification in a future governed PhiOS app milestone.

## Tested boundaries

- Clean missing inventory has no false installed flags.
- Explicit consent before outbound download.
- Local SHA-256 and sidecar filename matching.
- Byte corruption and symlink rejection.
- Refusal to overwrite existing imports.
- No third-party runtime dependencies or network needed by tests.

**Future R0.5:** integrate approved archive paths with installed `kiwix-serve` through an operator-authorized PhiOS service adapter and a local-only dashboard showing real verified inventory.
