// Page gates: (1) index.html and tests.html load the identical engine script list in the same
// order; (2) no silent fallbacks in UI code (`if (!LC.x)` / `LC.x || {}`), KB LESSONS §1.3;
// (3) every script a page references exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const block = (f) => {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (!html.includes('<!-- engine -->')) { fails.push(`${f}: no <!-- engine --> block`); return []; }
  const b = html.split('<!-- engine -->')[1].split('<!-- /engine -->')[0];
  return [...b.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
};
const all = (f) => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"?#]+)/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u));
const a = block('index.html'), b = block('tests.html');
if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`engine script lists differ:\n  index: ${a.join(' ')}\n  tests: ${b.join(' ')}`);
for (const f of ['index.html', 'tests.html']) for (const u of all(f)) if (!fs.existsSync(path.join(ROOT, u))) fails.push(`${f}: missing ${u}`);
const uiDir = path.join(ROOT, 'js/ui');
if (fs.existsSync(uiDir)) for (const f of fs.readdirSync(uiDir)) {
  if (!f.endsWith('.js') || f === 'dev-fixture.js') continue;
  const code = fs.readFileSync(path.join(uiDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  if (/if\s*\(\s*!\s*LC\.[A-Za-z_]+\s*\)/.test(code)) fails.push(`js/ui/${f}: silent-fallback guard "if (!LC.x)"`);
  // A module creating its own namespace (`LC.anim = LC.anim || {}`) is fine; a read that
  // substitutes {} for a missing module is not.
  const reads = code.replace(/(LC\.[A-Za-z_.]+)\s*=\s*\1\s*\|\|\s*\{\s*\}/g, '');
  if (/LC\.[A-Za-z_.]+\s*\|\|\s*\{\s*\}/.test(reads)) fails.push(`js/ui/${f}: silent fallback "LC.x || {}"`);
}
for (const f of fails) console.log('FAIL ' + f);
console.log(`check-pages: ${fails.length ? fails.length + ' failure(s)' : 'ok'} (${a.length} engine scripts)`);
process.exit(fails.length ? 1 : 0);
