// Every gate, one line each. Exit non-zero if any fails.
import { spawnSync } from 'node:child_process';
const steps = [
  ['tests', ['tools/test.mjs', '--quiet']],
  ['check-pages', ['tools/check-pages.mjs']],
  ['sim random', ['tools/sim.mjs', '--games', '30', '--policy', 'random']],
  ['sim ai', ['tools/sim.mjs', '--games', '10']],
];
let bad = 0;
for (const [name, args] of steps) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trim().split('\n');
  const last = out.filter((l) => !l.startsWith('FAIL') && !l.includes('ERROR')).slice(-1)[0] || '';
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${name}: ${last}`);
  if (r.status !== 0) { bad++; for (const l of out.filter((l) => l.startsWith('FAIL') || l.includes('ERROR')).slice(0, 8)) console.log('     ' + l); }
}
process.exit(bad ? 1 : 0);
