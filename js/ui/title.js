// js/ui/title.js — the entry point (PRESENTATION-REFERENCE A1): title splash -> wipe ->
// picker (two pre-picked deck slots with dice, mode, opponent skill, Start) -> deck
// chooser with hover peek -> match. The Start click is the first real gesture, so it
// also unlocks audio. Nothing here touches game state; LC.ui.start begins a match.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  const HOLD_MS = 3000, WIPE_MS = 900, PEEK_MS = 600;
  // Verbatim from NOTICE.md "In-game disclaimer" (same-commit maintenance: change both).
  const DISCLAIMER = 'This is an unofficial, non-commercial fan project and is not affiliated with, endorsed, sponsored or approved by Disney or Ravensburger. Disney Lorcana is a trademark of Disney and is published by Ravensburger. Card names and rules text belong to their owners and are reproduced here for personal play. This game contains no official card images, logos or artwork; all art and sound are original and generated locally. Nothing here is for sale.';
  LC.DISCLAIMER = DISCLAIMER;

  let phase = 'idle', holdTimer = null;
  const chosen = { a: null, b: null };
  const secret = { a: true, b: true };
  let mode = U.store.get('mode', 'ai');
  let level = U.store.get('level', 'normal');

  // ---- decks -----------------------------------------------------------------------
  // Decks containing a card listed in data/defects.js are kept out (engine's gate).
  function champDecks() { return LC.playableDecks(); }
  LC.savedDecks = function () {
    const list = U.store.get('decks', []);
    return Array.isArray(list) ? list : [];
  };
  function deckById(key) {
    if (!key) return null;
    if (key.indexOf('custom:') === 0) {
      const d = LC.savedDecks().find(function (x) { return 'custom:' + x.id === key; });
      return d ? { key: key, name: d.name, cards: d.cards, custom: true, inks: inksOfList(d.cards) } : null;
    }
    const d = LC.DECKS.find(function (x) { return x.id === key; });
    return d ? Object.assign({ key: key }, d) : null;
  }
  function inksOfList(cards) {
    const set = {};
    cards.forEach(function (c) { const d = LC.CARDS[c[0]]; if (d) U.inksOf(d).forEach(function (i) { set[i] = 1; }); });
    return Object.keys(set);
  }
  function engineDeck(key) {
    const d = deckById(key);
    if (!d) throw new Error('unknown deck ' + key);
    return d.custom ? { name: d.name, cards: d.cards } : d.id;
  }
  // Legality is the engine's (LC.deckProblems: CR deck-building rules + the defects gate);
  // this adds only the numbers the deck builder displays.
  LC.deckValid = function (cards) {
    const errs = LC.deckProblems({ cards: cards });
    if (!cards.length) errs.push('The deck has no cards.');
    const total = cards.reduce(function (n, c) { return n + c[1]; }, 0);
    return { ok: !errs.length, errors: errs, total: total, inks: inksOfList(cards) };
  };
  function playableKeys() {
    const keys = champDecks().map(function (d) { return d.id; });
    LC.savedDecks().forEach(function (d) { if (LC.deckValid(d.cards).ok) keys.push('custom:' + d.id); });
    return keys;
  }
  function randomDeck(notThis) {
    const pool = champDecks().map(function (d) { return d.id; }).filter(function (k) { return k !== notThis; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function inkDots(inks) {
    const w = el('span', 'deck-inks');
    inks.forEach(function (i) { const d = el('span', 'ink-dot'); d.style.background = U.INK[i].dot; d.setAttribute('data-tip', i); w.appendChild(d); });
    return w;
  }

  // ---- the peek ---------------------------------------------------------------------------
  function clearPeek() { const o = document.querySelector('.deck-peek'); if (o) o.remove(); }
  function keyCards(d) {
    return d.cards.map(function (c) { return LC.CARDS[c[0]]; }).filter(function (x) { return x && x.type.indexOf('Character') >= 0; })
      .sort(function (a, b) { return b.cost - a.cost || (b.lore || 0) - (a.lore || 0); }).slice(0, 3);
  }
  function attachPeek(btn, keyOf) {
    let t = null;
    function show() {
      clearPeek();
      const d = deckById(keyOf());
      if (!d) return;
      const panel = el('div', 'deck-peek no-preview');
      const head = el('div', 'peek-head');
      head.appendChild(el('div', 'peek-name', d.name));
      const meta = el('div', 'peek-meta');
      meta.appendChild(inkDots(d.inks || inksOfList(d.cards)));
      meta.appendChild(document.createTextNode(d.custom ? ' Your deck' :
        ' ' + d.archetype + ' · ' + d.player + ' · ' + d.place + ' at DLC-NACC 2026'));
      head.appendChild(meta);
      if (!d.custom) head.appendChild(el('div', 'peek-src', 'Disney Lorcana Challenge North American Championship, 2026-08-29 · ' + d.source));
      panel.appendChild(head);
      const row = el('div', 'peek-cards');
      keyCards(d).forEach(function (def) { row.appendChild(LC.renderCard(def.id, { size: 'preview' })); });
      panel.appendChild(row);
      document.body.appendChild(panel);
      // Scale to fit rather than clip: a peek nobody can scroll must show everything.
      const r = btn.getBoundingClientRect();
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const k = Math.min(1, (window.innerHeight - 16) / h, (window.innerWidth - 16) / w);
      if (k < 1) { panel.style.transform = 'scale(' + k + ')'; panel.style.transformOrigin = '0 0'; }
      const sw = w * k, sh = h * k;
      let left = r.right + 12;
      if (left + sw > window.innerWidth - 8) left = r.left - sw - 12;
      if (left < 8) left = Math.max(8, (window.innerWidth - sw) / 2);
      panel.style.left = left + 'px';
      panel.style.top = Math.max(8, Math.min(r.top + r.height / 2 - sh / 2, window.innerHeight - sh - 8)) + 'px';
    }
    function arm() { clearTimeout(t); t = setTimeout(show, PEEK_MS); }
    function disarm() { clearTimeout(t); clearPeek(); }
    btn.addEventListener('mouseenter', arm);
    btn.addEventListener('mouseleave', disarm);
    btn.addEventListener('focus', arm);
    btn.addEventListener('blur', disarm);
    btn.addEventListener('click', disarm);
  }

  // ---- screens -------------------------------------------------------------------------------
  function screen() { return $('title-screen'); }
  function setBg(name) {
    const url = LC.uiArtUrl(name) || LC.uiArtUrl('title');
    screen().style.backgroundImage = url ? 'url("' + url + '")' : '';
  }

  function splash() {
    const wrap = el('div', 'title-splash');
    wrap.appendChild(el('div', 'title-once', 'Once upon a time…'));
    wrap.appendChild(el('h1', 'title-name', 'Lorecannae'));
    wrap.appendChild(el('div', 'title-flourish'));
    wrap.appendChild(el('div', 'title-tagline', 'a duel of ink and lore — the first to gather 20 lore wins'));
    wrap.appendChild(el('div', 'title-hint', 'Click to continue'));
    return wrap;
  }
  function disclaimer() { return el('div', 'title-disclaimer', DISCLAIMER); }

  const SLOT_LABEL = {
    ai: ['Your deck', 'Opponent’s deck'], tutorial: ['Your deck', 'Opponent’s deck'],
    hotseat: ['Player 1’s deck', 'Player 2’s deck'], spectate: ['Bot A’s deck', 'Bot B’s deck'],
  };

  function deckSlot(side, label) {
    const row = el('div', 'title-field');
    row.appendChild(el('span', 'title-field-label', label));
    const line = el('div', 'title-deck-line');
    const btn = el('button', 'title-deck-btn');
    function paint() {
      btn.textContent = '';
      const d = deckById(chosen[side]);
      if (secret[side] || !d) { btn.appendChild(el('span', null, '? A random championship deck')); btn.classList.add('is-hidden-deck'); }
      else {
        btn.classList.remove('is-hidden-deck');
        btn.appendChild(inkDots(d.inks || inksOfList(d.cards)));
        btn.appendChild(el('span', null, ' ' + d.name + (d.custom ? '' : ' · ' + d.player)));
      }
    }
    paint();
    attachPeek(btn, function () { return secret[side] ? null : chosen[side]; });
    btn.onclick = function () { openChooser(side, function (k) { chosen[side] = k; secret[side] = false; }); };
    line.appendChild(btn);
    const dice = el('button', 'title-deck-dice', '⚄');
    dice.setAttribute('data-tip', 'Roll a random championship deck (kept secret until the game starts)');
    dice.setAttribute('aria-label', 'Roll a random deck');
    dice.onclick = function () { clearPeek(); chosen[side] = randomDeck(chosen[side === 'a' ? 'b' : 'a']); secret[side] = true; paint(); };
    line.appendChild(dice);
    row.appendChild(line);
    return row;
  }

  function select(label, value, options, onChange) {
    const row = el('label', 'title-field');
    row.appendChild(el('span', 'title-field-label', label));
    const s = el('select', 'title-select');
    options.forEach(function (o) {
      const op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (o[0] === value) op.selected = true;
      s.appendChild(op);
    });
    s.onchange = function () { onChange(s.value); };
    row.appendChild(s);
    return row;
  }

  function picker() {
    if (!chosen.a || !deckById(chosen.a)) { chosen.a = randomDeck(null); secret.a = true; }
    if (!chosen.b || !deckById(chosen.b)) { chosen.b = randomDeck(chosen.a); secret.b = true; }
    const box = el('div', 'title-picker');
    box.appendChild(el('h1', 'title-name title-name-small', 'Lorecannae'));
    box.appendChild(select('Mode', mode, [['ai', 'Play vs the computer'], ['hotseat', 'Two players, one device (hot-seat)'],
      ['spectate', 'Watch the computer play itself'], ['tutorial', 'Tutorial (guided game vs an easy computer)']], function (v) {
      mode = v; U.store.set('mode', v); rebuild();
    }));
    if (mode !== 'tutorial') {
      box.appendChild(deckSlot('a', SLOT_LABEL[mode][0]));
      box.appendChild(deckSlot('b', SLOT_LABEL[mode][1]));
    } else {
      box.appendChild(el('div', 'title-note', 'The tutorial uses two fixed championship decks and an Easy opponent. Coach bubbles explain each idea the first time it comes up; you can skip them at any time.'));
    }
    if (mode === 'ai' || mode === 'spectate') {
      box.appendChild(select(mode === 'spectate' ? 'Bot skill' : 'Opponent skill', level,
        [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], function (v) { level = v; U.store.set('level', v); }));
    }
    const start = el('button', 'title-start', mode === 'tutorial' ? 'Start the tutorial' : 'Start');
    start.onclick = function () { begin(); };
    box.appendChild(start);
    const row = el('div', 'title-row');
    const db = el('button', 'title-select-btn', 'Deck builder');
    db.onclick = function () { LC.deckBuilder.open(); };
    const help = el('button', 'title-select-btn', 'How to play');
    help.onclick = function () { LC.hud.openHelp(); };
    row.appendChild(db); row.appendChild(help);
    box.appendChild(row);
    return box;
  }
  function rebuild() {
    const sc = screen();
    sc.textContent = '';
    sc.appendChild(picker());
    sc.appendChild(disclaimer());
  }
  LC.title = LC.title || {};
  LC.title.rebuild = rebuild;

  function openChooser(side, done) {
    const sc = screen();
    const box = el('div', 'title-picker deck-chooser');
    box.appendChild(el('h1', 'title-name title-name-small', 'Choose ' + SLOT_LABEL[mode][side === 'a' ? 0 : 1].toLowerCase()));
    function closeIt(k) { clearPeek(); if (k) done(k); rebuild(); }
    const groups = [['Championship decks · DLC-NACC 2026 (Set 13 Core, 136 players)', champDecks().map(function (d) { return d.id; })],
      ['Your decks', LC.savedDecks().map(function (d) { return 'custom:' + d.id; })]];
    groups.forEach(function (g) {
      box.appendChild(el('div', 'deck-group-label', g[0]));
      if (!g[1].length) { box.appendChild(el('div', 'title-note', 'No saved decks yet — build one in the Deck builder.')); return; }
      const grid = el('div', 'deck-grid');
      g[1].forEach(function (k) {
        const d = deckById(k);
        const v = d.custom ? LC.deckValid(d.cards) : { ok: true };
        const b = el('button', 'deck-choice' + (k === chosen[side] && !secret[side] ? ' is-chosen' : ''));
        const top = el('span', 'deck-choice-name');
        top.appendChild(inkDots(d.inks || inksOfList(d.cards)));
        top.appendChild(document.createTextNode(' ' + d.name));
        b.appendChild(top);
        b.appendChild(el('span', 'deck-choice-meta', d.custom ? (v.ok ? v.total + ' cards' : 'Not legal: ' + v.errors.join('; '))
          : d.archetype + ' · ' + d.player + ' · ' + d.place + ' · ' + d.total + ' cards'));
        b.disabled = !v.ok;
        b.onclick = function () { closeIt(k); };
        attachPeek(b, function () { return k; });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
    const row = el('div', 'deck-chooser-actions');
    const rnd = el('button', 'title-select-btn', 'Surprise me');
    rnd.onclick = function () { clearPeek(); chosen[side] = randomDeck(null); secret[side] = true; rebuild(); };
    const back = el('button', 'title-select-btn', 'Back');
    back.onclick = function () { closeIt(null); };
    row.appendChild(rnd); row.appendChild(back);
    box.appendChild(row);
    sc.textContent = '';
    sc.appendChild(box);
  }

  // One opaque curtain on <body> sweeping across; the swap happens while it covers all.
  // The scene change: a sparkle iris. A night-sky circle with a gilded, glittering rim
  // closes over the screen from the centre, the screen is swapped while it covers
  // everything, then it opens again. Lives on <body> so emptying the title screen cannot
  // take it down; under reduced motion it is a plain short fade.
  function wipe(then) {
    const iris = el('div', 'title-wipe');
    const rim = el('div', 'title-wipe-rim');
    for (let i = 0; i < 16; i++) {
      const sp = el('span', 'wipe-spark', '✦');
      sp.style.setProperty('--a', (i * 22.5) + 'deg');
      sp.style.animationDelay = (i % 4) * 40 + 'ms';
      rim.appendChild(sp);
    }
    document.body.appendChild(iris);
    document.body.appendChild(rim);
    void iris.offsetWidth;
    iris.classList.add('run'); rim.classList.add('run');
    setTimeout(then, WIPE_MS * 0.45);
    setTimeout(function () { iris.remove(); rim.remove(); }, WIPE_MS + 60);
  }
  LC.title.wipe = wipe;

  function toPicker() {
    if (phase !== 'splash') return;
    phase = 'picker';
    clearTimeout(holdTimer);
    LC.sound.menu();
    wipe(function () {
      const sc = screen();
      sc.classList.remove('is-splash');
      sc.classList.add('is-picker');
      setBg('deck-chooser');
      rebuild();
    });
  }

  const TUTORIAL_DECKS = ['dillon-amber-amethyst', 'zero-hour-emerald-amber-sing-a-long'];
  function begin() {
    LC.sound.prewarm();
    let decks;
    if (mode === 'tutorial') {
      decks = TUTORIAL_DECKS.map(function (k) { return deckById(k) ? k : randomDeck(null); });
    } else decks = [engineDeck(chosen.a), engineDeck(chosen.b)];
    const m = mode;
    // Secret picks are spent: the next picker re-rolls rather than repeating them.
    if (secret.a) chosen.a = null;
    if (secret.b) chosen.b = null;
    wipe(function () {
      const sc = screen();
      sc.className = '';
      sc.textContent = '';
      phase = 'idle';
      LC.ui.start({ mode: m, decks: decks, level: level });
    });
  }

  LC.title.init = function () {
    const sc = screen();
    phase = 'splash';
    sc.className = 'open is-splash';
    setBg('title');
    sc.textContent = '';
    sc.appendChild(splash());
    sc.appendChild(disclaimer());
    holdTimer = setTimeout(toPicker, HOLD_MS);
    sc.addEventListener('click', function () { if (phase === 'splash') toPicker(); });
    document.addEventListener('keydown', function (e) { if (phase === 'splash') { e.preventDefault(); toPicker(); } });
  };
  LC.title.openPicker = function () {
    const sc = screen();
    phase = 'picker';
    LC.anim.skip();
    LC.sound.menu();
    sc.className = 'open';
    wipe(function () { sc.classList.add('is-picker'); setBg('deck-chooser'); rebuild(); });
  };
  LC.title.engineDeck = engineDeck;
  LC.title.deckById = deckById;
  LC.title.inksOfList = inksOfList;
})();
