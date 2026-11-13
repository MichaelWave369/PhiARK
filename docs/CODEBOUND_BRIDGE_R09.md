# PhiARK R0.9: CodeBound fieldbook bridge

## What this does

**CodeBound** already publishes a human-readable fieldbook and a machine-readable `fieldbook.json` in its deterministic offline ZIP. This adapter lets a person **preview that exact local JSON file**, then explicitly import **one of eight selected CodeBound-authored field skills as a standalone Markdown document** into the **private PhiARK vault**.

It does **not** download anything, unzip unknown archives, import the entire Internet Archive collection, accept executable formats, publish personal vault contents, or automatically bind pack slots. It preserves all guide steps, safety warnings, checks and linked references from the selected record. Source URLs are not cached, and their contents are not independently verified.

The module requires no new packages, network services, accounts, Python, or AI inference. The Markdown output is readable and searchable in ordinary text editors and PhiARK.

## Operator workflow

1. Obtain CodeBound from its expected repository: https://github.com/MichaelWave369/CodeBound (independently confirm source provenance).
2. From CodeBound's **generated** `codebound-field-kit.zip`, extract **only** `fieldbook.json` into a trusted local folder. Do not execute code from unknown ZIPs. Or produce it from the trusted CodeBound checkout with `npm run build` and use `dist/site/fieldbook.json`.
3. Run the preview *before any import*:

```bash
npm run field -- codebound-preview /path/to/fieldbook.json
```

4. Confirm the intended title, source, requested skill, safety warnings and the JSON SHA-256. Then explicitly import just one skill, using a suitable local/private `PHIARK_DATA_DIR`:

```bash
npm run field -- codebound-import /path/to/fieldbook.json water --i-approve-import
npm run vault -- verify
npm run vault -- list
```

The import response reports the **actual locally stored SHA-256 document ID**, not an invented digest, and supplies a `nextCommand` for deliberately binding it to the eight-skill pack.

5. To choose it for the portable pack, copy the exact command from the result (example format, not a real digest):

```bash
npm run packs -- bind field-skills-r01 water <actual-locally-reported-document-id>
npm run packs -- plan field-skills-r01
```

6. Export the pack into a **new, absent** directory and verify locally:

```bash
npm run packs -- export field-skills-r01 /path/to/NEW-snapshot
npm run packs -- verify /path/to/NEW-snapshot
```

For Windows PowerShell, quote file and directory paths containing spaces. After exporting to removable media, test on a separate disconnected device. A green GitHub workflow is not equivalent to a physical USB or emergency field test.

## Supported slots

| Slot | CodeBound guide | PhiARK subject |
|---|---|---|
| `harvest` | `field-hunt-fish-harvest` | `food` |
| `water` | `field-purify-water` | `water` |
| `natural-medicine` | `field-natural-medicine-literacy` | `health` |
| `shelter` | `field-build-shelter` | `survival` |
| `garden` | `field-grow-garden` | `agriculture` |
| `power` | `field-create-power` | `energy` |
| `self-defense` | `field-personal-safety` | `survival` |
| `navigation` | `field-navigate` | `maps` |

Run the import command once per selected skill. This deliberate process ensures you inspect the intended input instead of blindly bulk-loading potentially corrupted data. Imports alone do not satisfy a pack slot: only an explicit bind does.

## Validation and security boundaries

- A local JSON input must be an ordinary non-symlink file no larger than 2 MiB, with the specific CodeBound fieldbook schema and eight expected guide IDs/categories.
- Duplicate IDs, missing steps, safety checks, warnings, missing references, malformed references and insecure source URLs are rejected.
- Markdown escapes embedded formatting and HTML delimiters, so the generated document is intended as readable data rather than executable content.
- Temporary conversion files are held privately and removed; imported vault objects use PhiARK's content-addressed storage.
- The input file's SHA-256 is recorded in the Markdown, **not authenticated against a trusted signed release**. A maliciously forged JSON file can have its own valid hash; independently authenticate the source.
- CodeBound's **own** written guide content is stated as MIT-licensed, but linked third-party sources and Internet Archive ZIP contents are **not included or sublicensed**.
- Vault entries stay `reviewStatus: unreviewed`, `licenseStatus: unverified`. The tool has **no mechanism to certify safe water, edible species, medical efficacy, structures, electrical systems, navigation accuracy or user competence**.

## Testing

```bash
npm test
npm run field -- help
```

Regression tests use entirely synthetic fieldbook JSON, verify the opt-in gate, actual import and SHA-256 verification, missing safety warnings, duplicate IDs, suspicious references, symlink rejection, no automatic pack bind, and portable export integrity.

The bridge purposely remains **local CLI only**. It does not expose the private PhiARK vault through the public React showcase or start a new web service.
