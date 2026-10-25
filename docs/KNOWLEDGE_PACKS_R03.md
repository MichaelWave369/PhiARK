# PhiARK R0.3: Knowledge packs and portable snapshots

This release adds **executable, tested offline pack tools**, not a downloaded survival encyclopedia. It assumes Node.js 20+ and reuses the R0.1 content-addressed vault. No new npm runtime packages.

## Why it is separated

- **Plan:** `packs/*.json` describes coverage goals and potential publishers; these files are *not* downloadable archives and confer no license, medical endorsement, fact checking, or storage occupancy.
- **Store:** `npm run vault -- add` imports documents the operator already legally acquired. Catalog `reviewStatus` and `licenseStatus` remain unreviewed/unverified until an independent human process exists.
- **Bind:** select the *exact* local SHA-256 of a document for one pack slot, after reviewing the edition, author, safety and licensing. The CLI requires a matching subject category and matching stored bytes.
- **Export:** snapshot **bound files only** to a new directory, content-hashed and with an exact manifest. Exports do not silently download a missing slot or invent substitutes. Export does not imply a complete pack.
- **Verify/restore:** fail if exported bytes, file metadata, or manifest differ; only restore to a new data root.
- **Kiwix:** optional `zim-check` compares locally downloaded ZIM bytes to an explicitly entered checksum (obtain it independently from Kiwix). Kiwix itself is an independent runtime, not installed here.
- **Kolibri:** use supported Kolibri channel import/export from a connected host to offline storage. PhiARK does not parse/replicate Kolibri's database or claim content was acquired.

## Commands

```bash
npm run seed
npm run vault -- list
npm run packs -- list
npm run packs -- plan essential-field-r01

# Copy the exact 64-digit id from vault list, after selecting a suitable document:
npm run packs -- bind essential-field-r01 readiness-plan <document-sha256>

# Destination parent folder must already exist and target must NOT exist:
npm run packs -- export essential-field-r01 /media/usb/PhiARK-Snapshot-A
npm run packs -- verify /media/usb/PhiARK-Snapshot-A

# Restore into a new, absent data directory:
npm run packs -- restore /media/usb/PhiARK-Snapshot-A /home/operator/NewPhiARKVault --i-approve-new-vault

# Optional: compare an actual downloaded ZIM to the publisher's published SHA-256:
npm run packs -- zim-check /media/usb/knowledge/actual-file.zim <official-kiwix-sha256>
```

On Windows PowerShell, quote paths containing spaces. You can set `PHIARK_DATA_DIR` to a root on an external drive. The examples are illustrative; these files do not exist until downloaded/imported by the operator.

## Portable directory contract

```text
PhiARK-Snapshot-A/
  manifest.json             # exact slot => SHA-256 selections, source pack id
  manifest.sha256            # digest of manifest bytes; NOT a signature
  catalog.json              # metadata for exactly the selected local files
  objects/
    <64-character-sha256>   # same content-addressed bytes used by PhiARK
```

`pack-bindings.json` is created during restore. The checked result is useful for transporting **documents** into another PhiARK install. The snapshot is **not bootable** and contains no operating system, executable installation step or copied model weights.

Snapshot SHA-256 verifies consistency against the manifest **as supplied**; an attacker can replace both manifest and checksum. Authenticate origin separately (trusted signing key/channel), and never use checksums as content safety or source credibility assessments.

## Content risk boundaries

Safety-critical references (water disinfection, healthcare, electrical hazards, food preservation, structural safety) must be checked against current applicable sources by someone qualified, with dates/limitations preserved. A correct file hash does not make a procedure safe.

Documents imported into private storage retain their own licenses. **Do not redistribute a portable snapshot** containing copyrighted documents unless each document's reuse and redistribution terms permit it.

## Kiwix and Kolibri (research links)

- Kiwix ZIM library: https://library.kiwix.org/ (choose a precise current archive)
- Kiwix checksum instructions: https://hub.kiwix.org/weblog/2026/03/question-time-q1-2026/
- Kiwix server: https://github.com/kiwix/kiwix-tools/blob/main/docs/kiwix-serve.rst
- Kolibri offline channel import: https://kolibri.readthedocs.io/en/latest/manage/resources.html
- Kolibri removable media guidance: https://kolibri.readthedocs.io/en/latest/faq.html

Kiwix and Kolibri are installed separately and still require a *first* acquisition of the media, runtimes, and channel data while a network is available elsewhere. The above links remain external and do not make content locally available.

## What's next

1. Persistent human provenance and license approvals tied to content SHA and exact edition.
2. Curated exact Kiwix ZIM choices with pinned official hashes, storage requirements and verified service adapters for PhiOS.
3. Sector-specific preparedness packs and a deterministic test fixture for removable-media backup.
4. Only later: a validated hardware boot image for PhiPie and PhiOS with offline cold-start, power failure/recovery, and model performance tests.

**Current confidence:** byte-level export/verify/new-root restore, with unit tests. Real USB/media and PhiPie hardware runs still need operator evidence.
