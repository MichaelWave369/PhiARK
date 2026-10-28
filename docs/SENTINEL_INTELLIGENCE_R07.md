# PhiARK R0.7 × FieldShield Sentinel v0.4

## Offline Intelligence Vault

This optional PhiARK module stores **exact, independently pinned-key verified**
FieldShield Sentinel IOC packs for offline use and transfer. It deliberately
has **no HTTP API** and does not display or share sensitive forensic evidence.

It works with FieldShield's v0.3 detached Ed25519 manifest and trust-store
schemas, using only Node.js 20+ built-ins. No Python or third-party npm
packages are required for the PhiARK vault itself.

### Operator workflow

First obtain a reviewed IOC pack, its detached signature and a **separately
authenticated** trust-store policy. Never automatically install the public key
packaged next to the downloaded IOC data. `rules/sentinel-empty-trust.json`
in FieldShield trusts nobody, by design.

Set `PHIARK_DATA_DIR` to a private local directory, preferably outside the
source tree. Then run:

    npm run intel -- import ./pack.json ./pack.sig.json ./trusted.json --i-approve-import
    npm run intel -- list
    npm run intel -- verify ./trusted.json

To move a particular verified pack to a disconnected device:

    npm run intel -- export <SHA256-PACK-ID> ./NEW-sentinel-export ./trusted.json --i-approve-export

The export contains `pack.json`, `manifest.json` and a README. **It does
not include your trusted public keys.** Independently provision trusted keys
on the destination, then verify and import with the same explicit command.

### Verified boundaries

- Detached Ed25519 signature over a domain-separated canonical manifest.
- SHA-256 of exact packed bytes, retained under
  `PHIARK_DATA_DIR/intelligence/objects/<sha256>/`.
- Manually provided pinned publisher and key, local blocked-hash list, revoked
  keys and minimum issued-at policy; unknown trust roots fail closed.
- Expired or not-yet-valid manifests, hash mismatches and malformed identities
  fail before importing a pack. Trust is evaluated **again** on verify/export.
- The import path uses an explicit approval flag and writes copies into a
  separate intelligence namespace, preserving the existing knowledge vault.
- The exporter only creates **new**, freshly verified directories; it refuses
  overwriting existing export directories.
- No auto-downloads, uploads, telemetry, code execution, auto-remediation,
  privileged device collection, or browser/public GitPage exposure.

### Important limitations

This is a **prototype authenticity and storage mechanism**, not an anti-spyware
certification. It cannot determine whether imported indicators are accurate or
legal to redistribute, and a clean match count is not proof of safety. Source
and licensing review are the operator's responsibility. Never share private
device forensic findings or secrets with third parties by default.

Only the signing-key trust root and manual checks determine publisher identity;
a publisher's signature does NOT verify the real-world organization. Local
trust files are not signed or automatically distributed, and the vault does
not protect against an attacker who can modify those files or the host clock.

There are no built-in trusted providers or live spyware signatures. No
integration with PhiOS installation/permissions, PhiPie USB boot media, or
the main PhiARK web server is claimed. This is a CLI-only local seam.

Filesystem races, malicious file metadata, catalog corruption, stale trust
policies, and cross-runtime manifest canonicalization should receive an
independent security review before deployment against hostile filesystems.
The trust-store JSON should be created with the FieldShield v0.3 schema.
The base64 public key should be verified through a separate authenticated
channel. Distribute only third-party content with appropriate permissions.

### Validation

    npm test
    npm run intel -- help

New tests generate ephemeral signing keys in memory, use completely synthetic
IOC examples, and check tampered packs, signature mutations, trust revocation,
expiration, portability, and the absence of automatic key export.

Related implementation: [FieldShield](https://github.com/MichaelWave369/FieldShield)
(`sentinel_verified.py`, `docs/SENTINEL_VERIFIED_V0.3.md`).
