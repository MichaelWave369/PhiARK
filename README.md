# Φ PhiARK Knowledge Vault

**Autonomous Resilience & Knowledge** · Source-aware local knowledge library for PhiOS · **R0.3 alpha**

PhiARK provides a dependency-free Node.js 20+ local document vault (R0.1), a public React Pages showcase (R0.2), and **portable offline knowledge-pack planning, snapshot, integrity verification and new-root restore** (R0.3).

## Actual local library

```bash
git clone https://github.com/MichaelWave369/PhiARK.git
cd PhiARK
npm run seed
npm start
```

Open `http://127.0.0.1:3691/` on the machine running PhiARK. Node dependencies are built-in; do not run `npm install` for the core server/CLI.

Import a local file deliberately (TXT/MD/PDF/EPUB, max 512 MiB):

```bash
npm run vault -- add /path/to/guide.pdf --title "Example manual" --subject water --author "Publisher" --source "https://example.org/guide" --license "needs review" --safety safety-critical
npm run vault -- verify
npm run vault -- list
```

Plain-text/Markdown contents and metadata are searchable. PDF and EPUB content is **not full-text indexed**. EPUBs are downloaded to open in a separate reader. The two original PhiARK starter guides are seeded only by explicit `npm run seed`. A catalog of possible outside sources is **not** downloaded content.

## R0.3 knowledge packs and removable snapshots

```bash
npm run packs -- list
npm run packs -- plan essential-field-r01
npm run vault -- list
npm run packs -- bind essential-field-r01 readiness-plan <actual-sha256-from-local-vault>
npm run packs -- export essential-field-r01 /path/to/NEW-snapshot-directory
npm run packs -- verify /path/to/NEW-snapshot-directory
npm run packs -- restore /path/to/snapshot /path/to/NEW-vault-root --i-approve-new-vault
```

Plan goals are not automatically filled. Bind only manually chosen, already-imported files with verified bytes. Export contains *only* bound content and **refuses overwrite**. Restoring creates a new data root. For a separately acquired Kiwix archive, run `npm run packs -- zim-check /path/to/file.zim <official-publisher-sha256>`.

Read [the complete R0.3 contract](docs/KNOWLEDGE_PACKS_R03.md) and [source safety policy](docs/SOURCE_POLICY.md). SHA-256 is byte integrity, **not** factual, legal, safety, signature or redistribution approval.

To use an external drive, set `PHIARK_DATA_DIR` outside the repository before running commands. Back up the manifest and objects together. These packs are portable document directories, **not yet a bootable USB image or a finished PhiPie system**.

## Public React GitPage

**https://michaelwave369.github.io/PhiARK/** is a public interactive showcase built from `site/` using GitHub Actions. It displays first-party starter guides and *planned* knowledge pack outlines, not your private local collection. Local file previews are kept in browser memory, not uploaded. It does not contact or expose the PhiARK localhost server.

Developer workflow: `cd site && npm install && npm test && npm run build`. See [site/PAGES.md](site/PAGES.md).

## Safety and architecture boundaries

- No silent internet downloads, scripts, external runtimes, clouds, user accounts, telemetry or CDN dependencies in the local server.
- HTTP server defaults to loopback. LAN exposure is explicitly gated and currently unauthenticated; do not expose it on untrusted networks.
- Importing/binding a guide is not approving its accuracy, license, edition, or fitness for emergency use.
- Kiwix ZIM and Kolibri course engines remain independently installed and operated; R0.3 does **not** install either.
- PhiOS governed App Platform intake is a separately authorized task (<https://github.com/MichaelWave369/PhiOS/issues/321>).
- USB **data** snapshots are implemented; PhiOS/PhiPie bootable OS media remains later verified engineering work.

MIT license applies to PhiARK's original code and bundled first-party guides only. Third-party content retains its own rights.

**Sovereign. Coherent. Local. Free.**
