// js/ui/targeting.js — how the game ASKS (PRESENTATION-REFERENCE A6, kb/LESSONS-DIGEST
// §4.6). The question lives on the state (`s.ask`); this file decides how to show it and
// builds the answer value — it never answers by itself. No auto-pick, ever: one
// candidate or fifty, the player is asked (CLAUDE.md rule 4).
//
// Three interfaces, chosen in code from what the player can SEE:
//   candidates are cards the board draws  -> highlight in place, click the real card
//   candidates the board does not draw    -> centred panel of real faces (all of `seen`,
//                                            non-candidates dimmed)
//   not cards (yes/no, modes, bag order)  -> buttons that say what they do
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  // ---- view-layer state (never game state; never in undo) -------------------------
  let picks = [];          // iids picked so far for the open cards/mulligan/order ask
  let picksKey = null;     // the ask those picks belong to
  let peekedKey = null;    // the ask currently hidden by Peek

  function askKey(ask) {
    return [ask.kind, ask.who, ask.src, ask.prompt, (ask.from || []).join(','), ask.min, ask.max,
      (ask.options || []).map(function (o) { return o.id != null ? o.id : o.label; }).join('|')].join('#');
  }
  function syncPicks(ask) {
    const k = askKey(ask);
    if (k !== picksKey) { picksKey = k; picks = []; }
    return k;
  }
  function srcName(s, ask) {
    if (ask.src == null || !s.cards[ask.src]) return null;
    return LC.fullName(LC.CARDS[s.cards[ask.src].id]);
  }
  // Name the source card in front of the prompt unless the prompt already starts with it.
  function withSrc(src, prompt) {
    if (!src) return prompt;
    const short = src.split(' - ')[0];
    if (prompt.indexOf(short) === 0) return prompt;
    return src + ': ' + prompt;
  }
  function nameOf(s, iid) { const c = s.cards[iid]; return c ? LC.fullName(LC.CARDS[c.id]) : '?'; }

  // Is every card this ask is about already drawn on the board, face up?
  // How to answer a board question, in the words of the pointer in use.
  function boardHow(a) {
    const t = LC.touch.active();
    if (a.max > 1) return (t ? ' Tap' : ' Click') + ' the highlighted cards, then Confirm.';
    return t ? ' Tap a highlighted card, then Confirm.' : ' Click a highlighted card.';
  }
  function onBoard(s, ask) {
    const seen = (ask.seen && ask.seen.length) ? ask.seen : (ask.from || []);
    if (!seen.length) return false;
    return seen.every(function (iid) { const c = s.cards[iid]; return c && c.zone === 'play'; });
  }

  LC.asks = {
    // How this ask is shown: 'board' | 'panel' | 'buttons' | null (no ask)
    mode: function (s) {
      const a = s.ask;
      if (!a) return null;
      if (a.kind === 'yesno' || a.kind === 'mode' || a.kind === 'bag') return 'buttons';
      if (a.kind === 'mulligan') return 'panel';
      return onBoard(s, a) ? 'board' : 'panel';
    },
    picks: function () { return picks.slice(); },
    isCandidate: function (s, iid) {
      return !!(s.ask && (s.ask.kind === 'cards' || s.ask.kind === 'order' || s.ask.kind === 'mulligan') &&
        (s.ask.from || []).indexOf(iid) >= 0);
    },
    isPicked: function (iid) { return picks.indexOf(iid) >= 0; },
    // A click on a candidate (board or panel). Single-pick asks with min 1 answer on the
    // click itself — the click IS the player's choice, nothing was assumed. A finger is
    // less sure than a mouse, so on touch the pick waits for Confirm (PLAN.md D18).
    toggle: function (s, iid, answer) {
      const a = s.ask;
      syncPicks(a);
      if (!LC.asks.isCandidate(s, iid)) return;
      const at = picks.indexOf(iid);
      if (at >= 0) { picks.splice(at, 1); LC.ui.render(); return; }
      if (a.max === 1 && a.min === 1 && a.kind !== 'mulligan' && !LC.touch.active()) { picks = []; peekedKey = null; answer([iid]); return; }
      if (picks.length >= a.max) {
        if (a.max === 1) picks = [iid];      // swap the single pick rather than refuse
        else { flash('Already ' + a.max + ' selected — click one to unselect it.'); return; }
      } else picks.push(iid);
      LC.ui.render();
    },
    // The prompt line: the card says WHAT (the engine's prompt), the UI appends HOW.
    promptLine: function (s, viewer, acting, names) {
      if (LC.isTerminal(s)) return { text: 'Game over.', cls: 'over' };
      const a = s.ask;
      if (acting !== viewer) {
        if (a) return { text: 'Waiting for ' + names[acting] + ' to choose…', cls: 'waiting' };
        return { text: 'Waiting for ' + names[acting] + '…', cls: 'waiting' };
      }
      if (a) {
        const src = srcName(s, a);
        let text = withSrc(src, a.prompt);
        const m = LC.asks.mode(s);
        if (m === 'board') text += boardHow(a);
        else if (m === 'panel') text += a.max > 1 || a.kind === 'mulligan' ? ' Pick from the cards shown, then Confirm.' : ' Pick one of the cards shown.';
        return { text: text, cls: 'asking' };
      }
      return { text: 'Drag a card to your inkwell or play area, drag a character to your lore track to quest or onto an exerted rival to challenge — or tap a card for its options.', cls: '' };
    },
    reset: function () { picks = []; picksKey = null; peekedKey = null; },
  };

  function flash(text) {
    const n = $('choice-flash');
    if (!n) return;
    n.textContent = text;
    n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
  }

  // ---- the panel and its peek -------------------------------------------------------
  // Anchored over the two play areas, no scrim and no blur: the board must stay readable
  // around a question about it. The inkwells, piles, lore tracks and hand stay visible.
  function playBox() {
    const a = $('my-play'), b = $('enemy-play');
    if (!a || !b) return null;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const left = Math.min(r1.left, r2.left), right = Math.max(r1.right, r2.right);
    const top = Math.min(r1.top, r2.top), bottom = Math.max(r1.bottom, r2.bottom);
    if (right <= left || bottom <= top) return null;
    return { left: left, right: right, top: top, bottom: bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }
  function position(modal) {
    const content = modal.querySelector('.choice-modal-content');
    if (!content) return;
    const box = playBox();
    content.style.left = box ? box.cx + 'px' : '';
    // Centred on the play areas, but never pushed off the top or bottom of a short window.
    const h = content.offsetHeight, H = window.innerHeight;
    let cy = box ? box.cy : H / 2;
    cy = Math.max(h / 2 + 6, Math.min(cy, H - h / 2 - 6));
    if (h >= H - 12) cy = H / 2;
    content.style.top = cy + 'px';
  }
  window.addEventListener('resize', function () {
    const m = $('choice-modal');
    if (m && m.classList.contains('open')) position(m);
    const p = $('play-prompt');
    if (p && p.classList.contains('open')) { const b = playBox(); if (b) { p.style.left = b.cx + 'px'; p.style.top = b.cy + 'px'; } }
  });

  function setPeek(on) {
    const modal = $('choice-modal');
    if (!modal) return;
    modal.classList.toggle('peek', on);
    peekedKey = on ? modal.dataset.choiceKey : null;
    const echo = $('play-prompt');
    if (echo && echo.textContent) {
      const box = on ? playBox() : null;
      if (box) { echo.style.left = box.cx + 'px'; echo.style.top = box.cy + 'px'; }
      echo.classList.toggle('open', on && !!box);
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const modal = $('choice-modal');
    if (!modal || !modal.classList.contains('open')) return;
    if (LC.zoneBrowser.isOpen()) return;          // Esc closes the browser first
    e.preventDefault();
    setPeek(!modal.classList.contains('peek'));
  });

  // The centre echo: the question, said where the player is already looking.
  LC.asks.renderEcho = function (text, show) {
    let node = $('play-prompt');
    if (!node) { node = el('div'); node.id = 'play-prompt'; document.body.appendChild(node); }
    if (text != null && node.textContent !== text) node.textContent = text;
    const box = show ? playBox() : null;
    if (!show || !box) { node.classList.remove('open'); return; }
    node.style.left = box.cx + 'px';
    node.style.top = box.cy + 'px';
    node.style.maxWidth = Math.max(180, (box.right - box.left) * 0.7) + 'px';
    node.classList.add('open');
  };

  function closeModal() {
    const modal = $('choice-modal');
    if (!modal) return;
    modal.classList.remove('open', 'peek');
    modal.dataset.choiceKey = '';
    modal.textContent = '';
  }
  LC.asks.closeModal = closeModal;

  function openModal(key, nodes, restoreLabel) {
    const modal = $('choice-modal');
    modal.textContent = '';
    modal.dataset.choiceKey = key;
    const content = el('div', 'choice-modal-content');
    nodes.forEach(function (n) { content.appendChild(n); });
    const hide = el('button', 'peek-btn', 'Hide — check the board');
    hide.onclick = function () { setPeek(true); };
    const ctl = el('div', 'choice-modal-controls choice-peek-row');
    ctl.appendChild(hide);
    content.appendChild(ctl);
    modal.appendChild(content);
    const restore = el('button', 'choice-peek-restore', restoreLabel || 'Show the choices');
    restore.onclick = function () { setPeek(false); };
    modal.appendChild(restore);
    modal.classList.add('open');
    position(modal);
    setPeek(peekedKey === key);
  }

  function sourceFace(s, ask) {
    if (ask.src == null || !s.cards[ask.src]) return null;
    const wrap = el('div', 'choice-source');
    wrap.appendChild(el('div', 'choice-source-label', 'Asked by'));
    const face = LC.renderCard(s.cards[ask.src].zone === 'play' ? ask.src : s.cards[ask.src].id,
      { size: 'board', state: s.cards[ask.src].zone === 'play' ? s : null });
    face.classList.add('choice-source-card');
    wrap.appendChild(face);
    return wrap;
  }

  function header(s, ask, nodes) {
    const src = srcName(s, ask);
    nodes.push(el('div', 'choice-modal-prompt', withSrc(src, ask.prompt)));
  }

  // Count line: "2 of 0–3 selected" — the numbers the player needs, nothing else.
  function countText(a) {
    const range = a.min === a.max ? String(a.max) : a.min + '–' + a.max;
    let t = picks.length + ' of ' + range + ' selected';
    // Sing Together: the running total of the singers' cost, from the engine (singCost).
    if (a.sumCostMin) t += ' · total cost ' + sumCost() + ' of ' + a.sumCostMin + ' needed';
    return t;
  }
  function sumCost() {
    const s = LC.ui.state;
    return picks.reduce(function (n, i) { return n + LC.chars(s, i).singCost; }, 0);
  }

  // Confirm / Clear / Choose none controls for a multi-pick (and single with min 0).
  function pickControls(s, a, answer, inBar) {
    const row = el('div', inBar ? 'choice-bar-controls' : 'choice-modal-controls');
    if (a.max > 1 || a.kind === 'mulligan' || a.kind === 'order') {
      row.appendChild(el('span', 'choice-count', countText(a)));
    }
    let confirmLabel = 'Confirm';
    if (a.kind === 'mulligan') confirmLabel = picks.length ? 'Put ' + picks.length + ' on the bottom and draw ' + picks.length : 'Keep this hand';
    else if (a.kind === 'order') confirmLabel = 'Confirm this order';
    else if (picks.length === 0 && a.min === 0) confirmLabel = null;
    if (a.max > 1 || a.kind === 'mulligan' || a.kind === 'order' || (a.max === 1 && picks.length)) {
      if (confirmLabel) {
        const ok = el('button', 'action-btn choice-confirm', confirmLabel);
        ok.disabled = picks.length < a.min || picks.length > a.max || (a.sumCostMin && sumCost() < a.sumCostMin);
        if (ok.disabled) ok.setAttribute('data-tip', a.sumCostMin ? 'Choose singers with total cost ' + a.sumCostMin + ' or more.' : 'Choose at least ' + a.min + '.');
        ok.onclick = function () { const v = picks.slice(); picks = []; peekedKey = null; answer(v); };
        row.appendChild(ok);
      }
      if (picks.length && a.kind !== 'mulligan') {
        const clr = el('button', null, 'Clear');
        clr.onclick = function () { picks = []; LC.ui.render(); };
        row.appendChild(clr);
      }
    }
    if (a.min === 0 && a.kind !== 'mulligan' && picks.length === 0) {
      const none = el('button', 'action-btn', a.max === 1 ? 'Choose none' : 'Choose none');
      none.setAttribute('data-tip', 'Answer with no cards: the effect does nothing for this choice.');
      none.onclick = function () { picks = []; peekedKey = null; answer([]); };
      row.appendChild(none);
    }
    return row;
  }

  // ---- the renderers ----------------------------------------------------------------
  // Called by js/ui/game.js on every render. Returns true when the modal owns input.
  LC.asks.render = function (s, viewer, acting, answer) {
    const a = s.ask;
    const bar = $('choice-bar');
    if (!a || acting !== viewer || LC.isTerminal(s)) {
      closeModal();
      if (bar && bar.dataset.owner === 'ask') { bar.textContent = ''; bar.classList.remove('open'); bar.dataset.owner = ''; }
      return false;
    }
    const key = syncPicks(a);
    const mode = LC.asks.mode(s);

    if (mode === 'board') {
      closeModal();
      // Controls ride in the choice bar under the board; the cards are the board's own.
      bar.textContent = '';
      bar.dataset.owner = 'ask';
      const src = srcName(s, a);
      bar.appendChild(el('span', 'choice-bar-prompt', withSrc(src, a.prompt) +
        boardHow(a)));
      const needs = a.max > 1 || a.min === 0 || picks.length > 0;
      if (needs) bar.appendChild(pickControls(s, a, answer, true));
      bar.appendChild(el('span', 'choice-flash', '')).id = 'choice-flash';
      bar.classList.add('open');
      return false;
    }
    if (bar && bar.dataset.owner === 'ask') { bar.textContent = ''; bar.classList.remove('open'); bar.dataset.owner = ''; }

    const nodes = [];
    header(s, a, nodes);
    if (mode === 'buttons') {
      const body = el('div', 'choice-body');
      const sf = sourceFace(s, a);
      if (sf) body.appendChild(sf);
      const btns = el('div', 'choice-modal-buttons');
      if (a.kind === 'yesno') {
        const y = el('button', 'action-btn', a.yes || 'Yes');
        y.onclick = function () { peekedKey = null; answer(true); };
        const n = el('button', 'action-btn is-secondary', a.no || 'No');
        n.onclick = function () { peekedKey = null; answer(false); };
        btns.appendChild(y); btns.appendChild(n);
      } else if (a.kind === 'mode') {
        (a.options || []).forEach(function (o, i) {
          const b = el('button', 'action-btn', o.label);
          b.disabled = o.enabled === false;
          if (b.disabled) b.setAttribute('data-tip', 'Not possible right now.');
          b.onclick = function () { peekedKey = null; answer(i); };
          btns.appendChild(b);
        });
      } else if (a.kind === 'bag') {
        nodes.push(el('div', 'choice-modal-hint', 'Several of your abilities triggered at once. Choose which resolves first; the rest follow.'));
        (a.options || []).forEach(function (o) {
          const row = el('div', 'bag-option');
          if (o.src != null && s.cards[o.src]) {
            const face = LC.renderCard(s.cards[o.src].zone === 'play' ? o.src : s.cards[o.src].id,
              { size: 'board', state: s.cards[o.src].zone === 'play' ? s : null });
            face.classList.add('bag-face');
            row.appendChild(face);
          }
          const b = el('button', 'action-btn', 'Resolve first: ' + (o.src != null ? nameOf(s, o.src) + ' — ' : '') + (o.name || 'ability'));
          b.onclick = function () { peekedKey = null; answer(o.id); };
          b.addEventListener('mouseenter', function () { LC.ui.hint(o.src); });
          b.addEventListener('mouseleave', function () { LC.ui.hint(null); });
          row.appendChild(b);
          btns.appendChild(row);
        });
      }
      body.appendChild(btns);
      nodes.push(body);
      openModal(key, nodes);
      return true;
    }

    // panel of faces: every card in `seen` shown, the non-candidates dimmed.
    const seen = (a.seen && a.seen.length) ? a.seen.slice() : (a.from || []).slice();
    (a.from || []).forEach(function (i) { if (seen.indexOf(i) < 0) seen.push(i); });
    if (a.kind === 'mulligan') {
      nodes.push(el('div', 'choice-modal-hint', 'Alter hand: choose any number of cards to put on the bottom of your deck; you draw that many. Choose none to keep this hand.'));
    } else if (seen.length > (a.from || []).length) {
      nodes.push(el('div', 'choice-modal-hint', 'You are looking at ' + seen.length + ' cards. Dimmed ones can’t be chosen.'));
    }
    const cards = el('div', 'choice-modal-cards');
    seen.forEach(function (iid) {
      const c = s.cards[iid];
      if (!c) return;
      const ok = (a.from || []).indexOf(iid) >= 0;
      const wrap = el('div', 'choice-option' + (ok ? '' : ' is-dim'));
      const face = LC.renderCard(c.zone === 'play' ? iid : c.id, { size: 'hand', state: c.zone === 'play' ? s : null });
      face.dataset.iid = iid;
      if (ok) face.classList.add('role-target');
      const at = picks.indexOf(iid);
      if (at >= 0) {
        face.classList.add('role-picked');
        if (a.kind === 'order') wrap.appendChild(el('div', 'pick-ordinal', String(at + 1)));
        else wrap.appendChild(el('div', 'pick-ordinal', '✓'));
      }
      wrap.appendChild(face);
      wrap.appendChild(el('div', 'choice-zone', c.owner === viewer ? 'your ' + c.zone : 'their ' + c.zone));
      if (ok) {
        wrap.tabIndex = 0;
        wrap.onclick = function () { LC.asks.toggle(s, iid, answer); };
        wrap.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); LC.asks.toggle(s, iid, answer); } };
      }
      cards.appendChild(wrap);
    });
    nodes.push(cards);
    nodes.push(pickControls(s, a, answer, false));
    const fl = el('div', 'choice-flash'); fl.id = 'choice-flash';
    nodes.push(fl);
    openModal(key, nodes, 'Show the cards');
    return true;
  };

  // ---- the arrow (challenge aim / declared) -------------------------------------------
  const NS = 'http://www.w3.org/2000/svg';
  function layer() {
    let svg = $('arrow-layer');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.id = 'arrow-layer';
      document.body.appendChild(svg);
    }
    return svg;
  }
  // Bowed sideways on purpose: the board's dividers run horizontally and vertically, so
  // a straight arrow reads as one more line.
  function bowOf(from, to) { return Math.min(120, Math.abs(to.y - from.y) * 0.45) + 20; }
  LC.arrow = {
    // kind: 'aim' (amber, still a proposal) | 'declared' (red) | 'quest' (gold)
    draw: function (from, to, kind) {
      const svg = layer();
      svg.textContent = '';
      svg.classList.add('open');
      const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2, bow = bowOf(from, to);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'attack-arrow is-' + kind);
      p.setAttribute('d', 'M' + from.x + ',' + from.y + ' Q' + (midX + bow) + ',' + midY + ' ' + to.x + ',' + to.y);
      p.style.animationDelay = U.animationPhase(700);
      svg.appendChild(p);
      const head = document.createElementNS(NS, 'path');
      head.setAttribute('class', 'attack-arrow-head is-' + kind);
      const ang = Math.atan2(to.y - midY, to.x - (midX + bow));
      const size = 13;
      const pts = [[to.x, to.y],
        [to.x - size * Math.cos(ang - 0.42), to.y - size * Math.sin(ang - 0.42)],
        [to.x - size * Math.cos(ang + 0.42), to.y - size * Math.sin(ang + 0.42)]];
      head.setAttribute('d', 'M' + pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' L') + ' z');
      svg.appendChild(head);
    },
    clear: function () { const svg = $('arrow-layer'); if (svg) { svg.textContent = ''; svg.classList.remove('open'); } },
    centreOf: function (node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  };
})();
