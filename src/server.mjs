import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { createServer } from 'node:http';
import { chmod } from 'node:fs/promises';
import { selectLocalSocket } from './local_socket.mjs';
import { lstat, open, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentId, objectPath, readCatalog, searchVault, vaultRoot } from './vault.mjs';
import { inventory as kiwixInventory } from './kiwix.mjs';

const webroot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);
const host = process.env.PHIARK_HOST || '127.0.0.1';
const port = Number(process.env.PHIARK_PORT || 3691);
if (!['127.0.0.1', '::1', 'localhost'].includes(host) && process.env.PHIARK_ALLOW_LAN !== '1') {
  throw new Error('LAN serving requires explicit PHIARK_ALLOW_LAN=1. No authentication exists in R0.1.');
}
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PHIARK_PORT');
const common = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
function respond(res, status, body, type = 'application/json; charset=utf-8', head = false) {
  res.writeHead(status, { ...common, 'Content-Type': type });
  res.end(head ? undefined : body);
}
// Check the object through the same descriptor that will serve it. A pathname
// stat/size check alone permits same-length corruption and symlink substitution.
async function openVerifiedDocument(filename, expectedSha256, expectedBytes) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > 512 * 1024 * 1024) {
    throw new Error('invalid catalog byte count');
  }
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('unsafe document path');
  const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size !== expectedBytes || 
        info.dev !== before.dev || info.ino !== before.ino) {
      throw new Error('document size or identity mismatch');
    }
    const digest = createHash('sha256');
    const block = Buffer.allocUnsafe(256 * 1024);
    for (let position = 0; position < info.size;) {
      const { bytesRead } = await file.read(
        block, 0, Math.min(block.length, info.size - position), position
      );
      if (bytesRead === 0) throw new Error('document truncated during verification');
      digest.update(block.subarray(0, bytesRead));
      position += bytesRead;
    }
    if (digest.digest('hex') !== expectedSha256) throw new Error('document SHA-256 mismatch');
    return file;
  } catch (error) {
    await file.close();
    throw error;
  }
}

const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) return respond(res, 405, JSON.stringify({ error: 'read only' }));
    const head = req.method === 'HEAD';
    const url = new URL(req.url, 'http://local.phiark');
    if (staticFiles.has(url.pathname)) {
      const [filename, type] = staticFiles.get(url.pathname);
      const content = await readFile(join(webroot, filename));
      return respond(res, 200, content, type, head);
    }
    if (url.pathname === '/api/status') {
      const entries = await readCatalog();
      return respond(res, 200, JSON.stringify({ mode: 'LOCAL', documents: entries.length, networkRequired: false, verified: false }), undefined, head);
    }
    if (url.pathname === '/api/items') {
      return respond(res, 200, JSON.stringify(await readCatalog()), undefined, head);
    }
    if (url.pathname === '/api/kiwix') {
      // Explicit read-only inventory, computed from local checksums.
      // Reader launch is never exposed as an HTTP endpoint.
      return respond(res, 200, JSON.stringify({
        archiveStatus: 'LOCALLY_VERIFIED_BYTES_ONLY',
        readerLaunch: 'OPERATOR_CLI_ONLY',
        readerRunning: 'UNKNOWN_NOT_PROBED',
        rows: await kiwixInventory()
      }), undefined, head);
    }
    if (url.pathname === '/api/search') {
      const entries = await searchVault(url.searchParams.get('q') || '', url.searchParams.get('subject') || 'all');
      return respond(res, 200, JSON.stringify(entries), undefined, head);
    }
    if (url.pathname.startsWith('/documents/')) {
      const id = url.pathname.slice('/documents/'.length);
      if (!isDocumentId(id)) return respond(res, 404, '{"error":"not found"}', undefined, head);
      const entry = (await readCatalog()).find((x) => x.id === id);
      if (!entry) return respond(res, 404, '{"error":"not found"}', undefined, head);
      const filename = objectPath(vaultRoot(), id);
      let file;
      try {
        file = await openVerifiedDocument(filename, id, entry.bytes);
      } catch {
        // Do not disclose private filesystem paths, or return stale/modified bytes.
        return respond(res, 409, '{"error":"integrity check required"}', undefined, head);
      }
      const contentType = ['text/plain; charset=utf-8', 'application/pdf', 'application/epub+zip'].includes(entry.mime)
        ? entry.mime : 'application/octet-stream';
      const disposition = entry.extension === '.epub' ? 'attachment' : 'inline';
      if (head) {
        await file.close();
        res.writeHead(200, { ...common, 'Content-Type': contentType, 'Content-Length': entry.bytes,
          'Content-Disposition': disposition + '; filename="' + entry.id + entry.extension + '"' });
        return res.end();
      }
      const stream = file.createReadStream({ start: 0, autoClose: true });
      stream.on('error', () => res.destroy());
      res.once('close', () => stream.destroy());
      res.writeHead(200, { ...common, 'Content-Type': contentType, 'Content-Length': entry.bytes,
        'Content-Disposition': disposition + '; filename="' + entry.id + entry.extension + '"' });
      stream.pipe(res);
      return;
    }
    return respond(res, 404, '{"error":"not found"}', undefined, head);
  } catch (error) {
    console.error('PhiARK server:', error.message);
    if (!res.headersSent) respond(res, 500, '{"error":"local vault error"}');
    else res.destroy();
  }
});
// Isolated PhiOS services may bind a filesystem socket without inheriting the
// host network. This is NOT a browser bridge and confers no install/launch grant.
const unixSocket = await selectLocalSocket(process.env, vaultRoot());
if (unixSocket !== null) {
  // Ensure socket creation is private from the first instant, before chmod.
  process.umask(0o077);
  server.listen(unixSocket, async () => {
    try {
      await chmod(unixSocket, 0o600);
      console.log('PhiARK R0.6 private Unix socket: ' + unixSocket);
    } catch (error) {
      console.error('PhiARK socket permission setup failed:', error.message);
      server.close();
      process.exitCode = 1;
    }
  });
} else {
  server.listen(port, host, () => {
    const address = server.address();
    console.log('PhiARK R0.5 local knowledge vault: http://' + host + ':' + address.port);
    if (process.env.PHIARK_ALLOW_LAN === '1') console.warn('WARNING: no authentication. Use only on trusted isolated networks.');
  });
}
