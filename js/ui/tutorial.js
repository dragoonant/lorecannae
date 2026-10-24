// js/ui/tutorial.js — a guided vs-AI game (PLAN.md D5). Coach bubbles are triggered by
// game SITUATIONS (not by a script of turns), each shown once, pointing at the part of
// the table it explains. Skippable at any time; never blocks a click on the board.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  let on = false, shown = {}, current = null;

  function mine(s) { return s.active === 0 && s.phase === 'main' && !s.ask; }
  function has(acts, pred) { return acts.some(pred); }
  function typeOf(s, iid) { return U.mainType(LC.CARDS[s.cards[iid].id]); }

  // Order matters: the first unshown step whose predicate holds is the one shown.
  const STEPS = [
    { id: 'mulligan', anchor: 'hand-bar',
      when: function (s) { return s.ask && s.ask.kind === 'mulligan' && s.ask.who === 0; },
      text: 'Welcome! This is your opening hand of 7. You may put any cards you don’t want on the bottom of your deck and draw that many. A good hand has a few cheap characters and several cards with the gold ring around their cost (inkable).' },
    { id: 'ink', anchor: 'my-ink',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'ink'; }); },
      text: 'Ink is how you pay for cards. Once per turn, drag one card with a gold ring around its cost onto your inkwell. It goes face down and gives you 1 ink every turn from now on.' },
    { id: 'play', anchor: 'my-play',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'play' && a.pay === 'ink' && typeOf(s, a.iid) === 'character'; }); },
      text: 'Now play a character: drag a glowing card from your hand onto your play area. Its cost (the hexagon) is paid by exerting that many of your ready ink.' },
    { id: 'drying', anchor: 'my-play',
      when: function (s) { return mine(s) && s.players[0].play.some(function (i) { return s.cards[i].zone === 'play' && LC.chars(s, i).drying; }); },
      text: 'Characters arrive “drying” (the shimmer): they can’t quest or challenge until your next turn. When you have nothing else to do, click End turn.' },
    { id: 'opponent', anchor: 'log-handle',
      when: function (s) { return s.active === 1 && s.phase === 'main'; },
      text: 'The opponent’s turn. Everything they do is spotlighted and written in the log — open the drawer on the right edge any time. Hover any card to read it.' },
    { id: 'quest', anchor: 'my-lore',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'quest'; }); },
      text: 'Questing earns lore. Drag a ready character onto your lore track (or tap it and choose Quest). It exerts — turns sideways — and you gain its ◆ lore. First to 20 wins!' },
    { id: 'challenge', anchor: 'enemy-play',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'challenge'; }); },
      text: 'A rival character is exerted, so it can be challenged. Drag your ready character onto it. Both deal damage equal to their strength (⚔) at the same time; damage equal to willpower (shield) banishes a character.' },
    { id: 'song', anchor: 'hand',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'play' && (a.pay === 'sing' || a.pay === 'singTogether'); }); },
      text: 'You hold a song you can sing! Instead of paying ink, drag it onto a ready character whose cost is at least the song’s cost: that character exerts and the song is free.' },
    { id: 'item', anchor: 'my-items',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'play' && typeOf(s, a.iid) === 'item'; }); },
      text: 'Items stay in play in their own lane. Many have abilities: tap the item once it is in play to see what it can do.' },
    { id: 'exposed', anchor: 'my-play',
      when: function (s) { return s.active === 0 && s.phase === 'main' && s.players[0].play.some(function (i) { return s.cards[i].exerted && typeOf(s, i) === 'character'; }); },
      text: 'Careful: exerted characters can be challenged on the opponent’s turn. Questing is a trade between lore now and keeping your characters safe.' },
    { id: 'race', anchor: 'enemy-lore',
      when: function (s) { return Math.max(s.players[0].lore, s.players[1].lore) >= 10; },
      text: 'Someone is halfway there. The lore tracks warm to gold from 16. Watch the opponent’s track and challenge their best questers before they get to 20.' },
  ];

  function bubble(step) {
    let b = $('coach');
    b.textContent = '';
    b.appendChild(el('div', 'coach-title', 'Tutorial'));
    b.appendChild(el('div', 'coach-text', step.text));
    const row = el('div', 'coach-buttons');
    const ok = el('button', 'action-btn', 'Got it');
    ok.onclick = function () { hide(); };
    const skip = el('button', null, 'Skip tutorial');
    skip.onclick = function () { LC.tutorial.end(); };
    row.appendChild(ok); row.appendChild(skip);
    b.appendChild(row);
    b.classList.add('open');
    const a = $(step.anchor);
    const r = a && a.getBoundingClientRect();
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let left = window.innerWidth / 2 - bw / 2, top = window.innerHeight * 0.3;
    if (r && r.width) {
      left = Math.max(10, Math.min(r.left + r.width / 2 - bw / 2, window.innerWidth - bw - 10));
      top = r.top - bh - 14;
      if (top < 10) top = Math.min(window.innerHeight - bh - 10, r.bottom + 14);
    }
    top = Math.max(10, Math.min(top, window.innerHeight - bh - 10));
    b.style.left = left + 'px'; b.style.top = top + 'px';
    current = step.id;
  }
  function hide() { const b = $('coach'); if (b) b.classList.remove('open'); current = null; LC.ui.render(); }

  LC.tutorial = {
    begin: function () { on = true; shown = {}; current = null; },
    end: function () { on = false; current = null; const b = $('coach'); if (b) b.classList.remove('open'); },
    active: function () { return on; },
    onRender: function (s, acts) {
      if (!on || LC.isTerminal(s)) { if (LC.isTerminal(s)) LC.tutorial.end(); return; }
      if (current) return;                     // one bubble at a time; it waits for "Got it"
      for (let i = 0; i < STEPS.length; i++) {
        const st = STEPS[i];
        if (shown[st.id]) continue;
        let ok = false;
        try { ok = st.when(s, acts); } catch (e) { ok = false; }
        if (ok) {
          shown[st.id] = true;
          current = st.id;                       // reserve the slot; the bubble lands a beat later
          setTimeout(function () { if (on && current === st.id) bubble(st); }, 450);
          return;
        }
      }
    },
  };
})();
