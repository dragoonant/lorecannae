// js/ui/deckbuilder.js — browse the 136-card pool and build decks (PLAN.md D5). Legal
// decks: 60+ cards, at most 4 copies per full name, one or two inks (LC.deckValid). Saved
// in localStorage (wrapped; a blocked store loses the convenience, never the game) and
// listed in the chooser under "Your decks".
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  let deck = null;          // {id, name, cards: {cardId: qty}}
  const filt = { inks: {}, type: 'all', cost: 'all', q: '' };

  function blank() { return { id: 'd' + Date.now().toString(36), name: 'My deck', cards: {} }; }
  function asList(d) { return Object.keys(d.cards).filter(function (k) { return d.cards[k] > 0; }).map(function (k) { return [k, d.cards[k]]; }); }
  function total(d) { return asList(d).reduce(function (n, c) { return n + c[1]; }, 0); }
  function copiesOfName(d, def) {
    const full = LC.fullName(def);
    return asList(d).reduce(function (n, c) { return LC.fullName(LC.CARDS[c[0]]) === full ? n + c[1] : n; }, 0);
  }
  function deckInks(d) { return LC.title.inksOfList(asList(d)); }

  function add(id, n) {
    const def = LC.CARDS[id];
    const cur = deck.cards[id] || 0;
    if (n > 0) {
      if (copiesOfName(deck, def) >= 4) { say('At most 4 copies of ' + LC.fullName(def) + '.'); return; }
      const inks = deckInks(deck);
      const newInks = U.inksOf(def).filter(function (i) { return inks.indexOf(i) < 0; });
      if (inks.length + newInks.length > 2) { say('A deck uses at most two inks (this one has ' + inks.join(' and ') + ').'); return; }
    }
    deck.cards[id] = Math.max(0, cur + n);
    if (!deck.cards[id]) delete deck.cards[id];
    draw();
  }
  function say(t) { const n = $('db-msg'); if (n) { n.textContent = t; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); } }

  function pool() {
    const q = filt.q.trim().toLowerCase();
    const anyInk = Object.keys(filt.inks).some(function (k) { return filt.inks[k]; });
    return Object.keys(LC.CARDS).map(function (k) { return LC.CARDS[k]; }).filter(function (d) {
      if (LC.DEFECTS[d.id]) return false;
      if (anyInk && !U.inksOf(d).some(function (i) { return filt.inks[i]; })) return false;
      const t = U.mainType(d);
      if (filt.type === 'song' ? !U.isSong(d) : (filt.type !== 'all' && t !== filt.type)) return false;
      if (filt.cost !== 'all') { const c = Number(filt.cost); if (c === 9 ? d.cost < 9 : d.cost !== c) return false; }
      if (q && (LC.fullName(d) + ' ' + d.text + ' ' + d.classifications.join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.cost - b.cost || LC.fullName(a).localeCompare(LC.fullName(b)); });
  }

  function filters() {
    const bar = el('div', 'db-filters');
    LC.INKS.forEach(function (ink) {
      const b = el('button', 'db-ink' + (filt.inks[ink] ? ' is-on' : ''));
      const d = el('span', 'ink-dot'); d.style.background = U.INK[ink].dot;
      b.appendChild(d); b.appendChild(document.createTextNode(' ' + ink));
      b.onclick = function () { filt.inks[ink] = !filt.inks[ink]; draw(); };
      bar.appendChild(b);
    });
    const type = el('select', 'title-select db-type');
    [['all', 'All types'], ['character', 'Characters'], ['action', 'Actions'], ['song', 'Songs'], ['item', 'Items']].forEach(function (o) {
      const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (filt.type === o[0]) op.selected = true; type.appendChild(op);
    });
    type.onchange = function () { filt.type = type.value; draw(); };
    bar.appendChild(type);
    const costs = el('div', 'db-costs');
    ['all', 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (c) {
      const b = el('button', 'db-cost' + (String(filt.cost) === String(c) ? ' is-on' : ''), c === 'all' ? 'Any' : (c === 9 ? '9+' : String(c)));
      b.onclick = function () { filt.cost = String(c); draw(); };
      costs.appendChild(b);
    });
    bar.appendChild(costs);
    const search = el('input', 'db-search');
    search.type = 'search'; search.placeholder = 'Search name, text, classification…'; search.value = filt.q;
    search.oninput = function () { filt.q = search.value; drawGrid(); };
    bar.appendChild(search);
    return bar;
  }

  function drawGrid() {
    const grid = $('db-grid');
    if (!grid) return;
    grid.textContent = '';
    const list = pool();
    list.forEach(function (d) {
      const cell = el('div', 'db-cell');
      const face = LC.renderCard(d.id, { size: 'hand' });
      face.onclick = function () { add(d.id, 1); };
      face.oncontextmenu = function (e) { e.preventDefault(); add(d.id, -1); };
      cell.appendChild(face);
      const n = deck.cards[d.id] || 0;
      const ctl = el('div', 'db-cell-ctl');
      const minus = el('button', null, '−'); minus.disabled = !n; minus.onclick = function () { add(d.id, -1); };
      const plus = el('button', null, '+'); plus.onclick = function () { add(d.id, 1); };
      ctl.appendChild(minus); ctl.appendChild(el('span', 'db-qty' + (n ? ' is-in' : ''), String(n))); ctl.appendChild(plus);
      cell.appendChild(ctl);
      grid.appendChild(cell);
    });
    $('db-count').textContent = list.length + ' of ' + Object.keys(LC.CARDS).length + ' cards';
  }

  function curve(list) {
    const bins = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach(function (c) { bins[Math.min(8, LC.CARDS[c[0]].cost - 1)] += c[1]; });
    const max = Math.max(1, Math.max.apply(null, bins));
    const wrap = el('div', 'db-curve');
    bins.forEach(function (n, i) {
      const col = el('div', 'db-bar-col');
      const bar = el('div', 'db-bar'); bar.style.height = (n / max * 100) + '%';
      bar.setAttribute('data-tip', n + ' card' + (n === 1 ? '' : 's') + ' costing ' + (i === 8 ? '9+' : i + 1));
      col.appendChild(el('div', 'db-bar-n', n ? String(n) : ''));
      col.appendChild(bar);
      col.appendChild(el('div', 'db-bar-x', i === 8 ? '9+' : String(i + 1)));
      wrap.appendChild(col);
    });
    return wrap;
  }

  function side() {
    const panel = el('div', 'db-side');
    const name = el('input', 'db-name');
    name.value = deck.name; name.maxLength = 40;
    name.oninput = function () { deck.name = name.value || 'My deck'; };
    panel.appendChild(name);
    const list = asList(deck);
    const v = LC.deckValid(list);
    const head = el('div', 'db-total' + (v.ok ? ' is-ok' : ''), total(deck) + ' / 60 cards');
    panel.appendChild(head);
    const inks = el('div', 'db-inks');
    deckInks(deck).forEach(function (i) { const d = el('span', 'ink-dot'); d.style.background = U.INK[i].dot; inks.appendChild(d); inks.appendChild(document.createTextNode(' ' + i + '  ')); });
    const inkable = list.reduce(function (n, c) { return n + (LC.CARDS[c[0]].inkwell ? c[1] : 0); }, 0);
    inks.appendChild(el('span', 'db-inkable', inkable + ' inkable'));
    panel.appendChild(inks);
    panel.appendChild(curve(list));
    panel.appendChild(el('div', 'db-valid' + (v.ok ? ' is-ok' : ''), v.ok ? 'Legal deck — ready to play.' : 'Not legal yet: ' + v.errors.join(' ')));
    const rows = el('div', 'db-list');
    list.sort(function (a, b) { const A = LC.CARDS[a[0]], B = LC.CARDS[b[0]]; return A.cost - B.cost || LC.fullName(A).localeCompare(LC.fullName(B)); })
      .forEach(function (c) {
        const d = LC.CARDS[c[0]];
        const r = el('div', 'db-row');
        r.appendChild(U.costGem(d.cost, d.inkwell, null, U.inksOf(d)[0]));
        const n = el('span', 'db-row-name card-ref', LC.fullName(d));
        n.dataset.cardId = d.id;
        r.appendChild(n);
        const minus = el('button', null, '−'); minus.onclick = function () { add(d.id, -1); };
        const plus = el('button', null, '+'); plus.onclick = function () { add(d.id, 1); };
        r.appendChild(minus); r.appendChild(el('span', 'db-qty is-in', String(c[1]))); r.appendChild(plus);
        rows.appendChild(r);
      });
    if (!list.length) rows.appendChild(el('div', 'title-note', 'Click a card on the left to add it (right-click removes).'));
    panel.appendChild(rows);
    panel.appendChild(el('div', 'db-msg', '')).id = 'db-msg';
    const btns = el('div', 'db-buttons');
    const save = el('button', 'action-btn', 'Save deck');
    save.onclick = function () {
      const all = LC.savedDecks().filter(function (x) { return x.id !== deck.id; });
      all.push({ id: deck.id, name: deck.name, cards: asList(deck) });
      U.store.set('decks', all);
      say(v.ok ? 'Saved. It is in the deck chooser under "Your decks".' : 'Saved (not legal yet, so it can’t be picked until it is).');
    };
    const load = el('select', 'title-select');
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Open…'; load.appendChild(o0);
    LC.savedDecks().forEach(function (d) { const o = document.createElement('option'); o.value = 'c:' + d.id; o.textContent = d.name; load.appendChild(o); });
    LC.DECKS.forEach(function (d) { const o = document.createElement('option'); o.value = 'n:' + d.id; o.textContent = 'Copy of ' + d.name + ' (' + d.player + ')'; load.appendChild(o); });
    load.onchange = function () {
      const v2 = load.value;
      if (!v2) return;
      let src;
      if (v2.indexOf('c:') === 0) { src = LC.savedDecks().find(function (d) { return d.id === v2.slice(2); }); deck = { id: src.id, name: src.name, cards: {} }; }
      else { src = LC.DECKS.find(function (d) { return d.id === v2.slice(2); }); deck = blank(); deck.name = src.name + ' (copy)'; }
      src.cards.forEach(function (c) { deck.cards[c[0]] = (deck.cards[c[0]] || 0) + c[1]; });
      draw();
    };
    const fresh = el('button', null, 'New');
    fresh.onclick = function () { deck = blank(); draw(); };
    const del = el('button', null, 'Delete');
    del.onclick = function () {
      const all = LC.savedDecks().filter(function (x) { return x.id !== deck.id; });
      U.store.set('decks', all);
      deck = blank(); draw(); say('Deleted.');
    };
    const back = el('button', null, 'Back');
    back.onclick = function () { LC.title.rebuild(); };
    [save, load, fresh, del, back].forEach(function (b) { btns.appendChild(b); });
    panel.appendChild(btns);
    return panel;
  }

  function draw() {
    const sc = $('title-screen');
    const keepSearchFocus = document.activeElement && document.activeElement.classList.contains('db-search');
    sc.textContent = '';
    const box = el('div', 'title-picker deck-builder');
    const left = el('div', 'db-left');
    const top = el('div', 'db-top');
    top.appendChild(el('h1', 'title-name title-name-small', 'Deck builder'));
    top.appendChild(el('span', 'db-count', '')).id = 'db-count';
    left.appendChild(top);
    left.appendChild(filters());
    const grid = el('div', 'db-grid'); grid.id = 'db-grid';
    left.appendChild(grid);
    box.appendChild(left);
    box.appendChild(side());
    sc.appendChild(box);
    drawGrid();
    if (keepSearchFocus) { const s = sc.querySelector('.db-search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  LC.deckBuilder = {
    open: function () { if (!deck) deck = blank(); draw(); },
  };
})();
