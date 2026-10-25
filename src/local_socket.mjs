import { lstat } from 'node:fs/promises';
import { isAbsolute, join, resolve, dirname } from 'node:path';

// Advisory transport selection only. Does not grant a PhiOS launch, permission,
// network bridge, external socket listener, or browser-accessible service.
export async function selectLocalSocket(env, root) {
  const requested = env.PHIARK_SOCKET_PATH;
  if (requested === undefined) return null;
  if (process.platform !== 'linux') throw new Error('PhiARK Unix-socket mode is Linux-only');
  if (typeof requested !== 'string' || !requested || !isAbsolute(requested)) {
    throw new Error('PHIARK_SOCKET_PATH must be an absolute path');
  }
  // Never silently combine socket mode with a network-facing listener option.
  if (['PHIARK_HOST', 'PHIARK_PORT', 'PHIARK_ALLOW_LAN'].some(k => env[k] !== undefined)) {
    throw new Error('Unix-socket mode forbids TCP host/port and LAN configuration');
  }
  if (requested !== join(root, '.phiark.sock') || resolve(requested) !== requested) {
    throw new Error('Unix socket must be .phiark.sock directly inside PHIARK_DATA_DIR');
  }
  // Avoid symlinked mount/data roots. The socket can be shared only with a
  // separately authorized host gateway mounting this exact private directory.
  let folder = root;
  while (true) {
    const info = await lstat(folder);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('Unix socket data root has an unsafe directory component');
    }
    if (folder === root && (info.mode & 0o077) !== 0) {
      throw new Error('Unix socket data root must not be accessible to group or others');
    }
    const parent = dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  // Never remove or replace stale/occupied sockets. Recovery is operator-only.
  try {
    await lstat(requested);
    throw new Error('Unix socket path exists; manual recovery required');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return requested;
}
