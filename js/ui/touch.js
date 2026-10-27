// js/ui/touch.js — the phone model (PLAN.md D18), after the way a phone card game plays:
// a TAP reads (the inspector, with the card's actions as buttons), a DRAG commits (drop on
// the play area, the inkwell, the lore track or a rival), a HOLD peeks (the card enlarged
// for as long as the finger stays down). On a phone the hand rests as a fan along the
// bottom edge; tapping it raises it, and playing or tapping away lowers it. Recent plays
// run down the left edge. Layout is CSS keyed on the classes set here; nothing here
// decides a rule.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  const HISTORY_MAX = 7;
  const coarse = window.matchMedia('(pointer: coarse)');
  // Which kind of pointer started the current gesture: a mouse on a touch laptop keeps the
  // desktop behaviour, a finger on the same machine gets the touch one.
  let lastTouch = coarse.matches;
  document.addEventListener('pointerdown', function (e) { lastTouch = e.pointerType !== 'mouse'; }, true);

  // A phone is a coarse pointer on a small screen. Portrait gets the "turn sideways" gate:
  // the table is wide by nature, and a second, portrait layout would be a second design.
  function classify() {
    const h = document.documentElement, W = window.innerWidth, H = window.innerHeight;
    const phone = coarse.matches && Math.min(W, H) <= 540;
    h.classList.toggle('is-coarse', coarse.matches);
    h.classList.toggle('is-phone', phone);
    h.classList.toggle('is-portrait', H > W);
    if (!phone) lowerHand();
  }

  // The fan overlaps by layout, not by count: measure once with a forced read (never rAF,
  // which stalls in a background tab), as js/ui/game.js does after each render.
  function measureHand() {
    const node = $('hand');
    if (!node) return;
    const cards = node.children;
    const over = cards.length > 1 && cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left <
      cards[0].getBoundingClientRect().width - 1;
    node.classList.toggle('is-fanned', over);
  }
  function raiseHand() {
    if (document.body.classList.contains('hand-raised')) return;
    document.body.classList.add('hand-raised');
    measureHand();
  }
  function lowerHand() {
    if (!document.body.classList.contains('hand-raised')) return;
    document.body.classList.remove('hand-raised');
    measureHand();
  }

  // Recently played, newest on top: the table's memory, one tap from the full card.
  function renderHistory(s) {
    const node = $('history');
    if (!node) return;
    node.textContent = '';
    const out = [];
    for (let i = s.log.length - 1; i >= 0 && out.length < HISTORY_MAX; i--) {
      const l = s.log[i];
      if (l.type === 'play' && s.cards[l.iid]) out.push(l);
    }
    out.forEach(function (l) {
      const id = s.cards[l.iid].id;
      const wrap = el('div', 'history-card' + (l.who === LC.ui.viewSeat ? ' mine' : ' theirs'));
      const face = LC.renderCard(id, { size: 'board' });
      wrap.appendChild(face);
      wrap.onclick = function () { LC.inspector.open(id, null); };
      node.appendChild(wrap);
    });
  }

  function init() {
    classify();
    window.addEventListener('resize', classify);
    window.addEventListener('orientationchange', classify);
    const scrim = $('hand-scrim');
    if (!scrim) throw new Error('touch: index.html is missing #hand-scrim');
    scrim.addEventListener('click', lowerHand);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  LC.touch = {
    active: function () { return lastTouch; },
    phone: function () { return document.documentElement.classList.contains('is-phone'); },
    handRaised: function () { return document.body.classList.contains('hand-raised'); },
    raiseHand: raiseHand,
    lowerHand: lowerHand,
    renderHistory: renderHistory,
  };
})();
