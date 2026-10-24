// Replay a saved bug trace headlessly: node tools/replay-report.mjs traces/<file>.json
// --selftest plays a short AI game, saves its trace in memory and replays it.
import fs from 'node:fs';
import { loadPage } from './test.mjs';
const ctx = loadPage('tests.html');
const LC = ctx.LC;
let trace;
if (process.argv.includes('--selftest')) {
  const opts = { decks: [LC.DECKS[0].id, LC.DECKS[1].id], seed: 99 };
  trace = LC.makeTrace(opts); trace.logN = [];
  let s = LC.newGame(opts);
  for (let k = 0; k < 400 && !LC.isTerminal(s); k++) {
    const a = LC.ai.choose(s, LC.whoActs(s), 'normal');
    try { s = LC.apply(s, a); } catch (e) { console.log('selftest: game threw (content not finished?):', e.message); break; }
    trace.actions.push(a); trace.logN.push(s.logN);
  }
} else trace = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const r = LC.replay(trace);
if (r.ok) console.log(`replay ok: ${trace.actions.length} actions, turn ${r.state.turn}, winner ${r.state.winner}`);
else {
  console.log(`replay ${r.kind} at action ${r.at}: ${JSON.stringify(r.action)}`);
  if (r.error) console.log(r.error.split('\n').slice(0, 6).join('\n'));
  const tail = r.state.log.slice(-12).map((e) => `  #${e.n} t${e.turn} p${e.who} ${e.type} ${JSON.stringify({ ...e, n: undefined, turn: undefined, who: undefined, type: undefined })}`);
  console.log(tail.join('\n'));
  process.exit(1);
}
