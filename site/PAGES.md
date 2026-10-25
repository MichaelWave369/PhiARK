# PhiARK React Showcase: GitHub Pages

## What this builds

A static, responsive React interface at **https://michaelwave369.github.io/PhiARK/** once configured and successfully deployed. The source lives under \`site/\`. GitHub Actions builds it with Vite and deploys the final bundle, with **all JS, CSS, icons, original starter guides, and metadata packaged into first-party assets**. Browsing bundled documents requires no cloud runtime.

It is a **public demonstration**, not the real private PhiARK backend. It cannot query \`http://127.0.0.1:3691\` from GitHub Pages or bridge to local storage. Documents selected with the browser file picker are read via standard browser File APIs, previewed in memory, and discarded on refresh. No uploads are performed.

The external source directory lists URLs from \`catalog/sources.json\`; clicking them obviously requires internet and does not make those documents available offline.

## Turn on GitHub Pages (repo-owner step)

1. Merge the PR containing \`site/\` and \`.github/workflows/pages.yml\`.
2. Open **repository → Settings → Pages → Build and deployment**.
3. Choose **Source: GitHub Actions**. This is a one-time repository setting, not something the React app can set itself.
4. Open **Actions → PhiARK React Showcase / GitHub Pages**, confirm that **Compile and verify React bundle** and **Publish React GitPage** succeed (run workflow manually if needed).
5. Visit **https://michaelwave369.github.io/PhiARK/**. Allow the initial load with internet once to populate the service worker's offline cache.
6. In browser DevTools, choose Offline, refresh, and confirm the two bundled guide readers and search still operate.

If GitHub Pages is already configured for GitHub Actions, Step 3 is unnecessary. If the Deploy step fails with a message that Pages is not configured, finish Step 3 and rerun the workflow. Do not assume an existing repository \`has_pages\` flag proves a successful deployed site.

## Locally build (development requires npm network access once)

\`\`\`bash
cd site
npm install
npm test
npm run build
npm run check:build
npm run dev
\`\`\`

Vite config uses \`base: '/PhiARK/'\`, the correct project-site prefix. The local PhiARK Node server remains dependency-free and is **not** changed by this web UI.

## Trust and offline boundaries

- React and lucide icons are build-time dependencies (installed by CI); none are fetched from CDNs at runtime.
- A service worker pre-caches the built app shell and asset bundle for offline repeat visits. No external URLs or private files are cached by it.
- The static Pages site starts with **exactly two** first-party educational guide texts and a separate candidate source list. Labels distinguish installed examples, candidate-only links, and session-only personal files.
- A browser-generated SHA-256 on an imported preview is a local digest only, not a certificate of source or factual accuracy.
- Do not add authentication secrets, private archives, credentials, medical histories, or copyrighted third-party content to the public site.
- The user can run PhiARK on their own device and manage their private vault independently. Planned PhiOS App Platform and PhiPie boot-media integration are not claimed to be finished.

## Acceptance

- [ ] Tests pass and GitHub Actions publishes without needing runtime CDNs.
- [ ] URL resolves correctly under \`/PhiARK/\` (including all React/CSS assets).
- [ ] Search/filter applies to actual bundled material and external candidate directory.
- [ ] Clicking a bundled guide opens actual text with safe React escaping.
- [ ] Browser-only preview never makes a network request with document contents.
- [ ] Offline second visit works after service-worker installation.
- [ ] No Pages claim implies local PhiOS data or server state.
