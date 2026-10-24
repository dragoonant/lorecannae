// js/ui/logtext.js — human-readable log lines from structured log entries
// (PRESENTATION-REFERENCE A7, kb/LESSONS-DIGEST §4.7). Display only: the engine never
// writes prose, and sound/animation read the structured data, never this text.
//
// A line is a list of SEGMENTS — strings and {iid, cardId, name} card references — so
// the log panel can make every card name a hover doorway without string matching.
// Second person ("You draw") is applied here, at render time, for the human seat in
// vs-AI mode; hot-seat and spectate use player names. Hidden information (draws and
// inks of a seat the viewer is not) is named only to its owner.
(function () {
  'use strict';
  const LC = globalThis.LC;

  // Every entry type in docs/ENGINE-API.md "Log entries". The self-check below fails
  // loudly (console.error + LC.logText.missing) on any without a describer, so a new
  // type cannot ship mute.
  const CONTRACT_TYPES = ['start', 'mulligan', 'turn', 'draw', 'ink', 'play', 'ability', 'quest',
    'challenge', 'damage', 'heal', 'banish', 'lore', 'exert', 'ready', 'toHand', 'toDeck',
    'toDiscard', 'toInk', 'under', 'discard', 'reveal', 'boost', 'buff', 'shuffle', 'fizzle', 'win'];

  // ---- perspective -----------------------------------------------------------------
  // persp = {you: seat|null (second person for this seat), sees: seat|'all'|null,
  //          names: [name0, name1]}
  let persp = { you: 0, sees: 0, names: ['You', 'The opponent'] };
  function setPerspective(p) { persp = p; }

  function isYou(seat) { return persp.you != null && seat === persp.you; }
  function P(seat) {                          // subject form
    if (seat == null) return 'Someone';
    return isYou(seat) ? 'You' : persp.names[seat];
  }
  // Mid-sentence forms: "the opponent", never "The opponent" after a comma.
  function mid(seat) { const n = persp.names[seat]; return /^The /.test(n) ? 'the' + n.slice(3) : n; }
  function pObj(seat) { return isYou(seat) ? 'you' : mid(seat); }
  function poss(seat) { return isYou(seat) ? 'your' : mid(seat) + '’s'; }
  function their(seat) { return isYou(seat) ? 'your' : 'their'; }
  function v(seat, bare, third) { return isYou(seat) ? bare : (third || bare + 's'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function sees(seat) { return persp.sees === 'all' || (persp.sees != null && persp.sees === seat); }

  function C(state, iid) {
    const c = state && state.cards ? state.cards[iid] : null;
    if (!c) return 'a card';
    const def = LC.CARDS[c.id];
    return { iid: iid, cardId: c.id, name: def ? LC.fullName(def) : c.id };
  }
  function ownerOf(state, iid) { const c = state && state.cards[iid]; return c ? c.owner : null; }
  // A card whose identity the viewer may not know (from a hidden zone, not theirs).
  function maybeC(state, iid, hiddenFromOthers) {
    const o = ownerOf(state, iid);
    if (hiddenFromOthers && !sees(o) && state.phase !== 'over') return 'a card';
    return C(state, iid);
  }
  function list(segs, items) {
    items.forEach(function (it, i) {
      if (i > 0) segs.push(i === items.length - 1 ? ' and ' : ', ');
      segs.push(it);
    });
    return segs;
  }
  const ZONE = { deck: 'deck', hand: 'hand', ink: 'inkwell', play: 'play', discard: 'discard', under: 'a stack' };
  const HIDDEN_ZONES = { deck: 1, hand: 1, ink: 1, under: 1 };

  const D = {
    start: function (l) { return ['The game begins. ', P(l.first), ' ', v(l.first, 'go', 'goes'), ' first.']; },
    mulligan: function (l) {
      if (!l.count) return [P(l.who), ' ', v(l.who, 'keep'), ' ', their(l.who), ' opening hand.'];
      return [P(l.who), ' ', v(l.who, 'put'), ' ', plural(l.count, 'card'), ' on the bottom and ', v(l.who, 'draw'), ' ', String(l.count), '.'];
    },
    turn: function (l) { return ['Turn ' + l.turn + ' · ' + (isYou(l.who) ? 'Your turn' : persp.names[l.who] + '’s turn')]; },
    draw: function (l, s) {
      if (sees(l.who) || s.phase === 'over') return [P(l.who), ' ', v(l.who, 'draw'), ' ', C(s, l.iid), '.'];
      return [P(l.who), ' ', v(l.who, 'draw'), ' a card.'];
    },
    // An inked card is revealed as it goes in (CR 4.2.1.1), so both players see its name.
    ink: function (l, s) { return [P(l.who), ' ', v(l.who, 'put'), ' ', C(s, l.iid), ' into ', their(l.who), ' inkwell.']; },
    play: function (l, s) {
      const card = C(s, l.iid);
      if (l.pay === 'shift' || l.pay === 'shiftAlt') return [P(l.who), ' ', v(l.who, 'shift'), ' ', card, ' onto ', C(s, l.onto), '.'];
      const singers = l.singers && l.singers.length ? l.singers : (l.singer != null ? [l.singer] : []);
      if (l.pay === 'sing' && singers.length) return [C(s, singers[0]), ' sings ', card, '.'];
      if (l.pay === 'singTogether') {
        const segs = list([], singers.map(function (i) { return C(s, i); }));
        return segs.concat([' sing ', card, ' together.']);
      }
      if (l.pay === 'free') return [P(l.who), ' ', v(l.who, 'play'), ' ', card, ' for free.'];
      return [P(l.who), ' ', v(l.who, 'play'), ' ', card, l.from && l.from !== 'hand' ? ' from ' + their(l.who) + ' ' + (ZONE[l.from] || l.from) + '.' : '.'];
    },
    ability: function (l, s) { const n = l.name || 'ability'; return [C(s, l.iid), ': ' + n + (/[.!?]$/.test(n) ? '' : '.')]; },
    quest: function (l, s) {
      const segs = [C(s, l.iid), ' quests for ' + plural(l.lore, 'lore', 'lore')];
      if (l.total != null) segs.push(' (' + pObj(l.who) + ' now ' + (isYou(l.who) ? 'have ' : 'has ') + l.total + ')');
      segs.push('.');
      return segs;
    },
    challenge: function (l, s) { return [C(s, l.iid), ' challenges ', C(s, l.target), '.']; },
    damage: function (l, s) {
      if (l.put) return [plural(l.amount, 'damage counter') + ' put on ', C(s, l.iid), '.'];
      const segs = [C(s, l.iid), ' takes ' + l.amount + ' damage'];
      if (l.from != null && s.cards[l.from] && l.from !== l.iid) segs.push(' from ', C(s, l.from));
      segs.push('.');
      return segs;
    },
    heal: function (l, s) { return [plural(l.amount, 'damage', 'damage') + ' removed from ', C(s, l.iid), '.']; },
    banish: function (l, s) {
      const segs = [C(s, l.iid), ' is banished'];
      if (l.by != null && s.cards[l.by] && l.by !== l.iid) segs.push(' by ', C(s, l.by));
      segs.push('.');
      return segs;
    },
    lore: function (l) {
      if (l.amount < 0) return [P(l.who), ' ', v(l.who, 'lose'), ' ' + plural(-l.amount, 'lore', 'lore') + ' (now ' + l.total + ').'];
      return [P(l.who), ' ', v(l.who, 'gain'), ' ' + plural(l.amount, 'lore', 'lore') + ' (now ' + l.total + ').'];
    },
    exert: function (l, s) { return [C(s, l.iid), ' is exerted.']; },
    ready: function (l, s) { return [C(s, l.iid), ' is readied.']; },
    toHand: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [maybeC(s, l.iid, HIDDEN_ZONES[l.from]), ' goes to ', poss(o), ' hand' + (l.from ? ' from ' + their(o) + ' ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    toDeck: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [maybeC(s, l.iid, HIDDEN_ZONES[l.from]), ' goes into ', poss(o), ' deck' + (l.from ? ' from ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    toDiscard: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [C(s, l.iid), ' goes to ', poss(o), ' discard' + (l.from ? ' from ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    toInk: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [maybeC(s, l.iid, true), ' goes into ', poss(o), ' inkwell' + (l.from ? ' from ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    under: function (l, s) {
      const o = ownerOf(s, l.iid);
      const c = s.cards[l.iid];
      return [c && c.facedown && !sees(o) ? 'A card' : C(s, l.iid), ' is put under another card' + (l.from ? ' from ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    discard: function (l, s) { const o = ownerOf(s, l.iid); return [P(o), ' ', v(o, 'discard'), ' ', C(s, l.iid), '.']; },
    reveal: function (l, s) {
      const segs = [P(l.who), ' ', v(l.who, 'reveal'), ' '];
      return list(segs, (l.iids || []).map(function (i) { return C(s, i); })).concat(['.']);
    },
    boost: function (l, s) { return [C(s, l.iid), ' boosts: the top card of the deck goes facedown under it.']; },
    buff: function (l, s) { return [C(s, l.iid), ' ' + (l.text || 'is modified') + '.']; },
    shuffle: function (l) { return [P(l.who), ' ', v(l.who, 'shuffle'), ' ', their(l.who), ' deck.']; },
    fizzle: function (l, s) { return [l.iid != null ? C(s, l.iid) : 'An effect', ': ' + (l.text || 'it did nothing') + '.']; },
    win: function (l) {
      const why = { lore: 'reaching 20 lore', deckout: 'the other player running out of cards to draw', concede: 'concession' }[l.reason] || l.reason;
      return [P(l.who), ' ', v(l.who, 'win'), (why ? ' by ' + why : ''), '!'];
    },
  };

  const missing = CONTRACT_TYPES.filter(function (t) { return typeof D[t] !== 'function'; });
  if (missing.length) console.error('[logtext] contract log types with no phrase: ' + missing.join(', '));
  const warned = {};

  function cap(segs) {
    if (typeof segs[0] === 'string' && segs[0].length) segs[0] = segs[0].charAt(0).toUpperCase() + segs[0].slice(1);
    return segs;
  }

  LC.logText = {
    CONTRACT_TYPES: CONTRACT_TYPES,
    missing: missing,
    setPerspective: setPerspective,
    perspective: function () { return persp; },
    // -> array of segments, or null for a type with no describer (logged once).
    segments: function (entry, state) {
      const fn = D[entry.type];
      if (!fn) {
        if (!warned[entry.type]) { warned[entry.type] = true; console.error('[logtext] no phrase for log type "' + entry.type + '"'); }
        return null;
      }
      return cap(fn(entry, state));
    },
    plain: function (entry, state) {
      const segs = LC.logText.segments(entry, state);
      if (!segs) return '(' + entry.type + ')';
      return segs.map(function (x) { return typeof x === 'string' ? x : x.name; }).join('');
    },
    isDivider: function (l) { return l.type === 'turn' || l.type === 'start' || l.type === 'win'; },
    hasPhrase: function (type) { return typeof D[type] === 'function'; },
  };
})();
