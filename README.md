# Φ PhiARK Knowledge Vault

**Autonomous Resilience & Knowledge** · Native PhiOS knowledge-library candidate · **R0.1 (alpha)**

A source-aware, offline-first document vault. Import actual local manuals and texts; search and read them in a local browser without accounts, external assets, internet, or cloud AI.

**Important:** this is a working foundation, not a preinstalled encyclopedia or certified emergency/medical reference. The curated candidate catalog contains links, *not downloaded documents*. Every imported item's review and license statuses begin as **unverified**.

## Quick start

Requires **Node.js 20+**. No `npm install` necessary.

```bash
git clone https://github.com/MichaelWave369/PhiARK.git
cd PhiARK
npm run seed
npm start
```

Open **http://127.0.0.1:3691/**. `npm run seed` explicitly imports two original bundled starter guides so the demo is useful with no downloads. For other materials, select and download them legally while online, then import the actual files:

```bash
npm run vault -- add "/path/to/local/manual.pdf" --title "Example manual" --subject water --author "Original publisher" --source "https://publisher.example/manual" --license "rights need review" --safety safety-critical
npm run vault -- list
npm run vault -- verify
npm run vault -- status
npm run vault -- sources
npm test
```

Replace the sample file and metadata with the real source. Imports accept `.md`, `.txt`, `.pdf`, and `.epub`, up to 512 MiB each. **Plain-text and Markdown contents are searchable**, as well as all titles and metadata. PDFs and EPUBs are stored and accessible but their body text is not indexed yet. EPUBs are downloaded for opening in an external reader. Kiwix ZIM archives should be managed by Kiwix, not imported here.

### Moving to PhiOS HomeNode, USB data disks, and PhiPie

Store the catalog and objects outside the repo:

```powershell
$env:PHIARK_DATA_DIR = 'E:\\PhiARKVault'
npm run seed
npm start
```

Linux/macOS: `PHIARK_DATA_DIR=/mnt/vault npm run seed` and `PHIARK_DATA_DIR=/mnt/vault npm start`.

Back up **both** `catalog.json` and `objects/` from that folder. Run `npm run vault -- verify` after the copy and again on the target system. PhiOS integration, a bootable USB, and PhiPie deployment are **future milestones** and aren't claimed by R0.1.

By default the library binds only to `127.0.0.1:3691`. LAN binding is blocked unless `PHIARK_ALLOW_LAN=1` is explicitly set; the LAN mode has **no authentication** and should not be used outside a trusted, isolated network.

## Scope and safety

- No telemetry, CDNs, accounts, cloud APIs, web downloads, third-party dependencies, or remote script execution.
- Content-addressed SHA-256 documents plus `npm run vault -- verify` detect local byte corruption. Hashes do **not** establish truth, accuracy, license, safety, or author identity.
- Unverified guidance is not a substitute for current emergency services or trained medical advice. Safety-critical sources require human review.
- The API is local and read-only. Adding files is a separate explicit command; no silent acquisition.
- The source suggestions at `catalog/sources.json` require independent licensing and version checks per specific item before redistribution.

See [implementation contract](docs/ARCHITECTURE.md), [source and safety policy](docs/SOURCE_POLICY.md), and [starter guides](starter-guides/).

**Design alignment:** PhiOS's capability-is-not-authority rule remains intact. Nothing in this repository grants itself installation, network, or execution permissions in PhiOS.

This repository's original software and first-party starter guides are MIT-licensed. Third-party documents imported into a personal vault retain their original rights and are not automatically part of the MIT grant.

## Public React showcase (GitHub Pages)

The React-based public **PhiARK Knowledge Vault Showcase** lives in `site/` and is built by `.github/workflows/pages.yml`. Once GitHub Pages is configured for **GitHub Actions** and the deployment succeeds, its public URL is:

**https://michaelwave369.github.io/PhiARK/**

The page bundles two first-party educational guides and links to external resource candidates. Optional document previews run **only in the visitor's browser session**. It never connects to or exposes the real PhiARK local server, never uploads selected files, and stores nothing in a cloud account. Static assets are bundled into the build; a service worker caches them for subsequent offline visits after a successful first load.

```bash
cd site
npm install
npm test
npm run build
npm run check:build
npm run dev
```

See [GitHub Pages deployment and scope](site/PAGES.md). GitHub Pages is **not** a private document host or the PhiOS local backend.
