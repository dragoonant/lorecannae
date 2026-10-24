// Test harness: a tiny runner plus position builders. Tests build an exact position, act only
// through LC.apply, and assert the SIDE EFFECT (KB LESSONS §2.3).
(function () {
  const LC = globalThis.LC;
  const T = (LC.T = { tests: [] });
  T.test = (name, fn) => T.tests.push({ name, fn });
  T.eq = (a, b, msg) => {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error(`${msg || 'eq'}: expected ${sb}, got ${sa}`);
  };
  T.ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };
  T.throws = (fn, msg) => { let threw = false; try { fn(); } catch (e) { threw = true; } if (!threw) throw new Error(msg || 'expected a throw'); };

  T.FILLER = 'thomas-wide-eyed-recruit'; // a vanilla 1-cost character

  // T.game(layout) -> a main-phase state with exactly the given cards.
  // layout = { active:0, turn:3, p0:{hand:[id], play:[id|{id,exerted,damage,dry}], ink:n|[ids],
  //            deck:[id] (top first; default 10 fillers), discard:[id], lore:n}, p1:{...} }
  T.game = function (layout = {}) {
    let s = LC.newGame({ decks: [{ name: 'A', cards: [] }, { name: 'B', cards: [] }], seed: layout.seed || 1, first: 0 });
    // newGame queued mulligans for empty hands; build the real position directly.
    s = LC.clone(s);
    s.ask = null; s.pendingJob = null; s.pendingSnap = null; s.queue = []; s.bag = [];
    s.phase = 'main';
    s.active = layout.active || 0;
    s.first = layout.first == null ? 0 : layout.first;
    s.turn = layout.turn || 3;
    s.ti = LC._internal.freshTurnInfo();
    s.log = [];
    for (const p of [0, 1]) {
      const L = layout['p' + p] || {};
      const P = s.players[p];
      P.lore = L.lore || 0;
      P.inkedThisTurn = !!L.inked;
      const mk = (id, zone, extra = {}) => {
        if (!LC.CARDS[id]) throw new Error(`T.game: unknown card ${id}`);
        const iid = 'c' + s.nextIid++;
        s.cards[iid] = { iid, id, owner: p, zone, exerted: false, damage: 0, under: [], facedown: zone === 'deck' || zone === 'ink', enteredTurn: null, dry: false, mods: [], ...extra };
        return iid;
      };
      P.hand = (L.hand || []).map((id) => mk(id, 'hand'));
      P.play = (L.play || []).map((e) => {
        const o = typeof e === 'string' ? { id: e } : e;
        return mk(o.id, 'play', { exerted: !!o.exerted, damage: o.damage || 0, dry: o.dry !== false, enteredTurn: o.dry === false ? s.turn : 1 });
      });
      const inkIds = typeof L.ink === 'number' ? Array(L.ink).fill(T.FILLER) : (L.ink || []);
      P.ink = inkIds.map((id) => mk(id, 'ink'));
      P.deck = (L.deck || Array(10).fill(T.FILLER)).map((id) => mk(id, 'deck'));
      P.discard = (L.discard || []).map((id) => mk(id, 'discard'));
    }
    return s;
  };

  // Find the instance id of a card by definition id (first match) in a player's zone.
  T.find = (s, p, id, zone) => {
    const z = zone ? [zone] : ['play', 'hand', 'ink', 'discard', 'deck'];
    for (const k of z) for (const iid of s.players[p][k]) if (s.cards[iid].id === id) return iid;
    for (const c of Object.values(s.cards)) if (c.owner === p && c.id === id && (!zone || c.zone === zone)) return c.iid;
    throw new Error(`T.find: ${id} not found for p${p}`);
  };
  T.findAll = (s, p, id) => Object.values(s.cards).filter((c) => c.owner === p && c.id === id).map((c) => c.iid);

  // Apply the first legal action matching `m` (partial object). On failure, list what was legal.
  T.act = (s, m) => {
    const legal = LC.legalActions(s);
    const a = legal.find((l) => Object.entries(m).every(([k, v]) => l[k] === v));
    if (!a) throw new Error(`T.act: no legal action matching ${JSON.stringify(m)}; legal: ${JSON.stringify(legal).slice(0, 600)}; ask: ${JSON.stringify(s.ask)}`);
    return LC.apply(s, a);
  };
  T.answer = (s, value) => {
    if (!s.ask) throw new Error(`T.answer: no pending ask (wanted to answer ${JSON.stringify(value)})`);
    return LC.apply(s, { type: 'answer', value });
  };
  T.legal = (s, m) => LC.legalActions(s).some((l) => Object.entries(m).every(([k, v]) => l[k] === v));
  T.zone = (s, iid) => s.cards[iid].zone;
  // Advance through end of turn into the next player's main phase, answering nothing.
  T.endTurn = (s) => T.act(s, { type: 'end' });

  T.runAll = function (filter, quiet) {
    let pass = 0, fail = 0;
    const fails = [];
    for (const t of T.tests) {
      if (filter && !t.name.includes(filter)) continue;
      try { t.fn(); pass++; } catch (e) { fail++; fails.push(`FAIL ${t.name}: ${e.message}`); }
    }
    return { pass, fail, fails };
  };
})();
