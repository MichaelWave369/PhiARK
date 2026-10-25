import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const index = await readFile(new URL('index.html', dist), 'utf8');
assert.match(index, /PhiARK/);
assert.match(index, /\/PhiARK\/assets\/index-[^"]+\.js/);
assert.match(index, /\/PhiARK\/assets\/index-[^"]+\.css/);
assert.doesNotMatch(index, /src="https?:\/\//i);
assert.doesNotMatch(index, /href="https?:\/\/[^"]+\.(js|css)"/i);
for (const name of ['sw.js', 'manifest.webmanifest', 'icon.svg']) {
  assert((await stat(new URL(name, dist))).size > 0, name + ' missing');
}
const assets = await readdir(new URL('assets/', dist));
assert(assets.some(name => /^index-.*\.js$/.test(name)), 'Missing compiled React bundle');
assert(assets.some(name => /^index-.*\.css$/.test(name)), 'Missing compiled CSS');
console.log('PASS: built React app has only first-party local runtime assets and correct /PhiARK/ base');
