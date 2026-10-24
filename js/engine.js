// The rules engine. Surface (docs/ENGINE-API.md): newGame, legalActions, apply, whoActs,
// isTerminal, chars, costToPlay, whyNot, actionsFor. CR = Comprehensive Rules 2.2.0.
//
// Control flow: apply() copies the state, performs the action as a JOB, then settle() runs
// game state checks (CR 1.8), resolves the bag (CR 7.7) and pending jobs until a player must
// act. A job that needs a decision throws an Ask; the job's partial work is discarded (the
// state is restored from a snapshot) and the question parks in s.ask. Answering appends to
// job.answers and re-runs the job from the same pre-job state (PLAN D10).
(function () {
  const LC = globalThis.LC;
  const { Illegal } = LC;

  // ---------------------------------------------------------------- card definitions
  const def = (s, iid) => LC.CARDS[s.cards[iid].id];
  LC.def = function (iidOrId, s) {
    if (s && s.cards[iidOrId]) return LC.CARDS[s.cards[iidOrId].id];
    return LC.CARDS[iidOrId];
  };
  LC.fullName = (d) => (d.version ? `${d.name} - ${d.version}` : d.name);
  const ABIL = (id) => (LC.ABIL && LC.ABIL[id]) || EMPTY;
  const EMPTY = Object.freeze({});

  const isType = (d, t) => d.type.includes(t);
  LC.isCharacter = (d) => isType(d, 'Character');
  LC.isItem = (d) => isType(d, 'Item');
  LC.isAction = (d) => isType(d, 'Action');
  LC.isSong = (d) => isType(d, 'Song');
  LC.isLocation = (d) => isType(d, 'Location');

  // Printed keywords with their numbers (CR 8). Lorcast's keywords array misses some (Alert),
  // so keyword lines are read from the text: a keyword is a line that STARTS with its name.
  const KW_CACHE = {};
  LC.printedKeywords = function (d) {
    if (KW_CACHE[d.id]) return KW_CACHE[d.id];
    const kw = {};
    const lines = (d.text || '').split('\n');
    for (const line of lines) {
      let m;
      if ((m = line.match(/^(Challenger|Resist) \+(\d+)/))) kw[m[1]] = (kw[m[1]] || 0) + +m[2];
      else if ((m = line.match(/^Sing Together (\d+)/))) kw.SingTogether = +m[1];
      else if ((m = line.match(/^(Singer|Boost|Shift) (\d+)/))) kw[m[1]] = +m[2];
      else if ((m = line.match(/^(Alert|Bodyguard|Evasive|Reckless|Rush|Support|Vanish|Ward)\b/))) kw[m[1]] = true;
    }
    // Some lines carry two keywords run together ("Rush (...) WEAKEN THE CAULDRON ...").
    for (const k of d.keywords || []) {
      const key = k === 'Sing Together' ? 'SingTogether' : k;
      if (kw[key] === undefined && ['Alert', 'Bodyguard', 'Evasive', 'Reckless', 'Rush', 'Support', 'Vanish', 'Ward'].includes(k)) kw[key] = true;
    }
    if (kw.Shift !== undefined) {
      const m = (d.text || '').match(/Shift \d+[^\n]*?named ([^.)]+?)[.)]/);
      kw.ShiftNames = m ? m[1].split(/ or /).map((x) => x.trim()) : [d.name];
    }
    return (KW_CACHE[d.id] = kw);
  };

  // ---------------------------------------------------------------- logging
  function log(s, who, type, data = {}) {
    const e = { n: s.logN++, turn: s.turn, who, type, ...data };
    if (s._via != null && e.via === undefined) e.via = s._via;
    s.log.push(e);
    return e;
  }
  LC.log = log;

  // ---------------------------------------------------------------- new game
  LC.newGame = function (opts) {
    const seed = opts.seed == null ? (Date.now() & 0x7fffffff) : (typeof opts.seed === 'number' ? opts.seed : LC.hashSeed(opts.seed));
    const s = {
      seed, rng: seed | 0, turn: 0, active: 0, first: 0, phase: 'mulligan',
      winner: null, endReason: null,
      players: [], cards: {}, nextIid: 1,
      ask: null, pendingJob: null, pendingSnap: null, queue: [], bag: [], bagSeq: 1, bagResolver: null,
      effects: [], ti: null, log: [], logN: 0, revealed: { 0: [], 1: [] }, _via: null,
      names: opts.names || ['Player 1', 'Player 2'],
    };
    for (let p = 0; p < 2; p++) {
      const deck = resolveDeck(opts.decks[p]);
      const P = { name: s.names[p], deckName: deck.name, deckId: deck.id || null, deck: [], hand: [], ink: [], discard: [], play: [], lore: 0, inkedThisTurn: false, costMods: [] };
      s.players.push(P);
      for (const [id, qty] of deck.cards) {
        if (!LC.CARDS[id]) throw new Error(`unknown card id ${id}`);
        for (let i = 0; i < qty; i++) {
          const iid = 'c' + s.nextIid++;
          s.cards[iid] = { iid, id, owner: p, zone: 'deck', exerted: false, damage: 0, under: [], facedown: true, enteredTurn: null, dry: false, mods: [] };
          P.deck.push(iid);
        }
      }
      LC.shuffleInPlace(s, P.deck);
    }
    s.first = opts.first === 0 || opts.first === 1 ? opts.first : LC.rngInt(s, 2);
    s.active = s.first;
    s.ti = freshTurnInfo();
    log(s, s.first, 'start', { first: s.first });
    // CR 2.2.1.4 each player draws 7; CR 2.2.2 alter hands, starting player first.
    for (let p = 0; p < 2; p++) for (let i = 0; i < 7; i++) drawCard(s, p, true);
    s.queue.push({ k: 'mulligan', p: s.first, answers: [] }, { k: 'mulligan', p: 1 - s.first, answers: [] }, { k: 'beginTurn', p: s.first, answers: [] });
    settle(s);
    return s;
  };

  function resolveDeck(d) {
    if (typeof d === 'string') {
      const found = LC.DECKS.find((x) => x.id === d);
      if (!found) throw new Error(`unknown deck ${d}`);
      return found;
    }
    return d;
  }

  function freshTurnInfo() {
    return { challenges: 0, played: [0, 0], toDiscard: [0, 0], banishedNames: [], challenged: [false, false], once: {}, boosted: {} };
  }

  // ---------------------------------------------------------------- characteristics (one door)
  // chars() is the only reader of strength/willpower/lore/keywords/flags. Static abilities
  // ("auras", CR 6.4) of every card in play are applied, then the card's own temporary mods,
  // then global effects. Auras must read definitions and plain state, never chars(), so
  // evaluation order is fixed and cannot recurse (KB LESSONS §1.2).
  LC.chars = function (s, iid) {
    const c = s.cards[iid];
    const d = LC.CARDS[c.id];
    const kw = { ...LC.printedKeywords(d) };
    const r = {
      iid, id: c.id, owner: c.owner, str: d.strength || 0, wp: d.willpower || 0, lore: d.lore || 0, cost: d.cost,
      damage: c.damage, exerted: c.exerted, dry: !!c.dry, drying: c.zone === 'play' && LC.isCharacter(d) && !c.dry,
      kw, flags: {}, classifications: d.classifications.slice(),
      type: LC.isCharacter(d) ? 'character' : LC.isItem(d) ? 'item' : LC.isLocation(d) ? 'location' : 'action',
      song: LC.isSong(d), activated: [], canQuest: false, canChallenge: false, singCost: d.cost,
    };
    const a = ABIL(c.id);
    if (a.activated) a.activated.forEach((ab, i) => r.activated.push({ src: c.id, i, ab }));
    if (c.zone === 'play') {
      for (const p of [0, 1]) for (const x of s.players[p].play) {
        const ax = ABIL(s.cards[x].id);
        if (ax.auras) for (const fn of ax.auras) fn(s, x, iid, r);
      }
      for (const m of c.mods) if (m.on !== false) applyMod(r, m);
      for (const e of s.effects) if (e.mod && e.on !== false && e.applies && LC.EFFECT_FILTERS[e.applies](s, e, iid)) applyMod(r, e.mod);
      // Late auras read the target's finished keywords (e.g. "your other characters with
      // Evasive gain ..."); they run last so they can't recurse.
      for (const p of [0, 1]) for (const x of s.players[p].play) {
        const ax = ABIL(s.cards[x].id);
        if (ax.lateAuras) for (const fn of ax.lateAuras) fn(s, x, iid, r);
      }
    }
    if (r.kw.Singer) r.singCost = r.kw.Singer;
    if (r.flags.singBonus) r.singCost += r.flags.singBonus;
    r.lore = Math.max(0, r.lore);
    r.str = r.str; // may be negative: CR 4.6.6.1 treats negative as 0 for challenge damage only
    if (r.type === 'character' && c.zone === 'play') {
      r.canQuest = !r.kw.Reckless && !r.flags.cantQuest;
      r.canChallenge = !r.flags.cantChallenge;
    }
    r.activated = r.activated.map(({ src, i, ab }) => describeActivated(s, iid, src, i, ab, r));
    return r;
  };

  function applyMod(r, m) {
    if (m.str) r.str += m.str;
    if (m.wp) r.wp += m.wp;
    if (m.lore) r.lore += m.lore;
    if (m.kw) for (const [k, v] of Object.entries(m.kw)) {
      if (typeof v === 'number' && (k === 'Challenger' || k === 'Resist')) r.kw[k] = (r.kw[k] || 0) + v; // CR 8.1.2 +N stacks
      else if (v === false) delete r.kw[k];
      else if (r.kw[k] === undefined) r.kw[k] = v;
    }
    if (m.flags) Object.assign(r.flags, m.flags);
    if (m.grant) r.activated.push({ src: m.grant.cardId, i: m.grant.i, ab: ABIL(m.grant.cardId).activated[m.grant.i] });
  }
  LC.applyMod = applyMod;

  // Filters for global effects (s.effects[].applies), named so state stays plain data.
  LC.EFFECT_FILTERS = {
    allCharacters: (s, e, iid) => LC.isCharacter(def(s, iid)),
    playerCharacters: (s, e, iid) => s.cards[iid].owner === e.p && LC.isCharacter(def(s, iid)),
    opposingCharacters: (s, e, iid) => s.cards[iid].owner !== e.p && LC.isCharacter(def(s, iid)),
  };

  function describeActivated(s, iid, srcId, i, ab, r) {
    const c = s.cards[iid];
    let why = null;
    const mine = c.owner === s.active;
    if (s.phase !== 'main' || s.ask) why = 'Not now.';
    else if (!mine) why = "It isn't your turn.";
    else if (ab.cost.exert && c.exerted) why = 'Already exerted.';
    else if (ab.cost.exert && r.type === 'character' && !c.dry) why = 'This character is still drying.'; // CR 4.4.2
    else if (ab.cost.ink && readyInk(s, c.owner) < ab.cost.ink) why = `Needs ${ab.cost.ink} ink, you have ${readyInk(s, c.owner)} ready.`;
    else if (ab.cost.discard && s.players[c.owner].hand.length < ab.cost.discard) why = 'You have no card to discard.';
    else if (ab.once && s.ti.once[`act:${iid}:${srcId}:${i}`]) why = 'Already used this turn.';
    else if (ab.can && !ab.can(s, iid)) why = ab.whyNot ? ab.whyNot(s, iid) : 'Its condition is not met.';
    return { name: ab.name, text: ab.text || '', costText: costText(ab.cost), usable: !why, why, src: srcId, i };
  }
  function costText(cost) {
    const parts = [];
    if (cost.exert) parts.push('exert');
    if (cost.ink) parts.push(`${cost.ink} ink`);
    if (cost.discard) parts.push(`discard ${cost.discard}`);
    if (cost.banishSelf) parts.push('banish this');
    return parts.join(', ');
  }

  // ---------------------------------------------------------------- small readers
  const readyInk = (s, p) => s.players[p].ink.reduce((n, i) => n + (s.cards[i].exerted ? 0 : 1), 0);
  LC.readyInk = readyInk;
  LC.inPlay = (s, p) => (p == null ? [...s.players[0].play, ...s.players[1].play] : s.players[p].play.slice());
  LC.characters = (s, p) => LC.inPlay(s, p).filter((i) => LC.isCharacter(def(s, i)));
  LC.items = (s, p) => LC.inPlay(s, p).filter((i) => LC.isItem(def(s, i)));
  LC.namesMatch = (d, name) => d.name === name || d.name.split(/ and | & /).includes(name);
  LC.hasNamed = (s, p, name, exceptIid) => LC.characters(s, p).some((i) => i !== exceptIid && LC.namesMatch(def(s, i), name));

  // ---------------------------------------------------------------- zone moves (one door)
  function removeFromZone(s, iid) {
    const c = s.cards[iid];
    const P = s.players[c.owner];
    const zoneArr = { deck: P.deck, hand: P.hand, ink: P.ink, play: P.play, discard: P.discard }[c.zone];
    if (zoneArr) {
      const k = zoneArr.indexOf(iid);
      if (k >= 0) zoneArr.splice(k, 1);
    } else if (c.zone === 'under') {
      for (const x of Object.values(s.cards)) { const k = x.under.indexOf(iid); if (k >= 0) x.under.splice(k, 1); }
    }
  }
  // move(): every zone change goes through here. Leaving play strips state; cards under a
  // card leaving play go to their owners' discards (CR 8.10.6 / 8.4).
  function move(s, iid, to, opt = {}) {
    const c = s.cards[iid];
    const from = c.zone;
    removeFromZone(s, iid);
    if (from === 'play' && to !== 'play') {
      for (const u of c.under.slice()) { removeFromZone(s, u); placeIn(s, u, 'discard', {}); }
      c.under = [];
      c.exerted = false; c.damage = 0; c.mods = []; c.dry = false; c.enteredTurn = null; c.lastHit = null;
    }
    placeIn(s, iid, to, opt);
    return from;
  }
  function placeIn(s, iid, to, opt) {
    const c = s.cards[iid];
    const P = s.players[c.owner];
    c.zone = to;
    c.facedown = to === 'deck' || to === 'ink' || !!opt.facedown;
    if (to === 'deck') { if (opt.pos === 'top') P.deck.unshift(iid); else P.deck.push(iid); }
    else if (to === 'hand') P.hand.push(iid);
    else if (to === 'ink') { P.ink.push(iid); c.exerted = !!opt.exerted; }
    else if (to === 'discard') { P.discard.unshift(iid); s.ti.toDiscard[c.owner]++; }
    else if (to === 'play') P.play.push(iid);
    else if (to === 'under') { s.cards[opt.under].under.push(iid); }
  }
  LC.move = move;

  function drawCard(s, p, silent) {
    const P = s.players[p];
    if (!P.deck.length) return null; // drawing from an empty deck does nothing; CR 1.8.1.2 checks at end of turn
    const iid = P.deck[0];
    move(s, iid, 'hand');
    if (!silent) log(s, p, 'draw', { iid });
    return iid;
  }
  LC.drawCard = drawCard;

  // ---------------------------------------------------------------- damage, banish, lore (doors)
  // CR 1.9.4 base damage -> modifiers (Resist, CR 8.8) -> place counters.
  function dealDamage(s, target, amount, o = {}) {
    const c = s.cards[target];
    if (c.zone !== 'play') return 0;
    const ch = LC.chars(s, target);
    let n = Math.max(0, amount);
    if (!o.put && !o.noResist && ch.kw.Resist) n = Math.max(0, n - ch.kw.Resist);
    if (o.challenge && ch.flags.noChallengeDamage) n = 0;
    if (n > 0) {
      c.damage += n;
      if (o.from != null) c.lastHit = { by: o.from, challenge: !!o.challenge, turn: s.turn };
    }
    log(s, o.from != null ? s.cards[o.from].owner : s.active, 'damage', { iid: target, amount: n, from: o.from ?? null, challenge: !!o.challenge, put: !!o.put });
    if (n > 0) emit(s, { type: 'damaged', iid: target, amount: n, from: o.from ?? null, challenge: !!o.challenge });
    return n;
  }
  LC.dealDamage = dealDamage;

  function removeDamage(s, target, amount) {
    const c = s.cards[target];
    const n = Math.min(c.damage, amount === 'all' ? c.damage : amount);
    c.damage -= n;
    if (n > 0) log(s, c.owner, 'heal', { iid: target, amount: n });
    return n;
  }
  LC.removeDamage = removeDamage;

  // leavePlay(): banish / return / shuffle all route here so "leaves play" triggers fire once.
  function leavePlay(s, iid, to, opt = {}) {
    const c = s.cards[iid];
    if (c.zone !== 'play') return false;
    const d = def(s, iid);
    move(s, iid, to, opt);
    emit(s, { type: 'leavesPlay', iid, to, by: opt.by ?? null }, [iid]);
    if (to === 'discard' && opt.banished) {
      if (LC.isCharacter(d)) s.ti.banishedNames.push(d.name);
      emit(s, { type: 'banished', iid, by: opt.by ?? null, challenge: !!opt.challenge }, [iid]);
    }
    return true;
  }
  function banish(s, iid, o = {}) {
    if (s.cards[iid].zone !== 'play') return false;
    log(s, s.cards[iid].owner, 'banish', { iid, by: o.by ?? null });
    return leavePlay(s, iid, 'discard', { ...o, banished: true });
  }
  LC.banish = banish;
  LC.leavePlay = leavePlay;

  function gainLore(s, p, n) {
    if (n <= 0) return 0;
    s.players[p].lore += n;
    log(s, p, 'lore', { amount: n, total: s.players[p].lore });
    return n;
  }
  function loseLore(s, p, n) {
    const k = Math.min(n, s.players[p].lore); // CR 1.11.1 never below 0
    s.players[p].lore -= k;
    if (k > 0) log(s, p, 'lore', { amount: -k, total: s.players[p].lore });
    return k;
  }
  LC.gainLore = gainLore;
  LC.loseLore = loseLore;

  function exert(s, iid, cause) {
    const c = s.cards[iid];
    if (c.exerted) return false;
    c.exerted = true;
    if (cause === 'effect') log(s, c.owner, 'exert', { iid });
    if (c.zone === 'play' && LC.isCharacter(def(s, iid))) emit(s, { type: 'exerts', iid, cause });
    return true;
  }
  function ready(s, iid, cause) {
    const c = s.cards[iid];
    if (!c.exerted) return false;
    c.exerted = false;
    if (cause === 'effect') log(s, c.owner, 'ready', { iid });
    return true;
  }
  LC.exert = exert;
  LC.ready = ready;

  // ---------------------------------------------------------------- triggers and the bag (CR 7.7)
  // emit(): every card in play (plus `extra` cards that just left play) whose ability listens
  // for this event and whose `when` filter passes adds an entry to the bag.
  function emit(s, ev, extra = []) {
    const seen = new Set();
    const scan = [...s.players[s.active].play, ...s.players[1 - s.active].play, ...extra];
    for (const iid of scan) {
      if (seen.has(iid)) continue;
      seen.add(iid);
      const c = s.cards[iid];
      const a = ABIL(c.id);
      if (a.triggers) a.triggers.forEach((t, ti) => {
        const ons = Array.isArray(t.on) ? t.on : [t.on];
        if (!ons.includes(ev.type)) return;
        if (t.when && !t.when(s, iid, ev)) return;
        addToBag(s, c.owner, iid, c.id, ti, t.name, ev);
      });
      // Keyword triggers the engine owns: Support (CR 8.13), Vanish (CR 8.14).
      if (ev.type === 'quest' && ev.iid === iid && c.zone === 'play' && LC.chars(s, iid).kw.Support) addToBag(s, c.owner, iid, c.id, 'support', 'Support', ev);
    }
  }
  LC.emit = emit;

  function addToBag(s, owner, src, cardId, ti, name, ev) {
    s.bag.push({ id: s.bagSeq++, owner, src, cardId, ti, name, ev });
  }

  function resolveBagStep(s) {
    // CR 7.7.4: the active player resolves all of theirs (including new ones they add), then the
    // bag passes; a player chooses the order of their own triggers.
    let p = s.bagResolver == null ? s.active : s.bagResolver;
    let mine = s.bag.filter((e) => e.owner === p);
    if (!mine.length) { p = 1 - p; mine = s.bag.filter((e) => e.owner === p); }
    s.bagResolver = p;
    const distinct = new Set(mine.map((e) => `${e.cardId}|${e.ti}|${JSON.stringify(e.ev)}`));
    if (mine.length > 1 && distinct.size > 1) {
      s.ask = {
        kind: 'bag', who: p, src: null,
        prompt: 'Several of your triggered abilities are waiting. Choose which resolves first.',
        options: mine.map((e) => ({ id: e.id, src: e.src, name: e.name })),
      };
      s.pendingSnap = LC.clone({ ...s, ask: null });
      s.pendingJob = { k: 'bagPick', answers: [] };
      return;
    }
    runJob(s, { k: 'trigger', entryId: mine[0].id, answers: [] });
  }

  // ---------------------------------------------------------------- game state check (CR 1.8)
  function gsc(s) {
    for (let guard = 0; guard < 50; guard++) {
      if (s.winner !== null) return;
      const order = [s.active, 1 - s.active];
      for (const p of order) if (s.players[p].lore >= 20) return win(s, p, 'lore'); // CR 1.8.1.1
      const doomed = LC.inPlay(s).filter((i) => {
        const d = def(s, i);
        if (!LC.isCharacter(d) && !LC.isLocation(d)) return false;
        return s.cards[i].damage >= LC.chars(s, i).wp; // CR 1.8.1.4
      });
      if (!doomed.length) return;
      for (const i of doomed) {
        const hit = s.cards[i].lastHit;
        const by = hit && hit.turn === s.turn ? hit.by : null;
        const inChallenge = !!(hit && hit.challenge && hit.turn === s.turn);
        banish(s, i, { by, challenge: inChallenge });
        if (by != null && inChallenge) emit(s, { type: 'banishedInChallenge', iid: i, by }, [by]);
      }
    }
  }
  function win(s, p, reason) {
    if (s.winner !== null) return;
    s.winner = p; s.endReason = reason; s.phase = 'over'; s.ask = null; s.pendingJob = null; s.pendingSnap = null;
    log(s, p, 'win', { reason });
  }

  // ---------------------------------------------------------------- settle loop
  function settle(s) {
    for (let guard = 0; guard < 5000; guard++) {
      if (s.winner !== null) return;
      if (s.ask) return;
      gsc(s);
      if (s.winner !== null) return;
      if (s.bag.length) { resolveBagStep(s); continue; }
      s.bagResolver = null;
      if (s.queue.length) { runJob(s, s.queue.shift()); continue; }
      return;
    }
    throw new Error('settle: loop guard tripped');
  }

  function runJob(s, job) {
    const snap = LC.clone(s);
    try {
      execJob(s, job);
    } catch (e) {
      if (!e || !e.__ask) throw e;
      // Keep the partly-resolved state visible (costs paid, card played) while asking; the
      // answer restores the pre-job snapshot and re-runs the job with all answers so far.
      s.ask = e.__ask;
      s.pendingJob = job;
      s.pendingSnap = snap;
    } finally {
      s._via = null;
    }
  }

  // ---------------------------------------------------------------- jobs
  function execJob(s, job) {
    const x = LC.makeCtx(s, job);
    switch (job.k) {
      case 'mulligan': return jobMulligan(s, job, x);
      case 'beginTurn': return jobBeginTurn(s, job, x);
      case 'drawStep': return jobDrawStep(s, job);
      case 'endTurn': return jobEndTurn(s, job);
      case 'passTurn': return jobPassTurn(s, job);
      case 'trigger': return jobTrigger(s, job, x);
      case 'bagPick': {
        const id = job.answers[0];
        return runJobInline(s, { k: 'trigger', entryId: id, answers: job.answers.slice(1) }, x);
      }
      case 'play': return jobPlay(s, job, x);
      case 'quest': return jobQuest(s, job, x);
      case 'challenge': return jobChallenge(s, job, x);
      case 'challengeDamage': return jobChallengeDamage(s, job);
      case 'activate': return jobActivate(s, job, x);
      case 'boost': return jobBoost(s, job);
      case 'ink': return jobInk(s, job);
      default: throw new Error(`unknown job ${job.k}`);
    }
  }
  // A bag pick answer leads straight into the trigger it picked, inside the same job, so the
  // trigger's own questions append to the same answer list.
  function runJobInline(s, job, x) { x.job = job; return jobTrigger(s, job, x); }

  function jobMulligan(s, job, x) {
    // CR 2.2.2: choose any number of cards, put them on the bottom, draw that many, shuffle.
    const P = s.players[job.p];
    const pick = x.ask({
      kind: 'mulligan', who: job.p, src: null, from: P.hand.slice(), seen: P.hand.slice(), min: 0, max: P.hand.length,
      prompt: 'Alter your opening hand: choose any cards to put on the bottom of your deck and redraw.',
    });
    for (const i of pick) move(s, i, 'deck', { pos: 'bottom' });
    for (let k = 0; k < pick.length; k++) drawCard(s, job.p, true);
    if (pick.length) LC.shuffleInPlace(s, P.deck);
    log(s, job.p, 'mulligan', { count: pick.length });
  }

  function jobBeginTurn(s, job, x) {
    const p = job.p;
    s.phase = 'main';
    s.active = p;
    s.turn++;
    s.ti = freshTurnInfo();
    for (const P of s.players) P.inkedThisTurn = false;
    log(s, p, 'turn', {});
    // Durations that start or end at the start of p's turn (CR 3.2.1.2-3).
    tickDurations(s, 'startOf', p);
    // CR 3.2.1.1 Ready step: ready all cards in play and in the inkwell (unless something says
    // they can't ready).
    for (const i of s.players[p].play) {
      const ch = LC.chars(s, i);
      if (ch.flags.cantReady) continue;
      s.cards[i].exerted = false;
    }
    for (const i of s.players[p].ink) s.cards[i].exerted = false;
    tickDurations(s, 'afterReady', p);
    // CR 3.2.2.1 Set step: characters are no longer drying.
    for (const i of s.players[p].play) s.cards[i].dry = true;
    emit(s, { type: 'turnStart', p });
    s.queue.unshift({ k: 'drawStep', p, answers: [] });
  }

  function jobDrawStep(s, job) {
    // CR 3.2.3.1: the starting player skips the draw on the first turn of the game.
    if (!(s.turn === 1 && job.p === s.first)) drawCard(s, job.p);
  }

  function jobEndTurn(s, job) {
    // CR 3.4.1.1 end-of-turn triggers resolve from the bag first.
    emit(s, { type: 'turnEnd', p: s.active });
    s.queue.unshift({ k: 'passTurn', answers: [] });
  }

  function jobPassTurn(s) {
    const p = s.active;
    // CR 3.4.1.2 effects with a "this turn" duration end.
    tickDurations(s, 'endOf', p);
    s.players[p].costMods = s.players[p].costMods.filter((m) => m.until !== 'eot');
    s.revealed = { 0: [], 1: [] };
    // CR 1.8.1.2: a player whose turn ends with no cards in their deck loses.
    if (!s.players[p].deck.length) return win(s, 1 - p, 'deckout');
    s.queue.push({ k: 'beginTurn', p: 1 - p, answers: [] });
  }

  // Duration bookkeeping. A mod/effect carries `end: {at, p}` and optionally `start: {at, p}`:
  //   at 'eot'      - ends at the end of the current turn (whoever's)
  //   at 'startOf'  - "until the start of p's next turn"
  //   at 'endOf'    - ends at the end of p's turn (used with start for "during their next turn")
  //   at 'afterReady' - "can't ready at the start of their next turn"
  function tickDurations(s, phase, p) {
    const keep = (m) => {
      if (m.start && m.start.at === phase && m.start.p === p) { m.on = true; delete m.start; }
      if (!m.end) return true;
      if (phase === 'startOf' && m.end.at === 'startOf' && m.end.p === p) return false;
      if (phase === 'afterReady' && m.end.at === 'afterReady' && m.end.p === p) return false;
      if (phase === 'endOf' && m.end.at === 'eot') return false;
      if (phase === 'endOf' && m.end.at === 'endOf' && m.end.p === p && m.on !== false) return false;
      return true;
    };
    for (const c of Object.values(s.cards)) if (c.mods.length) c.mods = c.mods.filter(keep);
    s.effects = s.effects.filter(keep);
  }
  LC.tickDurations = tickDurations;

  function jobInk(s, job) {
    const P = s.players[s.active];
    move(s, job.iid, 'ink');
    P.inkedThisTurn = true;
    log(s, s.active, 'ink', { iid: job.iid });
  }

  // ---------------------------------------------------------------- costs
  // costToPlay(): ink to pay for a normal play, after payment modifiers (CR 4.3.2.3).
  LC.costToPlay = function (s, iid, base) {
    const c = s.cards[iid];
    const d = def(s, iid);
    let cost = base == null ? d.cost : base;
    cost += paymentDelta(s, c.owner, iid, base != null);
    return Math.max(0, cost);
  };
  function paymentDelta(s, p, iid, alternate) {
    const d = def(s, iid);
    let delta = 0;
    const a = ABIL(d.id);
    if (a.selfCost && !alternate) delta += a.selfCost(s, iid, p);
    for (const m of s.players[p].costMods) if (costModApplies(s, m, d)) delta -= m.amount;
    for (const x of s.players[p].play) {
      const ax = ABIL(s.cards[x].id);
      if (ax.costAura) delta += ax.costAura(s, x, iid, p) || 0;
    }
    return delta;
  }
  function costModApplies(s, m, d) {
    if (m.type === 'character' && !LC.isCharacter(d)) return false;
    if (m.type === 'actionOrItem' && !(LC.isAction(d) || LC.isItem(d))) return false;
    if (m.classes && !m.classes.some((k) => d.classifications.includes(k))) return false;
    return true;
  }
  // CR 4.3.6: "next [type]" modifiers are used up by the next matching card, however paid.
  function consumeCostMods(s, p, d) {
    const P = s.players[p];
    P.costMods = P.costMods.filter((m) => !(m.next && costModApplies(s, m, d)));
  }
  LC.consumeCostMods = consumeCostMods;
  function payInk(s, p, n) {
    if (readyInk(s, p) < n) throw new Illegal(`needs ${n} ink`);
    let k = n;
    for (const i of s.players[p].ink) { if (!k) break; if (!s.cards[i].exerted) { s.cards[i].exerted = true; k--; } }
  }
  LC.payInk = payInk;

  // ---------------------------------------------------------------- play a card (CR 4.3)
  function canSing(s, singer, song) {
    const c = s.cards[singer];
    if (c.zone !== 'play' || c.exerted || !c.dry) return false; // exerting needs a dry character (CR 5.1.1.11)
    const ch = LC.chars(s, singer);
    if (ch.type !== 'character' || ch.flags.cantSing) return false;
    return ch.singCost >= def(s, song).cost;
  }
  LC.canSing = canSing;

  function shiftTargets(s, iid) {
    const kw = LC.printedKeywords(def(s, iid));
    if (kw.Shift === undefined) return [];
    const p = s.cards[iid].owner;
    return LC.characters(s, p).filter((t) => kw.ShiftNames.some((n) => LC.namesMatch(def(s, t), n)));
  }
  LC.shiftTargets = shiftTargets;

  function jobPlay(s, job, x) {
    const { iid, pay } = job;
    const p = s.cards[iid].owner;
    const d = def(s, iid);
    let paidSingers = [];
    // CR 4.3.2.4 pay the total cost.
    if (pay === 'ink') payInk(s, p, LC.costToPlay(s, iid));
    else if (pay === 'shift') payInk(s, p, LC.costToPlay(s, iid, LC.printedKeywords(d).Shift));
    else if (pay === 'shiftAlt') ABIL(d.id).altShift.pay(x, iid);
    else if (pay === 'sing') { paidSingers = [job.singer]; exert(s, job.singer, 'sing'); }
    else if (pay === 'singTogether') {
      const n = LC.printedKeywords(d).SingTogether;
      const pool = LC.characters(s, p).filter((c) => !s.cards[c].exerted && s.cards[c].dry);
      paidSingers = x.ask({
        kind: 'cards', who: p, src: iid, from: pool, seen: pool, min: 1, max: pool.length, sumCostMin: n,
        prompt: `Sing Together ${n}: choose characters with total cost ${n} or more to exert and sing this song.`,
      });
      for (const c of paidSingers) exert(s, c, 'sing');
    } else if (pay === 'free') { /* alternate cost "for free" (CR 1.5.5.3) */ }
    playCard(s, x, iid, { pay, onto: job.onto, singers: paidSingers, from: job.from || 'hand' });
  }

  // playCard(): the shared tail of every play (turn action or "play ... for free" effects).
  function playCard(s, x, iid, o) {
    const c = s.cards[iid];
    const p = c.owner;
    const d = def(s, iid);
    consumeCostMods(s, p, d);
    s.ti.played[p]++;
    log(s, p, 'play', { iid, pay: o.pay, onto: o.onto ?? null, singers: o.singers || [], cost: d.cost, from: o.from });
    if (LC.isAction(d)) {
      // CR 4.3.3.2: the action resolves immediately, then goes to the discard.
      removeFromZone(s, iid);
      c.zone = 'play'; c.facedown = false; // briefly in play while resolving (not in P.play)
      const prevVia = s._via;
      s._via = iid;
      const a = ABIL(d.id);
      if (!a.action) throw new Error(`no action script for ${d.id}`);
      x.withSource(iid, () => a.action(x));
      s._via = prevVia;
      placeIn(s, iid, 'discard', {});
      emit(s, { type: 'played', iid, p, song: LC.isSong(d), singers: o.singers || [], kind: 'action' });
      for (const sg of o.singers || []) emit(s, { type: 'sings', iid: sg, song: iid });
      return;
    }
    if (o.pay === 'shift' || o.pay === 'shiftAlt') {
      // CR 8.10: put on top of the base; inherit exerted/damage/dry state (8.10.2, 8.10.4).
      const base = s.cards[o.onto];
      removeFromZone(s, iid);
      const P = s.players[p];
      const k = P.play.indexOf(o.onto);
      P.play.splice(k, 1, iid);
      c.zone = 'play'; c.facedown = false;
      c.exerted = base.exerted; c.damage = base.damage; c.dry = base.dry; c.enteredTurn = base.enteredTurn;
      c.under = [...base.under, o.onto];
      base.zone = 'under'; base.under = []; base.exerted = false; base.damage = 0; base.mods = []; base.facedown = false;
      c.mods = [];
      c.shifted = true;
    } else {
      move(s, iid, 'play');
      c.enteredTurn = s.turn;
      c.dry = false;
      c.exerted = false;
      c.shifted = false;
      // CR 8.3.2 Bodyguard: may enter play exerted (ask; never assume).
      const a = ABIL(d.id);
      const mayExerted = LC.printedKeywords(d).Bodyguard || a.mayEnterExerted;
      if (mayExerted && LC.isCharacter(d)) {
        const yes = x.ask({ kind: 'yesno', who: p, src: iid, prompt: `Play ${LC.fullName(d)} exerted?`, yes: 'Enter exerted', no: 'Enter ready' });
        if (yes) c.exerted = true;
      }
    }
    emit(s, { type: 'played', iid, p, kind: LC.isCharacter(d) ? 'character' : 'item', shifted: !!c.shifted });
  }
  LC.playCard = playCard;

  // ---------------------------------------------------------------- quest (CR 4.5)
  function jobQuest(s, job) {
    const iid = job.iid;
    const p = s.cards[iid].owner;
    exert(s, iid, 'quest');
    const lore = LC.chars(s, iid).lore;
    log(s, p, 'quest', { iid, lore });
    gainLore(s, p, lore);
    emit(s, { type: 'quest', iid, p });
  }

  // ---------------------------------------------------------------- challenge (CR 4.6)
  // The one challenge-legality predicate: legalActions and the AI both use it.
  LC.canChallengeTarget = function (s, a, t) {
    const ca = s.cards[a], ct = s.cards[t];
    if (ca.zone !== 'play' || ct.zone !== 'play' || ca.owner === ct.owner) return false;
    const da = def(s, a), dt = def(s, t);
    if (!LC.isCharacter(da)) return false;
    const A = LC.chars(s, a);
    if (!A.canChallenge || ca.exerted) return false;
    if (!ca.dry && !A.kw.Rush) return false; // CR 4.6.4.1 / 8.9
    if (globalNoChallenge(s, ca.owner)) return false;
    if (!LC.isCharacter(dt) && !LC.isLocation(dt)) return false;
    const T = LC.chars(s, t);
    if (T.flags.cantBeChallenged) return false;
    if (LC.isCharacter(dt) && !ct.exerted && !A.flags.canChallengeReady) return false; // CR 4.6.4.2
    if (T.kw.Evasive && !A.kw.Evasive && !A.kw.Alert) return false; // CR 8.6, 8.2
    // CR 8.3.3 Bodyguard: must choose a Bodyguard if able.
    if (!T.kw.Bodyguard && LC.isCharacter(dt)) {
      const guards = LC.characters(s, ct.owner).filter((g) => g !== t && LC.chars(s, g).kw.Bodyguard);
      if (guards.some((g) => challengeableIgnoringBodyguard(s, a, g))) return false;
    }
    return true;
  };
  function challengeableIgnoringBodyguard(s, a, t) {
    const ct = s.cards[t];
    const A = LC.chars(s, a), T = LC.chars(s, t);
    if (T.flags.cantBeChallenged) return false;
    if (!ct.exerted && !A.flags.canChallengeReady) return false;
    if (T.kw.Evasive && !A.kw.Evasive && !A.kw.Alert) return false;
    return true;
  }
  function globalNoChallenge(s, p) {
    if (s.effects.some((e) => e.kind === 'noChallenge' && e.on !== false)) return true;
    // "Each turn, only one character can challenge." (static on a card in play)
    const limit = LC.inPlay(s).some((i) => ABIL(s.cards[i].id).oneChallengePerTurn);
    return limit && s.ti.challenges >= 1;
  }

  function jobChallenge(s, job) {
    const { iid: a, target: t } = job;
    const p = s.cards[a].owner;
    exert(s, a, 'challenge'); // CR 4.6.4.4
    s.ti.challenges++;
    s.ti.challenged[p] = true;
    log(s, p, 'challenge', { iid: a, target: t });
    emit(s, { type: 'challenges', iid: a, target: t, p }); // CR 4.6.5
    s.queue.unshift({ k: 'challengeDamage', a, t, answers: [] });
  }

  function jobChallengeDamage(s, job) {
    const { a, t } = job;
    if (s.cards[a].zone !== 'play' || s.cards[t].zone !== 'play') return; // CR 4.6.9
    const A = LC.chars(s, a), T = LC.chars(s, t);
    // CR 4.6.6.1 damage = Strength (+Challenger while challenging, 8.5); negative counts as 0.
    const atk = Math.max(0, (A.flags.dealWithWillpower ? A.wp : A.str) + (A.kw.Challenger || 0));
    const dfn = LC.isCharacter(def(s, t)) ? Math.max(0, T.flags.dealWithWillpower ? T.wp : T.str) : 0;
    // CR 4.6.6.2 simultaneous.
    const ignoreA = A.flags.noDamageFromClass && T.classifications.includes(A.flags.noDamageFromClass);
    dealDamage(s, t, atk, { from: a, challenge: true });
    if (!ignoreA) dealDamage(s, a, dfn, { from: t, challenge: true });
    else log(s, s.cards[a].owner, 'damage', { iid: a, amount: 0, from: t, challenge: true, put: false });
  }

  // ---------------------------------------------------------------- activated abilities, boost
  function jobActivate(s, job, x) {
    const { iid, idx } = job;
    const ch = LC.chars(s, iid);
    const info = ch.activated[idx];
    const ab = ABIL(info.src).activated[info.i];
    const c = s.cards[iid];
    const p = c.owner;
    log(s, p, 'ability', { iid, name: ab.name });
    if (ab.once) s.ti.once[`act:${iid}:${info.src}:${info.i}`] = true;
    // CR 4.4.3.4 pay costs (exert, ink, discard, banish self).
    if (ab.cost.exert) exert(s, iid, 'ability');
    if (ab.cost.ink) payInk(s, p, ab.cost.ink);
    if (ab.cost.discard) {
      const pick = x.withSource(iid, () => x.chooseCards({ from: s.players[p].hand.slice(), min: ab.cost.discard, max: ab.cost.discard, who: p, prompt: `Choose ${ab.cost.discard === 1 ? 'a card' : ab.cost.discard + ' cards'} to discard to pay for ${ab.name}.`, chosen: false }));
      for (const h of pick) x.discard(h);
    }
    if (ab.cost.banishSelf) banish(s, iid, {});
    s._via = iid;
    x.withSource(iid, () => ab.run(x));
  }

  function jobBoost(s, job) {
    const { iid } = job;
    const p = s.cards[iid].owner;
    const n = LC.chars(s, iid).kw.Boost;
    payInk(s, p, n);
    s.ti.boosted[iid] = true;
    const top = s.players[p].deck[0];
    log(s, p, 'boost', { iid });
    if (top) {
      move(s, top, 'under', { under: iid, facedown: true });
      emit(s, { type: 'putUnder', iid, card: top });
    }
  }

  // ---------------------------------------------------------------- triggered abilities
  function jobTrigger(s, job, x) {
    const k = s.bag.findIndex((e) => e.id === job.entryId);
    if (k < 0) throw new Illegal('no such bag entry');
    const entry = s.bag.splice(k, 1)[0];
    s._via = entry.src;
    log(s, entry.owner, 'ability', { iid: entry.src, name: entry.name });
    if (entry.ti === 'support') return x.withSource(entry.src, () => LC.keywordSupport(x));
    const t = ABIL(entry.cardId).triggers[entry.ti];
    x.withSource(entry.src, () => t.run(x, entry.ev));
  }

  // ---------------------------------------------------------------- legal actions
  LC.whoActs = function (s) {
    if (s.winner !== null) return null;
    if (s.ask) return s.ask.who;
    return s.active;
  };
  LC.isTerminal = (s) => s.winner !== null;

  LC.legalActions = function (s) {
    if (s.winner !== null) return [];
    if (s.ask) return askAnswers(s, s.ask);
    const out = [];
    const p = s.active;
    const P = s.players[p];
    if (s.phase !== 'main') return out;
    if (!P.inkedThisTurn) for (const h of P.hand) if (def(s, h).inkwell) out.push({ type: 'ink', iid: h });
    for (const h of P.hand) out.push(...playVariants(s, h));
    for (const c of LC.characters(s, p)) {
      const cc = s.cards[c];
      const ch = LC.chars(s, c);
      if (!cc.exerted && cc.dry && ch.canQuest) out.push({ type: 'quest', iid: c });
      if (!cc.exerted && (cc.dry || ch.kw.Rush) && ch.canChallenge) {
        for (const t of LC.inPlay(s, 1 - p)) if (LC.canChallengeTarget(s, c, t)) out.push({ type: 'challenge', iid: c, target: t });
      }
      if (ch.kw.Boost !== undefined && !s.ti.boosted[c] && readyInk(s, p) >= ch.kw.Boost && P.deck.length) out.push({ type: 'boost', iid: c });
    }
    for (const c of P.play) {
      const ch = LC.chars(s, c);
      ch.activated.forEach((a, idx) => { if (a.usable) out.push({ type: 'activate', iid: c, idx }); });
    }
    if (canEndTurn(s)) out.push({ type: 'end' });
    return out;
  };

  // CR 8.7.3 Reckless: can't end the turn while a ready Reckless character can challenge.
  function canEndTurn(s) {
    const p = s.active;
    for (const c of LC.characters(s, p)) {
      const ch = LC.chars(s, c);
      if (!ch.kw.Reckless || s.cards[c].exerted) continue;
      if (LC.inPlay(s, 1 - p).some((t) => LC.canChallengeTarget(s, c, t))) return false;
    }
    return true;
  }
  LC.canEndTurn = canEndTurn;
  LC.endTurnBlocker = function (s) {
    const p = s.active;
    for (const c of LC.characters(s, p)) {
      const ch = LC.chars(s, c);
      if (ch.kw.Reckless && !s.cards[c].exerted && LC.inPlay(s, 1 - p).some((t) => LC.canChallengeTarget(s, c, t))) return c;
    }
    return null;
  };

  function playVariants(s, h) {
    const out = [];
    const d = def(s, h);
    const p = s.cards[h].owner;
    const a = ABIL(d.id);
    if (a.cantPlay && a.cantPlay(s, h)) return out;
    if (LC.costToPlay(s, h) <= readyInk(s, p)) out.push({ type: 'play', iid: h, pay: 'ink' });
    if (a.freePlay && a.freePlay(s, h)) out.push({ type: 'play', iid: h, pay: 'free' });
    const kw = LC.printedKeywords(d);
    if (kw.Shift !== undefined) {
      const cost = LC.costToPlay(s, h, kw.Shift);
      for (const t of shiftTargets(s, h)) {
        if (cost <= readyInk(s, p)) out.push({ type: 'play', iid: h, pay: 'shift', onto: t });
        if (a.altShift && a.altShift.can(s, h)) out.push({ type: 'play', iid: h, pay: 'shiftAlt', onto: t });
      }
    }
    if (LC.isSong(d)) {
      for (const c of LC.characters(s, p)) if (canSing(s, c, h)) out.push({ type: 'play', iid: h, pay: 'sing', singer: c });
      if (kw.SingTogether) {
        const total = LC.characters(s, p).filter((c) => !s.cards[c].exerted && s.cards[c].dry).reduce((n, c) => n + LC.chars(s, c).singCost, 0);
        if (total >= kw.SingTogether) out.push({ type: 'play', iid: h, pay: 'singTogether' });
      }
    }
    return out;
  }

  function askAnswers(s, a) {
    switch (a.kind) {
      case 'yesno': return [{ type: 'answer', value: true }, { type: 'answer', value: false }];
      case 'mode': return a.options.map((o, i) => (o.enabled === false ? null : { type: 'answer', value: i })).filter(Boolean);
      case 'bag': return a.options.map((o) => ({ type: 'answer', value: o.id }));
      case 'cards':
      case 'mulligan':
      case 'order': return sampleSelections(s, a).map((v) => ({ type: 'answer', value: v }));
      default: throw new Error(`unknown ask kind ${a.kind}`);
    }
  }
  // Representative answers for multi-picks (the AI uses these; the UI builds its own picker).
  function sampleSelections(s, a) {
    const from = a.from, out = [];
    const ok = (sel) => validSelection(s, a, sel);
    if (a.max <= 1 || from.length <= 1) {
      if (ok([])) out.push([]);
      for (const f of from) if (ok([f])) out.push([f]);
      return out;
    }
    if (from.length <= 8) {
      const n = from.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const sel = from.filter((_, i) => mask & (1 << i));
        if (ok(sel)) out.push(sel);
        if (out.length >= 256) break;
      }
      return out;
    }
    // Larger pools: empty, singles, every pair, the first max, and all.
    if (ok([])) out.push([]);
    for (const f of from) if (ok([f])) out.push([f]);
    for (let i = 0; i < from.length; i++) for (let j = i + 1; j < from.length; j++) if (ok([from[i], from[j]])) out.push([from[i], from[j]]);
    const firstMax = from.slice(0, a.max);
    if (ok(firstMax)) out.push(firstMax);
    if (ok(from.slice())) out.push(from.slice());
    return out;
  }
  function validSelection(s, a, sel) {
    if (!Array.isArray(sel)) return false;
    if (new Set(sel).size !== sel.length) return false;
    if (sel.length < a.min || sel.length > a.max) return false;
    if (!sel.every((i) => a.from.includes(i))) return false;
    if (a.sumCostMin) {
      const tot = sel.reduce((n, i) => n + LC.chars(s, i).singCost, 0);
      if (tot < a.sumCostMin) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- apply
  LC.apply = function (prev, action) {
    if (prev.winner !== null) throw new Illegal('game is over');
    const s = LC.clone(prev);
    if (s.ask) {
      if (action.type !== 'answer') throw new Illegal('a decision is pending');
      const a = s.ask;
      if (!validAnswer(s, a, action.value)) throw new Illegal('invalid answer');
      const job = s.pendingJob;
      const snap = s.pendingSnap;
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, snap);
      s.ask = null; s.pendingJob = null; s.pendingSnap = null;
      job.answers.push(action.value);
      runJob(s, job);
      settle(s);
      return s;
    }
    if (action.type === 'answer') throw new Illegal('nothing to answer');
    if (s.phase !== 'main') throw new Illegal('not in the main phase');
    if (s.queue.length || s.bag.length) throw new Illegal('the game is still resolving');
    const legal = LC.legalActions(prev).some((l) => sameAction(l, action));
    if (!legal) throw new Illegal(`illegal action ${JSON.stringify(action)}`);
    const job = { ...action, k: action.type === 'end' ? 'endTurn' : action.type, answers: [] };
    delete job.type;
    runJob(s, job);
    settle(s);
    return s;
  };
  function sameAction(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if ((a[k] ?? null) !== (b[k] ?? null)) return false;
    return true;
  }
  function validAnswer(s, a, v) {
    switch (a.kind) {
      case 'yesno': return v === true || v === false;
      case 'mode': return Number.isInteger(v) && v >= 0 && v < a.options.length && a.options[v].enabled !== false;
      case 'bag': return a.options.some((o) => o.id === v);
      default: return validSelection(s, a, v);
    }
  }

  // ---------------------------------------------------------------- UI helpers
  LC.whyNot = function (s, iid) {
    const c = s.cards[iid];
    if (!c || c.zone !== 'hand') return null;
    const p = c.owner;
    if (s.winner !== null) return 'The game is over.';
    if (s.ask) return 'Finish the current decision first.';
    if (p !== s.active) return "It isn't your turn.";
    const vars = playVariants(s, iid);
    if (vars.length) return null;
    const d = def(s, iid);
    const a = ABIL(d.id);
    if (a.cantPlay && a.cantPlay(s, iid)) return a.cantPlayWhy ? a.cantPlayWhy(s, iid) : "Can't be played right now.";
    const need = LC.costToPlay(s, iid);
    return `Needs ${need} ink, you have ${readyInk(s, p)} ready.`;
  };
  LC.whyNotInk = function (s, iid) {
    const c = s.cards[iid];
    if (!def(s, iid).inkwell) return 'This card has no inkwell symbol.';
    if (s.players[c.owner].inkedThisTurn) return "You've already put a card into your inkwell this turn.";
    return null;
  };

  LC.actionsFor = function (s, iid) {
    return LC.legalActions(s).filter((a) => a.iid === iid || a.target === iid || a.singer === iid || a.onto === iid);
  };

  // Expose internals the ability runtime and tests use.
  LC._internal = { settle, runJob, gsc, emit, move, placeIn, removeFromZone, playCard, readyInk, validSelection, freshTurnInfo };
})();
