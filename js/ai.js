// The AI. One machine for every level: enumerate legalActions, apply each, settle our own
// follow-up questions greedily, score the result with evaluate(), and compare against the
// do-nothing baseline (ending the turn). Weights carry their reason (KB LESSONS §3: "cite a
// reason or don't change it").
(function () {
  const LC = globalThis.LC;
  const AI = (LC.ai = LC.ai || {});

  // easy: one ply with noise and blunders. normal/hard: one opponent ply on determinized
  // copies (see AI.choose); measured in docs/ai.md. `onePly` is the rollout policy and the old
  // normal level.
  const LEVELS = {
    easy: { noise: 14, blunder: 0.25, threat: 0.25, sample: 10 },
    onePly: { noise: 2, blunder: 0, threat: 0.7, sample: 18 },
    normal: { noise: 1, blunder: 0, threat: 0.7, sample: 18, reply: 2, worlds: 1 },
    hard: { noise: 0, blunder: 0, threat: 0.7, sample: 28, reply: 4, worlds: 3 },
  };

  // Lore is the race. Superlinear near 20 because the last points end the game (KB §3: "score
  // race evaluation is superlinear near the threshold").
  const loreValue = (L) => (L >= 20 ? 1e6 : L * 10 + Math.max(0, L - 12) ** 2 * 1.6);

  function charValue(s, i, w) {
    const ch = LC.chars(s, i);
    const hp = Math.max(0, ch.wp - ch.damage);
    let v = ch.lore * (w.loreBody || 6) + Math.max(0, ch.str) * 1.4 + hp * 1.1 + ch.cost * 0.6;
    // Keywords that make a body harder to answer or better at racing.
    if (ch.kw.Evasive) v += 3;
    if (ch.kw.Ward) v += 2;
    if (ch.kw.Bodyguard) v += 1;
    if (ch.kw.Resist) v += ch.kw.Resist * 1.5;
    if (ch.kw.Challenger) v += ch.kw.Challenger * 0.4;
    if (ch.kw.Support) v += 1;
    if (ch.flags.cantReady && ch.exerted) v *= 0.6; // stuck exerted: no quest next turn
    if (ch.activated.length) v += 1.5;
    return v;
  }

  // Can any of `by`'s characters, once ready on their turn, banish exerted character t?
  function exposed(s, t, by) {
    const T = LC.chars(s, t);
    if (!s.cards[t].exerted || T.flags.cantBeChallenged) return false;
    const left = T.wp - T.damage;
    for (const a of LC.characters(s, by)) {
      const A = LC.chars(s, a);
      if (A.flags.cantChallenge || A.flags.cantReady && s.cards[a].exerted) continue;
      if (T.kw.Evasive && !A.kw.Evasive && !A.kw.Alert) continue;
      let dmg = Math.max(0, A.str) + (A.kw.Challenger || 0) - (T.kw.Resist || 0);
      if (dmg >= left) return true;
    }
    return false;
  }

  AI.evaluate = function (s, me, w = LEVELS.normal) {
    if (s.winner !== null) return s.winner === me ? 1e7 : -1e7;
    const op = 1 - me;
    let v = loreValue(s.players[me].lore) - loreValue(s.players[op].lore);
    for (const side of [me, op]) {
      const sign = side === me ? 1 : -1;
      const P = s.players[side];
      let board = 0;
      for (const i of P.play) {
        const d = LC.def(i, s);
        if (LC.isCharacter(d)) {
          let cv = charValue(s, i, w);
          // The central Lorcana question: will an exerted character survive the other
          // player's turn? Only the side that is about to pass the turn is exposed.
          if (side === s.active && exposed(s, i, 1 - side)) cv -= cv * w.threat;
          board += cv;
        } else board += d.cost * 1.6 + 1;
      }
      // Lore the opponent threatens next turn is already counted via lore*loreBody in charValue.
      const ink = P.ink.length;
      const inkV = Math.min(ink, 7) * 4.2 + Math.max(0, ink - 7) * 0.8;
      const handV = P.hand.length * 3.2;
      const deckV = P.deck.length < 6 ? -(6 - P.deck.length) * 4 : 0;
      v += sign * (board + inkV + handV + deckV);
    }
    return v;
  };

  // Resolve our own pending questions greedily (one level), stopping at the other seat's turn
  // to act or the main phase.
  function settleOwn(s, me, w, depth = 0) {
    while (s.ask && s.ask.who === me && depth < 6) {
      s = bestAnswer(s, me, w, depth + 1).state;
      depth++;
    }
    return s;
  }

  function bestAnswer(s, me, w, depth = 0) {
    const ask = s.ask;
    if (ask.kind === 'mulligan') return { action: { type: 'answer', value: mulliganPick(s, me) }, state: LC.apply(s, { type: 'answer', value: mulliganPick(s, me) }) };
    let opts = LC.legalActions(s);
    if (opts.length > w.sample * 3) opts = stride(opts, w.sample * 3);
    let best = null;
    for (const a of opts) {
      let s2;
      try { s2 = LC.apply(s, a); } catch (e) { continue; }
      if (depth < 3) s2 = settleOwnShallow(s2, me, w, depth);
      const sc = AI.evaluate(s2, me, w);
      if (!best || sc > best.score) best = { action: a, state: s2, score: sc };
    }
    if (!best) throw new Error('AI: no answer applies');
    return best;
  }
  function settleOwnShallow(s, me, w, depth) {
    // Follow-up questions in the same effect: answer with the first legal option except when
    // cheap to search; keeps answer search linear.
    let guard = 0;
    while (s.ask && s.ask.who === me && guard++ < 4) {
      const r = bestAnswer(s, me, w, depth + 1);
      s = r.state;
    }
    return s;
  }

  function stride(arr, n) {
    if (arr.length <= n) return arr;
    const out = [];
    const step = arr.length / n;
    for (let k = 0; k < n; k++) out.push(arr[Math.floor(k * step)]);
    return out;
  }

  // Mulligan: bottom expensive cards (cost 6+) beyond one, and uninkable cards when we hold
  // fewer than 3 inkable ones. Keeps a curve; the publisher's rules decide the rest.
  function mulliganPick(s, me) {
    const hand = s.players[me].hand;
    const d = (i) => LC.def(i, s);
    const pick = [];
    const big = hand.filter((i) => d(i).cost >= 6).sort((a, b) => d(b).cost - d(a).cost);
    pick.push(...big.slice(big.length > 1 ? 0 : 1));
    const kept = hand.filter((i) => !pick.includes(i));
    if (kept.filter((i) => d(i).inkwell).length < 3) for (const i of kept) if (!d(i).inkwell && d(i).cost >= 4) pick.push(i);
    return pick;
  }

  // Choose an action for `seat`. Synchronous; deterministic for a given state and level except
  // for easy-level noise, which is seeded from the state so replays reproduce.
  AI.choose = function (s, seat, level = 'normal') {
    const w = LEVELS[level] || LEVELS.normal;
    if (LC.whoActs(s) !== seat) throw new Error('AI.choose: not this seat to act');
    let rnd = (LC.hashSeed(String(s.logN) + ':' + s.seed) >>> 0) / 4294967296;
    const noise = () => { rnd = (rnd * 9301 + 0.49297) % 1; return (rnd - 0.5) * 2 * w.noise; };
    if (s.ask) {
      if (s.ask.kind === 'mulligan') return { type: 'answer', value: mulliganPick(s, seat) };
      return bestAnswer(s, seat, w).action;
    }
    const acts = LC.legalActions(s);
    const end = acts.find((a) => a.type === 'end');
    // Do-nothing baseline at the same horizon: the current position, still our turn (KB §3).
    const here = AI.evaluate(s, seat, w);
    const scored = [];
    for (const a of acts) {
      if (a.type === 'end') continue;
      let s2;
      try { s2 = LC.apply(s, a); } catch (e) { continue; }
      s2 = settleOwn(s2, seat, w);
      const sc = AI.evaluate(s2, seat, w) + noise();
      scored.push({ a, sc });
    }
    scored.sort((x, y) => y.sc - x.sc);
    // Hard: one opponent ply. The top few candidates (and ending the turn) are played out
    // through the rest of our turn and the opponent's whole reply on a determinized copy, and
    // judged at the start of our next turn. Answers "can they banish it before it quests
    // again" by playing it, not by a weight (KB LESSONS §3: one ply beat four weight terms).
    if (w.reply && scored.length) {
      const cands = scored.slice(0, w.reply).map((x) => x.a);
      if (end) cands.push(end);
      // Every candidate is judged in the SAME hidden-card worlds (common random numbers), or
      // the comparison measures the luck of each candidate's reshuffle instead of the move.
      const worlds = Array.from({ length: w.worlds || 2 }, (_, k) => 'det:' + s.logN + ':' + s.seed + ':' + k);
      let best = null;
      for (const a of cands) {
        let s2;
        try { s2 = settleOwn(LC.apply(s, a), seat, w); } catch (e) { continue; }
        let sc = 0;
        for (const key of worlds) sc += rollout(determinize(s2, seat, key), seat);
        sc /= worlds.length;
        if (!best || sc > best.sc) best = { a, sc };
      }
      if (best) return best.a;
    }
    // Compare actions to the current position (same horizon, still our turn); end the turn
    // when nothing improves it.
    if (!scored.length || scored[0].sc <= here + 0.25) return end || acts[0];
    if (w.blunder && rnd < w.blunder && scored.length > 2) return scored[1 + Math.floor(rnd * 2)].a;
    return scored[0].a;
  };

  // The AI may not read the opponent's hand or either deck order (KB LESSONS §1.1): reshuffle
  // the opponent's hand+deck and our own deck in a copy before looking ahead.
  function determinize(s, me, key) {
    const t = LC.clone(s);
    let r = (LC.hashSeed(key) >>> 0) || 1;
    const rand = (n) => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r % n; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const op = t.players[1 - me];
    const pool = shuffle([...op.hand, ...op.deck]);
    op.hand = pool.slice(0, op.hand.length);
    op.deck = pool.slice(op.hand.length);
    for (const i of op.hand) t.cards[i].zone = 'hand';
    for (const i of op.deck) t.cards[i].zone = 'deck';
    shuffle(t.players[me].deck);
    return t;
  }

  // Play both sides with the normal policy (fewer candidates) until it is our turn again.
  function rollout(s, me) {
    const w = { ...LEVELS.onePly, noise: 0, sample: 10 };
    const stopTurn = s.turn + (s.active === me ? 2 : 1);
    let t = s;
    for (let n = 0; n < 60 && !LC.isTerminal(t); n++) {
      const who = LC.whoActs(t);
      if (t.turn >= stopTurn && who === me && !t.ask) break;
      t = LC.apply(t, fastChoose(t, who, w));
    }
    return AI.evaluate(t, me, w);
  }
  function fastChoose(s, seat, w) {
    if (s.ask) return s.ask.kind === 'mulligan' ? { type: 'answer', value: [] } : bestAnswer(s, seat, w, 2).action;
    const acts = LC.legalActions(s);
    const end = acts.find((a) => a.type === 'end');
    const here = AI.evaluate(s, seat, w);
    let best = null;
    for (const a of stride(acts.filter((x) => x.type !== 'end'), 14)) {
      let s2;
      try { s2 = LC.apply(s, a); } catch (e) { continue; }
      while (s2.ask && s2.ask.who === seat) s2 = bestAnswer(s2, seat, w, 3).state;
      const sc = AI.evaluate(s2, seat, w);
      if (!best || sc > best.sc) best = { a, sc };
    }
    return !best || best.sc <= here + 0.25 ? end || acts[0] : best.a;
  }

  AI.LEVELS = LEVELS;
})();
