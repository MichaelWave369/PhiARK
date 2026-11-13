# PhiARK R0.8 — Eight Field Skills and Archive Source Discovery

This module connects the **CodeBound** eight-field-skill curriculum to **PhiARK's portable verified-byte knowledge packs**, while keeping Internet Archive discovery links completely separate from documents actually stored in a user's private vault.

## Eight skill pack

Run from the PhiARK repository:

```bash
npm run field -- sources
npm run field -- coverage
npm run field -- detail kit-a-self-sufficiency
npm run field -- plan
npm run packs -- plan field-skills-r01
```

`field-skills-r01` has **eight independent manual slots**: hunt/fish/harvest, water, natural medicine literacy/first aid, shelter, garden, safe power, nonviolent self-defense, and navigation. Each slot requires a manually imported local document with the correct `subject`. Existing SHA-256 verification, explicit binding and portable new-directory export work without adding any network calls or dependencies.

The guide cards, with their safety notices and actionable exercises, are in https://github.com/MichaelWave369/CodeBound. The PhiARK pack stores selected source references, **not automatically copied CodeBound files**.

## Creator search: what was actually found

- User-provided search: https://archive.org/search?query=creator%3A%22Awakening+Project%22
- Advanced Search reports **six** public text items under the uploader creator name **Awakening Project** as of November 13, 2026.
- Exact item IDs: `kit-a-self-sufficiency`, `kit-b-survival-defense`, `kit-c-preparedness`, `kit-d-tech-privacy`, `kit-e-strategy-society`, `kit-f-general-tools`.
- Metadata API reports **one original ZIP file for each**, with original filename and byte length recorded in `catalog/awakening-project-r01.json`.
- Their descriptions identify the contents as **Portuguese** materials. This is an uploader claim, **not a language audit** of files inside the ZIPs.
- No individual books, contained files, ZIP integrity, download rights, publisher identities, or safety claims were checked. A collection's presence on the Internet Archive **does not establish copyright permission** or medical/technical reliability.
- Kit B's description includes firearms and shooting material. The CodeBound self-defense curriculum explicitly covers awareness, escape and de-escalation rather than weapons instruction.

**Meaning of the statuses:** `NOT_DOWNLOADED` / `NOT_REVIEWED` / `UNKNOWN` are deliberately non-promotable candidate states. `npm run field -- coverage` does not count source leads as locally stored or safety approved. Its only local progress count is physically present and SHA-256-verified, manually selected files in the PhiARK vault.

## Safe operator workflow

1. Pick a needed topic from `npm run field -- coverage`. Prefer contemporary primary sources for high-stakes facts (CDC water, NIH herbal interactions, emergency first aid, local food and fish regulations, electrical safety, current maps).
2. If you inspect an archive ZIP, treat every nested file as untrusted data. Do not run bundled executables, scripts, installers or macros. Do not automatically extract an unknown large ZIP in a privileged environment.
3. Identify the *specific* original book/file, edition, author, actual copyright/terms, claims and safety limitations. Translate and independently verify non-English material before reliance.
4. Obtain a lawful, suitable `PDF`, `EPUB`, `TXT` or `MD` document with the operator's explicit action. PhiARK's `vault add` **does not import ZIP**.
5. Import explicitly, using a real matching subject. Example for a locally saved and independently reviewed water reference:

```bash
npm run vault -- add /path/to/water-reference.pdf --title "Exact title and edition" --subject water --author "Real author" --source "https://publisher.example/exact-reference" --license "needs review" --safety safety-critical
npm run vault -- verify
npm run vault -- list
npm run packs -- bind field-skills-r01 water <actual-64-character-document-sha256>
npm run packs -- plan field-skills-r01
npm run packs -- export field-skills-r01 /path/to/NEW-export
npm run packs -- verify /path/to/NEW-export
```

6. Confirm the target drive holds the exported files, disconnect the network, and physically test a separate computer/browser/reader. **A successful GitHub build is not a real field test.** Preserve a second copy.

Safety-critical guidance remains unapproved by PhiARK. Hash checks prove byte integrity, not medical validity, authenticity of the cited author, training competence, legal permission or redistribution rights. No automated fetching, mirroring, unknown ZIP extraction, or content/rights approval is part of this change.

## Cross-repo ownership

- **CodeBound:** plain-language, searchable and printable skills with checklists and source citations.
- **PhiARK:** explicit document acquisition, provenance metadata, per-slot pack binding, byte-level verification, export/restore.
- **PhiSafe:** private household supplies, water, pets, shelter logistics and actual readiness checks. Never mix personal records into the public discovery catalog.

Knowledge should remain useful without an internet connection, with limitations visible wherever a decision carries risk.
