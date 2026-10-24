// Headless games with invariants after every step: a crash gate and a behaviour readout, never
// a balance instrument (PLAN D1). Usage:
//   node tools/sim.mjs --games 20 [--policy ai|random] [--level normal] [--decks pool|vanilla] [--seed 1]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('games', 20), POLICY = arg('policy', 'ai'), LEVEL = arg('level', 'normal'), DECKS = arg('decks', 'pool'), SEED = +arg('seed', 1);
const MAX_STEPS = 4000;

const html = fs.readFileSync(path.join(ROOT, 'tests.html'), 'utf8');
const block = html.split('<!-- engine -->')[1].split('<!-- /engine -->')[0];
const srcs = [...block.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
const ctx = { console, structuredClone, performance };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
const LC = ctx.LC;

const KW = /^(Alert|Bodyguard|Evasive|Reckless|Rush|Support|Vanish|Ward|Challenger \+\d+|Resist \+\d+|Singer \d+|Boost \d+(?: \{I\})?|Shift \d+(?: \{I\})?|Sing Together \d+)$/;
const needs = (d) => (d.text || '').split('\n').some((r) => { const l = r.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); return l && !KW.test(l); });
const playable = (deck) => deck.cards.every(([id]) => !LC.DEFECTS[id] && (!needs(LC.CARDS[id]) || LC.ABIL[id]));
const VANILLA = { name: 'Vanilla', cards: [['thomas-wide-eyed-recruit', 8], ['darkwing-duck-crime-fighter', 8], ['nakoma-waiting-out-the-storm', 8], ['prince-eric-noble-swordsman', 8], ['david-protective-snowboarder', 8], ['hamish-hubert-and-harris-troublemaking-triplets', 8], ['violet-parr-force-field-practice', 8], ['sven-leaping-reindeer', 4]] };
const pool = DECKS === 'vanilla' ? [VANILLA] : LC.DECKS.filter(playable);
if (!pool.length) { console.log('sim: no playable decks'); process.exit(1); }

function invariants(s) {
  const seen = new Map();
  for (const p of [0, 1]) for (const z of ['deck', 'hand', 'ink', 'discard', 'play']) for (const i of s.players[p][z]) {
    if (seen.has(i)) throw new Error(`card ${i} in two zones`);
    seen.set(i, z);
    if (s.cards[i].zone !== z) throw new Error(`card ${i} zone mismatch ${s.cards[i].zone} vs ${z}`);
  }
  for (const c of Object.values(s.cards)) {
    if (c.damage < 0 || Number.isNaN(c.damage)) throw new Error(`bad damage on ${c.iid}`);
    if (c.zone === 'under' && !Object.values(s.cards).some((x) => x.under.includes(c.iid))) throw new Error(`orphan under card ${c.iid}`);
  }
  for (const P of s.players) if (P.lore < 0 || Number.isNaN(P.lore)) throw new Error('bad lore');
  if (!LC.isTerminal(s) && !LC.legalActions(s).length) throw new Error('no legal actions');
}

const stats = { games: 0, errors: 0, capped: 0, wins: [0, 0], firstWins: 0, decisive: 0, turns: 0, emptyTurns: 0, ownTurns: 0, quests: 0, challenges: 0, plays: 0, inks: 0, reasons: {}, ms: 0 };
const t0 = Date.now();
let rng = SEED;
const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
for (let g = 0; g < GAMES; g++) {
  const da = pool[Math.floor(rnd() * pool.length)], db = pool[Math.floor(rnd() * pool.length)];
  let s;
  try {
    s = LC.newGame({ decks: [da.id ? da.id : da, db.id ? db.id : db], seed: SEED * 1000 + g });
    let steps = 0, actionsThisTurn = 0, turnSeen = s.turn;
    while (!LC.isTerminal(s) && steps < MAX_STEPS) {
      const who = LC.whoActs(s);
      let a;
      if (POLICY === 'random') { const L = LC.legalActions(s); a = L[Math.floor(rnd() * L.length)]; }
      else a = LC.ai.choose(s, who, LEVEL);
      if (!s.ask) {
        if (a.type === 'end') { stats.ownTurns++; if (actionsThisTurn === 0) stats.emptyTurns++; actionsThisTurn = 0; }
        else { actionsThisTurn++; if (a.type === 'quest') stats.quests++; if (a.type === 'challenge') stats.challenges++; if (a.type === 'play') stats.plays++; if (a.type === 'ink') stats.inks++; }
      }
      s = LC.apply(s, a);
      invariants(s);
      steps++;
    }
    if (!LC.isTerminal(s)) stats.capped++;
    else { stats.decisive++; stats.wins[s.winner]++; if (s.winner === s.first) stats.firstWins++; stats.reasons[s.endReason] = (stats.reasons[s.endReason] || 0) + 1; }
    stats.turns += s.turn;
  } catch (e) {
    stats.errors++;
    console.log(`game ${g} (${da.id || 'vanilla'} vs ${db.id || 'vanilla'}) ERROR: ${e.message}\n  ${String(e.stack).split('\n').slice(1, 4).join('\n  ')}`);
  }
  stats.games++;
}
stats.ms = Date.now() - t0;
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
console.log(`sim ${POLICY}/${LEVEL} ${stats.games} games over ${pool.length} decks: ${stats.errors} errors, ${stats.capped} capped, decisive ${stats.decisive} ${JSON.stringify(stats.reasons)}`);
console.log(`  first-player wins ${pct(stats.firstWins, stats.decisive)}, mean turns ${(stats.turns / Math.max(1, stats.games)).toFixed(1)}, empty turns ${pct(stats.emptyTurns, stats.ownTurns)}, per turn: quests ${(stats.quests / Math.max(1, stats.ownTurns)).toFixed(2)} challenges ${(stats.challenges / Math.max(1, stats.ownTurns)).toFixed(2)} plays ${(stats.plays / Math.max(1, stats.ownTurns)).toFixed(2)} inks ${(stats.inks / Math.max(1, stats.ownTurns)).toFixed(2)}; ${(stats.ms / Math.max(1, stats.games) / 1000).toFixed(1)} s/game`);
process.exit(stats.errors ? 1 : 0);
