// Printed-vs-scripted auditor (KB LESSONS §2.3). For every scripted card:
//   FAIL - a number in the printed ability text (outside reminder text and keyword lines) does
//          not appear anywhere in the card's script source (a dropped clause or wrong amount).
//   WARN - a printed ability NAME (ALL CAPS lead-in) is not used as a name in the script.
// --selftest proves FAIL fires on a known-bad script.
import { loadPage } from './test.mjs';
const LC = loadPage('tests.html').LC;
const KW = /^(Alert|Bodyguard|Evasive|Reckless|Rush|Support|Vanish|Ward|Challenger \+\d+|Resist \+\d+|Singer \d+|Boost \d+(?: \{I\})?|Shift \d+(?: \{I\})?|Sing Together \d+)\b/;
const src = (v) => typeof v === 'function' ? v.toString() : Array.isArray(v) ? v.map(src).join(' ') : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => k + ':' + src(x)).join(' ') : String(v);
function audit(d, script) {
  const fails = [], warns = [];
  const code = src(script);
  for (const raw of (d.text || '').split('\n')) {
    let line = raw.replace(/\([^)]*\)/g, '').trim();
    if (!line || KW.test(line) && !/[a-z]{4,}/.test(line.replace(KW, '').replace(/\{.\}/g, ''))) continue;
    line = line.replace(KW, '');
    const name = line.match(/^([A-Z0-9'’!?,.\- ]{3,}?)(?= [A-Z][a-z]| \{| \d| You| When| Whenever| During| At| If| While| This| Each| Your| Choose| Once| As| For| Look| Draw| Banish| Deal| Put| Return| Exert| Chosen| Characters| Opponents| Up| Play| Reveal| Remove| Move)/);
    if (name && !code.toUpperCase().includes(name[1].trim().replace(/’/g, "'"))) warns.push(`name "${name[1].trim()}" not in script`);
    for (const m of line.matchAll(/(?<![A-Za-z])(\d+)/g)) {
      const n = m[1];
      if (!new RegExp(`(?<![\w.])${n}(?![\w])`).test(code)) fails.push(`printed number ${n} absent ("${line.slice(Math.max(0, m.index - 30), m.index + 25)}")`);
    }
  }
  return { fails, warns };
}
if (process.argv.includes('--selftest')) {
  const d = LC.CARDS['tod-clever-fox'];
  const bad = { triggers: [{ name: 'PROBLEM SOLVING', run(x) { x.draw(x.ctrl, 3); } }] };
  const r = audit(d, bad);
  console.log(r.fails.length ? 'audit selftest: ok (bad script flagged)' : 'audit selftest: FAILED to flag a bad script');
  process.exit(r.fails.length ? 0 : 1);
}
let F = 0, W = 0;
for (const d of Object.values(LC.CARDS)) {
  const script = LC.ABIL[d.id];
  if (!script) continue;
  const r = audit(d, script);
  for (const f of r.fails) { F++; console.log(`FAIL ${d.id}: ${f}`); }
  for (const w of r.warns) { W++; if (process.argv.includes('--warn')) console.log(`WARN ${d.id}: ${w}`); }
}
console.log(`audit: ${F} FAIL, ${W} WARN over ${Object.keys(LC.ABIL).length} scripts`);
process.exit(F ? 1 : 0);
