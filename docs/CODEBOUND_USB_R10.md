# PhiARK R1.0 | Portable CodeBound Eight-Skill USB Kit

This release makes an ordinary **readable offline folder** from an operator-supplied `fieldbook.json` built by [CodeBound](https://github.com/MichaelWave369/CodeBound). The eight first-party field skills are each present as a standalone, self-contained HTML page and an editable/printable Markdown file. A static index links to all eight. **No runtime, server, JavaScript, account, cloud API or Internet is required to read these files on a disconnected computer.**

This is not a distribution of the six Internet Archive Awakening Project ZIP files, Kiwix content, or anyone else's manuals. Linked reference sites require connectivity.

## Operator workflow

From PhiARK on a trusted computer, with Node.js 20+ available **during export only**:

1. Obtain trusted CodeBound `fieldbook.json`: build it in a CodeBound checkout with `npm run build` (produces `dist/site/fieldbook.json`), or inspect the `fieldbook.json` from the published CodeBound portable ZIP. **Authenticate its source independently**. A matching self-reported checksum is not a signature.
2. Preview the eight guides without modifying the vault:

```bash
npm run field -- codebound-preview /path/to/fieldbook.json
```

3. Choose a **new, absent destination folder** inside an already-existing directory:

```bash
npm run field -- codebound-usb-export /path/to/fieldbook.json /media/USB/CodeBound-Eight-Skills --i-approve-export
```

4. Verify the exported folder before and after copying it onto a removable drive:

```bash
npm run field -- codebound-usb-verify /media/USB/CodeBound-Eight-Skills
```

5. Disconnect from Wi-Fi and mobile data, then open `index.html` directly from the drive on a **separate machine**. Open one `guides/*.html` independently, and at least one `guides/*.md` with a text editor. Inspect printed pages. Try a corrupted copy in a spare directory to check verification alarms. Keep a second backup.

For Windows PowerShell, quote paths with spaces. An expected success report from GitHub is **not** proof of physical USB functionality.

## Output structure

```text
CodeBound-Eight-Skills/
  index.html             # no external scripts, style sheets or fonts
  README.txt             # how to read offline; limits
  manifest.json          # source fieldbook digest, eight skills, file checksums
  SHA256SUMS.txt          # verifiable digest of all payload files + manifest
  guides/
    harvest.html         harvest.md
    water.html           water.md
    natural-medicine.html natural-medicine.md
    shelter.html         shelter.md
    garden.html          garden.md
    power.html           power.md
    self-defense.html    self-defense.md
    navigation.html      navigation.md
```

All eight pages retain CodeBound's steps, tools, acceptance checks, caution lists, references and original review labels. External links remain external. This standalone folder is distinct from PhiARK's existing manually bound, content-addressed `field-skills-r01` knowledge-pack snapshots, which remain available via `npm run packs -- export`.

## What the verifier proves

- Exact allowed filenames with no unexpected files, missing files, or symlinked files.
- A valid eight-skill manifest with explicitly **unapproved** safety and redistribution statuses.
- SHA-256 equality for every local guide page, Markdown file, index, README and manifest, and exact `SHA256SUMS.txt`.
- A byte-stable manifest and hash list when the same source fieldbook is exported twice.
- Rejects malformed source JSON, missing guide warnings, missing/unsafe references, oversized input, unknown IDs, pre-existing destinations, and tampering.

## What it does **not** prove

- **Authenticity:** anyone can alter the documents, rewrite the manifest, and recompute the checksums. Verify the origin separately, ideally using a trusted signed release channel.
- **Accuracy or safety:** CodeBound's `reference-backed` review label is not an independent expert certification. Do not treat wild plants as edible, drinking water as safe, an herbal remedy as effective, or electrical construction as rated merely because a guide appears in this kit.
- **Rights:** CodeBound asserts MIT for original text. Verify rights if sharing or adapting any content; these files do **not** copy third-party books or the Internet Archive ZIPs.
- **Actual field usability:** the reading-device test and any practical exercises have to be done by people in a safe setting, with appropriate supervision.

## CI validation

```bash
npm test
npm run field -- help
```

The new synthetic-data tests verify export consent, all eight HTML and Markdown files, safety-warning preservation, script/HTML escaping, deterministic checksums, tamper detection, bad input rejection, no overwrite, and symlink defense. The test fixture is deliberately **not** an emergency instruction manual.

**People Above Profit. Readable Above Proprietary. Field-Tested Above Assumed.**
