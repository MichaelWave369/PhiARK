# PhiARK R0.5: Kiwix loopback reader bridge

## Goal and facts

Kiwix's `kiwix-serve` command provides an HTTP web reader, local catalog UI and searches within ZIMs that contain an embedded full-text index. Upstream documentation: https://kiwix-tools.readthedocs.io/en/latest/kiwix-serve.html

**Important upstream default:** without `--address`, `kiwix-serve` listens on all interfaces. PhiARK always passes `--address=127.0.0.1` and `--port=8181` (or a caller-selected unprivileged port), so R0.5 is for the **same machine only**. There is no LAN mode, no HTTP API endpoint to execute the program, no downloader for the Kiwix binary, no daemon flag, and no auto-start on boot.

## Preparation

1. Use `npm run kiwix -- inventory` to see which exact archive editions are `CHECKSUM_MATCHED`. If empty, see `docs/KIWIX_R04.md` to explicitly acquire a selected official `.zim` plus `.sha256`.
2. Independently obtain `kiwix-serve` for your actual OS/architecture from Kiwix's official release channel: https://download.kiwix.org/release/kiwix-tools/ . Inspect its license (Kiwix tools is GPLv3 or later) and release provenance.
3. Calculate the executable's SHA-256 from the **actual binary you downloaded**. Linux: `sha256sum /absolute/path/kiwix-serve`. PowerShell: `(Get-FileHash 'C:\\path\\kiwix-serve.exe' -Algorithm SHA256).Hash`.
4. Use `npm run reader -- plan` to display the exact arguments before you run them.

```sh
npm run reader -- inventory
npm run reader -- plan chemistry --binary /absolute/path/kiwix-serve --binary-sha256 <64-hex-digest> --port 8181
npm run reader -- start chemistry --binary /absolute/path/kiwix-serve --binary-sha256 <64-hex-digest> --port 8181 --i-approve-launch
```

Launch runs **in the foreground**; leave that terminal open, visit `http://127.0.0.1:8181/` locally, and press Ctrl+C to stop. There is no automatic trust of an arbitrary filename on PATH, no arbitrary CLI args, and no shell invocation. Only one selected, re-verified archive is passed to `kiwix-serve` per launch. `--blockexternal` is set to discourage navigating to outside links, but it is **not** a firewall, content sanitizer, proxy boundary or network sandbox. For strict isolation, unplug the WAN / enforce a proper host firewall at the OS level.

The executable digest proves you are about to run the bytes you selected; **it does not authenticate who produced those bytes**. Verify origin separately. The ZIM digest proves stored-byte consistency with its saved checksum; it is not a content endorsement.

## Local PhiARK dashboard

`npm start` keeps its usual loopback-only local library at `http://127.0.0.1:3691/`. A read-only `GET /api/kiwix` computes current archive hashes on demand and reports `CHECKSUM_MATCHED`, `NOT_INSTALLED`, or `FAIL`, without assuming the reader is running.

The browser's **Open Kiwix** link is just a static URL. It cannot launch software, cannot verify process identity or readiness, and does not make private content public. Inventory verification may be slow for large files.

The GitHub Pages React showcase is a public listing of *candidate* archives, not a backend or an authenticated private library.

## PhiOS integration boundary

Existing task: https://github.com/MichaelWave369/PhiOS/issues/321

R0.5 provides a reviewed command and source of locally verified paths. It does **not** install a PhiOS app, provision a background service, authorize an AI agent to execute a binary, change routing, or open the library to the local network. A future governed PhiOS launcher must pin the binary hash, grant the minimal local filesystem read and loopback-bind capability, expose explicit operator start/stop, hold evidence receipts, enforce sandboxing, and provide rollback.

## Tests and non-claims

- Unit fixtures use synthetic bytes as stand-ins for an imported ZIM. These test **gating and subprocess argument construction**, not Kiwix's actual parsing.
- Real end-to-end evidence requires a separately installed genuine ZIM and kiwix-serve executable, an air-gapped cold-start, query/browser verification and an OS-specific process shutdown test.
- Current reader bridge does not create a bootable PhiPie USB image and does not include a complete educational corpus.
