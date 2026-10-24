// Ability runtime: the context object (`x`) card scripts in data/abilities/*.js receive.
// Every effect goes through these helpers, which call the engine's doors. Authoring guide:
// docs/ABILITIES.md.
(function () {
  const LC = globalThis.LC;
  const def = (s, iid) => LC.CARDS[s.cards[iid].id];

  LC.ABIL = LC.ABIL || {};

  LC.makeCtx = function (s, job) {
    const x = { s, job, ai: 0, me: null, ctrl: null, opp: null };

    x.withSource = (iid, fn) => {
      const pm = x.me, pc = x.ctrl;
      x.me = iid; x.ctrl = s.cards[iid].owner; x.opp = 1 - x.ctrl;
      try { return fn(); } finally { x.me = pm; x.ctrl = pc; x.opp = pc == null ? null : 1 - pc; }
    };

    // ------------------------------------------------------------ questions (PLAN D10)
    x.ask = (q) => {
      if (x.job.answers.length > x.ai) return x.job.answers[x.ai++];
      x.ai++;
      const who = q.who == null ? x.ctrl : q.who;
      throw { __ask: { ...q, who, src: q.src === undefined ? x.me : q.src } };
    };
    // chooseCards: a pick of min..max cards. `chosen` (default true) applies Ward (CR 8.15):
    // an opponent's in-play card with Ward can't be chosen. Zero candidates resolves with no
    // effect (CR 1.7.7); otherwise the player is ALWAYS asked, even with a single candidate.
    x.chooseCards = (o) => {
      const who = o.who == null ? x.ctrl : o.who;
      let from = o.from.slice();
      if (o.chosen !== false) from = from.filter((i) => !(s.cards[i].zone === 'play' && s.cards[i].owner !== who && LC.chars(s, i).kw.Ward));
      const max = Math.min(o.max == null ? 1 : o.max, from.length);
      const min = Math.min(o.min == null ? 1 : o.min, max);
      if (max === 0) return [];
      const pick = x.ask({ kind: 'cards', who, from, seen: o.seen || from, min, max, prompt: o.prompt, src: o.src });
      if (o.chosen !== false) for (const i of pick) x.vanishCheck(i, who);
      return pick;
    };
    x.chooseOne = (from, prompt, o = {}) => x.chooseCards({ ...o, from, prompt, min: o.optional ? 0 : 1, max: 1 })[0] ?? null;
    x.may = (prompt, yes = 'Yes', no = 'No', who) => x.ask({ kind: 'yesno', who, prompt, yes, no });
    x.mode = (prompt, labels, enabled) => x.ask({ kind: 'mode', prompt, options: labels.map((label, i) => ({ label, enabled: enabled ? enabled[i] !== false : true })) });
    // CR 8.14 Vanish is not implemented: no card in the pool has it. Fail loudly if one appears.
    x.vanishCheck = (iid) => {
      if (s.cards[iid].zone === 'play' && LC.chars(s, iid).kw.Vanish) throw new Error('Vanish is not implemented (no Vanish card in the pool)');
    };

    // ------------------------------------------------------------ readers
    x.def = (i) => def(s, i);
    x.chars = (i) => LC.chars(s, i);
    x.name = (i) => LC.fullName(def(s, i));
    x.characters = (p) => LC.characters(s, p);
    x.items = (p) => LC.items(s, p);
    x.inPlay = (p) => LC.inPlay(s, p);
    x.hand = (p) => s.players[p].hand.slice();
    x.discardPile = (p) => s.players[p].discard.slice();
    x.deck = (p) => s.players[p].deck.slice();
    x.isChar = (i) => LC.isCharacter(def(s, i));
    x.isItem = (i) => LC.isItem(def(s, i));
    x.isAction = (i) => LC.isAction(def(s, i));
    x.isSong = (i) => LC.isSong(def(s, i));
    x.hasClass = (i, k) => LC.chars(s, i).classifications.includes(k);
    x.cost = (i) => def(s, i).cost;
    x.myTurn = () => s.active === x.ctrl;
    x.hasNamed = (p, name, except) => LC.hasNamed(s, p, name, except);

    // ------------------------------------------------------------ effects (doors)
    const fromChar = () => (x.me && s.cards[x.me].zone === 'play' && LC.isCharacter(def(s, x.me)) ? x.me : null);
    x.damage = (t, n, o = {}) => LC.dealDamage(s, t, n, { from: fromChar(), ...o });
    x.putDamage = (t, n) => LC.dealDamage(s, t, n, { put: true, from: fromChar() });
    x.moveDamage = (a, b, n) => {
      // CR 1.9.2.4 move = remove from one, put on another.
      const k = Math.min(s.cards[a].damage, n === 'all' ? s.cards[a].damage : n);
      if (k <= 0) return 0;
      s.cards[a].damage -= k;
      LC.log(s, s.cards[a].owner, 'heal', { iid: a, amount: k });
      LC.dealDamage(s, b, k, { put: true, from: fromChar() });
      return k;
    };
    x.heal = (t, n) => LC.removeDamage(s, t, n);
    x.banish = (t) => LC.banish(s, t, { by: fromChar() });
    x.exert = (t) => LC.exert(s, t, 'effect');
    x.ready = (t) => LC.ready(s, t, 'effect');
    x.toHand = (t) => {
      const c = s.cards[t];
      const from = c.zone;
      if (from === 'play') LC.leavePlay(s, t, 'hand');
      else LC.move(s, t, 'hand');
      LC.log(s, c.owner, 'toHand', { iid: t, from });
    };
    x.toDeck = (t, pos = 'bottom') => {
      const c = s.cards[t];
      const from = c.zone;
      if (from === 'play') LC.leavePlay(s, t, 'deck', { pos });
      else LC.move(s, t, 'deck', { pos });
      LC.log(s, c.owner, 'toDeck', { iid: t, from, pos });
    };
    x.shuffleInto = (t) => {
      const c = s.cards[t];
      x.toDeck(t, 'bottom');
      LC.shuffleInPlace(s, s.players[c.owner].deck);
      LC.log(s, c.owner, 'shuffle', {});
    };
    x.toDiscard = (t) => {
      const c = s.cards[t];
      const from = c.zone;
      if (from === 'play') LC.leavePlay(s, t, 'discard');
      else LC.move(s, t, 'discard');
      LC.log(s, c.owner, 'toDiscard', { iid: t, from });
    };
    x.draw = (p, n = 1) => { let k = 0; for (let i = 0; i < n; i++) if (LC.drawCard(s, p)) k++; return k; };
    x.discard = (h) => {
      const c = s.cards[h];
      LC.move(s, h, 'discard');
      LC.log(s, c.owner, 'discard', { iid: h });
      LC.emit(s, { type: 'discarded', iid: h, p: c.owner });
    };
    // "choose and discard N cards" — the discarding player chooses (CR 6.1.3).
    x.chooseDiscard = (p, n = 1, prompt) => {
      const pick = x.chooseCards({ who: p, from: s.players[p].hand.slice(), min: n, max: n, chosen: false, prompt: prompt || `Choose ${n === 1 ? 'a card' : n + ' cards'} to discard.` });
      for (const h of pick) x.discard(h);
      return pick;
    };
    x.gainLore = (p, n) => LC.gainLore(s, p, n);
    x.loseLore = (p, n) => LC.loseLore(s, p, n);
    x.reveal = (iids, p) => { if (iids.length) LC.log(s, p == null ? x.ctrl : p, 'reveal', { iids: iids.slice() }); };

    // Durations for buffs (see tickDurations in engine.js).
    x.until = {
      eot: () => ({ end: { at: 'eot' } }),
      myNextTurn: () => ({ end: { at: 'startOf', p: x.ctrl } }),
      // "during their next turn": switched on at the start of p's turn, off at its end.
      theirNextTurn: (p) => ({ on: false, start: { at: 'startOf', p }, end: { at: 'endOf', p } }),
      // "can't ready at the start of their next turn"
      theirNextReady: (p) => ({ end: { at: 'afterReady', p } }),
    };
    x.buff = (t, mod, dur, text) => {
      s.cards[t].mods.push({ ...mod, ...dur, src: x.me });
      if (text) LC.log(s, x.ctrl, 'buff', { iid: t, text });
    };
    x.effect = (e) => s.effects.push({ ...e, src: x.me });
    x.costMod = (p, m) => s.players[p].costMods.push({ next: true, until: 'eot', ...m, src: x.me });
    x.once = (key) => {
      const k = `once:${x.me}:${key}`;
      if (s.ti.once[k]) return false;
      s.ti.once[k] = true;
      return true;
    };
    x.usedOnce = (key) => !!s.ti.once[`once:${x.me}:${key}`];

    // Play a card without paying its cost ("for free", CR 1.5.5.3).
    x.playFree = (iid) => {
      const from = s.cards[iid].zone;
      LC.playCard(s, x, iid, { pay: 'free', from });
    };

    // "Look at the top N cards of your deck. You may reveal [a card matching F] and put it into
    // your hand. Put the rest on the bottom of your deck in any order." The rest go to the
    // bottom in the order looked at (DEVIATIONS.md).
    x.lookPick = ({ p = x.ctrl, n, filter = () => true, max = 1, prompt }) => {
      const top = s.players[p].deck.slice(0, n);
      if (!top.length) return [];
      const cand = top.filter(filter);
      const pick = x.chooseCards({ who: p, from: cand, seen: top, min: 0, max, chosen: false, prompt });
      if (pick.length) x.reveal(pick, p);
      for (const i of pick) x.toHand(i);
      for (const i of top) if (!pick.includes(i)) LC.move(s, i, 'deck', { pos: 'bottom' });
      return pick;
    };

    return x;
  };

  // CR 8.13 Support: "Whenever this character quests, you may add this character's {S} to
  // another chosen character's {S} this turn."
  LC.keywordSupport = function (x) {
    const str = Math.max(0, x.chars(x.me).str);
    const others = x.characters(x.ctrl).filter((c) => c !== x.me);
    const t = x.chooseOne(others, `Support: you may give another character +${str} strength this turn.`, { optional: true });
    if (t) x.buff(t, { str }, x.until.eot(), `+${str} strength this turn (Support)`);
  };
})();

// Shared helpers for card scripts.
(function () {
  const LC = globalThis.LC;
  const H = (LC.H = {});
  H.self = (s, me, ev) => ev.iid === me;
  H.mine = (s, me, ev) => ev.p === s.cards[me].owner;
  H.myTurn = (s, me) => s.active === s.cards[me].owner;
  H.hasClassInPlay = (s, p, k, except) => LC.characters(s, p).some((i) => i !== except && LC.CARDS[s.cards[i].id].classifications.includes(k));
  // STONE BY DAY (Gargoyles): "If you have 3 or more cards in your hand, this character can't
  // ready." Angela - Night Warrior's ETERNAL NIGHT removes it from her controller's Gargoyles.
  H.stoneByDay = (s, me, t, r) => {
    if (t !== me) return;
    const p = s.cards[me].owner;
    if (s.players[p].play.some((i) => s.cards[i].id === 'angela-night-warrior')) return;
    if (s.players[p].hand.length >= 3) r.flags.cantReady = true;
  };
  // UNDERDOG: "If this is your first turn and you're not the first player, you pay 1 less."
  H.underdog = (s, iid, p) => (p !== s.first && s.turn === 2 ? -1 : 0);
})();
