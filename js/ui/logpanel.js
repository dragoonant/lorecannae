// js/ui/logpanel.js — what answers "what just happened?" (PRESENTATION-REFERENCE A7):
// the prompt line (what the game wants NOW), the recently-played strip (real faces,
// because a log line is not a card), and the log (newest first, 60-entry window, card
// names as hover doorways, triggered lines indented under the card that spoke).
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;
  const WINDOW = 60, RECENT_MAX = 5;

  function cardRef(seg) {
    const r = el('span', 'card-ref', seg.name);
    r.dataset.cardId = seg.cardId;
    r.dataset.iid = seg.iid;
    r.tabIndex = 0;
    return r;
  }

  function line(s, e) {
    const div = el('div', 'log-line log-' + e.type);
    if (LC.logText.isDivider(e)) div.classList.add('log-divider');
    if (e.notice || e.type === 'fizzle') div.classList.add('log-notice');
    const segs = LC.logText.segments(e, s);
    if (!segs) { div.textContent = '(unphrased ' + e.type + ')'; div.classList.add('log-missing'); return div; }
    // A line with `via` is the work of a card's ability, not a move its controller made.
    // Printed flat it reads as another action; indented and prefixed with the card that
    // spoke, it reads as a consequence.
    if (e.via != null && s.cards[e.via]) {
      div.classList.add('log-via');
      const subjectIsVia = segs.some(function (x) { return typeof x === 'object' && x.iid === e.via; });
      if (!subjectIsVia && e.type !== 'ability') {
        const src = el('span', 'log-via-src', LC.CARDS[s.cards[e.via].id].name);
        src.dataset.cardId = s.cards[e.via].id;
        src.dataset.iid = e.via;
        div.appendChild(src);
        div.appendChild(document.createTextNode(' '));
      }
    }
    segs.forEach(function (x) {
      if (typeof x === 'string') div.appendChild(document.createTextNode(x));
      else if (x && x.cardId) div.appendChild(cardRef(x));
    });
    return div;
  }

  function renderLog(s) {
    const node = $('log');
    node.textContent = '';
    const entries = s.log.slice(-WINDOW);
    for (let i = entries.length - 1; i >= 0; i--) {
      let e = entries[i];
      if (e.silent) continue;
      // A quest and the lore it gained are one event: fold the running total into the
      // quest line instead of printing "gains 2 lore" under every quest.
      if (e.type === 'lore' && i > 0 && entries[i - 1].type === 'quest' && entries[i - 1].who === e.who &&
          entries[i - 1].lore === e.amount && !e.via) continue;
      if (e.type === 'quest' && entries[i + 1] && entries[i + 1].type === 'lore' && entries[i + 1].who === e.who &&
          entries[i + 1].amount === e.lore && !entries[i + 1].via) e = Object.assign({}, e, { total: entries[i + 1].total });
      if (e.type === 'draw' && e.turn === 0) continue;   // opening deal: one line, not fourteen
      node.appendChild(line(s, e));
    }
  }

  function renderRecent(s) {
    const node = $('recent');
    node.textContent = '';
    const out = [];
    for (let i = s.log.length - 1; i >= 0 && out.length < RECENT_MAX; i--) {
      const l = s.log[i];
      if (l.type === 'play' && s.cards[l.iid]) out.push(l);
    }
    if (!out.length) { node.appendChild(el('div', 'recent-empty', 'Nothing played yet.')); return; }
    out.forEach(function (l) {
      const wrap = el('div', 'recent-card' + (l.who === LC.ui.viewSeat ? ' mine' : ' theirs'));
      const face = LC.renderCard(s.cards[l.iid].id, { size: 'board' });
      face.tabIndex = 0;
      wrap.appendChild(face);
      node.appendChild(wrap);
    });
  }

  LC.logPanel = {
    render: function (s, prompt) {
      const p = $('prompt');
      p.textContent = prompt.text;
      p.className = 'prompt ' + (prompt.cls || '');
      renderRecent(s);
      renderLog(s);
    },
  };
})();
