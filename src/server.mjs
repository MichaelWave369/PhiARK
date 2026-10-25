import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentId, objectPath, readCatalog, searchVault, vaultRoot } from './vault.mjs';

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
      const info = await stat(filename);
      if (!info.isFile() || info.size !== entry.bytes) return respond(res, 409, '{"error":"integrity check required"}', undefined, head);
      const contentType = ['text/plain; charset=utf-8', 'application/pdf', 'application/epub+zip'].includes(entry.mime)
        ? entry.mime : 'application/octet-stream';
      const disposition = entry.extension === '.epub' ? 'attachment' : 'inline';
      res.writeHead(200, { ...common, 'Content-Type': contentType, 'Content-Length': info.size,
        'Content-Disposition': disposition + '; filename="' + entry.id + entry.extension + '"' });
      if (head) return res.end();
      const stream = createReadStream(filename);
      stream.on('error', () => res.destroy());
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
server.listen(port, host, () => {
  const address = server.address();
  console.log('PhiARK R0.1 local knowledge vault: http://' + host + ':' + address.port);
  if (process.env.PHIARK_ALLOW_LAN === '1') console.warn('WARNING: no authentication. Use only on trusted isolated networks.');
});
