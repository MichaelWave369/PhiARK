# PhiARK R0.6: private Linux Unix-socket transport

**Status:** opt-in local transport, not a PhiOS installation, permission grant, browser gateway, or proven sandbox isolation.

## Purpose

PhiOS issue #321 needs an offline knowledge service without ambient host networking. PhiOS v0.34 currently offers network denied or broad host-network inheritance. This Linux-only PhiARK option listens on a filesystem Unix socket instead of a TCP port.

## Operator-only local smoke test (not a PhiOS installation)

From a trusted local checkout with Node.js 20+:

~~~sh
export PHIARK_DATA_DIR="$HOME/.local/share/phiark-vault"
mkdir -p -m 700 "$PHIARK_DATA_DIR"
chmod 700 "$PHIARK_DATA_DIR"
npm run seed
unset PHIARK_HOST PHIARK_PORT PHIARK_ALLOW_LAN
export PHIARK_SOCKET_PATH="$PHIARK_DATA_DIR/.phiark.sock"
npm start
~~~

From another terminal on the same machine:

~~~sh
curl --unix-socket "$HOME/.local/share/phiark-vault/.phiark.sock" http://localhost/api/status
~~~

The curl target URL is transported over a filesystem socket, not through a TCP browser endpoint.

## Security contract

- Explicit Linux-only opt-in; Unix socket path must equal PHIARK_DATA_DIR/.phiark.sock.
- TCP host/port and LAN environment options are incompatible with socket mode.
- No symlink directory components, group/world-accessible vault root or occupied socket path.
- Private socket from first bind via process umask 077; chmod 0600 before readiness.
- No automatic stale socket deletion. Inspect process identity before any operator recovery.
- No runtime grant, external network access, browser gateway, installation, or Kiwix download is implied.
- Socket filesystem permissions alone are insufficient authentication for a multi-user browser endpoint.

## Next separate PhiOS gates

1. Exact reviewed PhiARK commit and Node 20+ toolchain provenance.
2. Network-denied isolated runtime, read-only code, and writable persistent vault mapped into the sandbox.
3. Explicit launch/stop approval and separate authenticated host-loopback HTTP-to-socket broker. Validate hostile origins, DNS rebinding and multi-user access.
4. Actual installed/blocked/running launcher status, not an informational tile mislabeled as installed.
5. Physical Linux sandbox negative network tests and disconnected cold-start, search, document integrity, recovery and rollback evidence.
6. Kiwix and third-party archive/license intake as a separate authorization.

Related: https://github.com/MichaelWave369/PhiOS/issues/321
