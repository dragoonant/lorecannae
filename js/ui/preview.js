// js/ui/preview.js — the enlargements (PRESENTATION-REFERENCE A4): hover preview,
// inspector (tap / long-press), spotlight of every played card, and the read-only zone
// browser. Deliberately not interchangeable: the preview follows the pointer, the
// inspector is a place you go, the spotlight is the game telling you something.
//
// The hover preview is ONE delegated listener on the document keyed on data-card-id
// (kb/LESSONS-DIGEST §4.1): face-down cards never carry that attribute, so they can
// never be previewed, and every later modal, log line or browser gets hover for free.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el;

  const OPEN_DELAY_MS = 300;      // 90 chased the pointer; 1000 felt like waiting
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_SLOP_PX = 10;
  const GAP = 12;

  function ensure(id, cls) {
    let n = document.getElementById(id);
    if (!n) { n = el('div', cls || null); n.id = id; document.body.appendChild(n); }
    return n;
  }

  function liveState() { return LC.ui && LC.ui.state ? LC.ui.state : null; }

  // The preview row: card at preview size, then side panels (why-not, cards under,
  // keyword glossary). `iid` is resolved against the CURRENT state at open time.
  function buildRow(cardId, iid, state) {
    const row = el('div', 'preview-row');
    const inst = (iid != null && state && state.cards[iid]) ? state.cards[iid] : null;
    const ref = inst ? iid : cardId;
    const main = LC.renderCard(ref, { size: 'preview', state: inst ? state : null });
    // The preview is ALWAYS upright (PLAN.md D11), whatever the board slot does.
    main.classList.remove('is-exerted');
    row.appendChild(main);
    const sides = el('div', 'preview-sides');

    // Why this hand card can't be played right now — said before the first click.
    if (inst && state && inst.zone === 'hand' && LC.ui && inst.owner === LC.ui.viewSeat &&
        state.phase === 'main' && !state.ask && LC.whoActs(state) === inst.owner) {
      const why = LC.whyNot(state, iid);
      if (why) {
        const p = el('div', 'preview-side preview-why');
        p.appendChild(el('div', 'preview-side-title', 'Can’t play it now'));
        p.appendChild(el('div', 'why-text', why));
        sides.appendChild(p);
      }
    }
    if (inst && state && inst.zone === 'play') {
      const c = LC.chars(state, iid);
      const notes = [];
      if (c.drying) notes.push('Drying: it arrived this turn, so it can’t quest or challenge yet.');
      if (c.exerted) notes.push('Exerted: it has quested, challenged, sung or been exerted. It readies at the start of its owner’s turn.');
      if (notes.length) {
        const p = el('div', 'preview-side preview-state');
        p.appendChild(el('div', 'preview-side-title', 'Right now'));
        notes.forEach(function (t) { p.appendChild(el('div', 'state-text', t)); });
        sides.appendChild(p);
      }
    }
    // Shift / Boost stacks: what is under this card (A3 "linked pilot" slot).
    if (inst && inst.under && inst.under.length && state) {
      const p = el('div', 'preview-side preview-under');
      p.appendChild(el('div', 'preview-side-title', 'Cards under it (' + inst.under.length + ')'));
      const stack = el('div', 'preview-under-stack');
      inst.under.forEach(function (u) {
        const c = state.cards[u];
        const face = c && !c.facedown;
        stack.appendChild(LC.renderCard(face ? c.id : u, { size: 'board', hidden: !face }));
      });
      p.appendChild(stack);
      sides.appendChild(p);
    }
    const gloss = LC.cardGlossary(cardId, inst, inst ? state : null);
    if (gloss.length) {
      const p = el('div', 'preview-side preview-glossary');
      p.appendChild(el('div', 'preview-side-title', 'Keywords'));
      gloss.forEach(function (g) {
        const r = el('div', 'kw-row');
        r.appendChild(el('span', 'kw-name', g.name));
        r.appendChild(el('span', 'kw-text', g.text));
        p.appendChild(r);
      });
      sides.appendChild(p);
    }
    if (sides.childNodes.length) row.appendChild(sides);
    return { row: row, main: main };
  }

  // ---- A. hover preview --------------------------------------------------------
  let hoverTimer = null, previewFor = null, anchor = null;

  const Preview = LC.preview = {
    face: function (cardId, iid, state) { return buildRow(cardId, iid, state).row; },
    show: function (anchorEl, cardId, iid) {
      const state = liveState();
      const key = (iid != null ? 'i' + iid : 'd') + '|' + cardId;
      const box = ensure('preview');
      if (previewFor === key && box.classList.contains('open')) return;
      previewFor = key;
      box.textContent = '';
      const built = buildRow(cardId, iid, state);
      box.appendChild(built.row);
      box.classList.add('open');
      box.classList.remove('grown');
      // Centre the MAIN card on the anchor, not the whole row; clamp to the viewport.
      const rect = anchorEl.getBoundingClientRect();
      const bw = box.offsetWidth, bh = box.offsetHeight;
      const mainMid = built.main.offsetLeft + built.main.offsetWidth / 2;
      let left = rect.left + rect.width / 2 - mainMid;
      left = Math.max(GAP, Math.min(left, window.innerWidth - bw - GAP));
      let top = rect.top + rect.height / 2 - bh / 2;
      top = Math.max(GAP, Math.min(top, window.innerHeight - bh - GAP));
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.transformOrigin = mainMid + 'px 50%';
      // Two nested rAFs so the browser commits the start scale before growing; if the
      // tab is in the background they simply never fire and the box stays at its start
      // state, which is invisible — harmless, unlike a stranded spotlight.
      requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('grown'); }); });
    },
    hide: function () {
      clearTimeout(hoverTimer);
      previewFor = null; anchor = null;
      const box = document.getElementById('preview');
      if (box) box.classList.remove('open', 'grown');
    },
    // Forget the cached key so the next hover rebuilds (live numbers changed).
    invalidate: function () { previewFor = null; },
  };

  function cardTarget(node) {
    if (!node || !node.closest) return null;
    if (node.closest('#preview')) return null;
    const t = node.closest('[data-card-id]');
    if (!t || t.closest('.no-preview')) return null;
    return t;
  }
  function arm(t) {
    clearTimeout(hoverTimer);
    anchor = t;
    hoverTimer = setTimeout(function () {
      if (LC.drag && LC.drag.active()) return;          // never while dragging
      if (!t.isConnected) return;
      const iid = t.dataset.iid != null ? (isNaN(t.dataset.iid) ? t.dataset.iid : Number(t.dataset.iid)) : null;
      Preview.show(t, t.dataset.cardId, iid);
    }, OPEN_DELAY_MS);
  }
  document.addEventListener('mouseover', function (e) {
    const t = cardTarget(e.target);
    if (t === anchor) return;
    if (!t) { Preview.hide(); return; }
    arm(t);
  });
  document.addEventListener('mouseleave', function () { Preview.hide(); });
  document.addEventListener('focusin', function (e) { const t = cardTarget(e.target); if (t) arm(t); });
  document.addEventListener('focusout', function () { Preview.hide(); });
  // A press starts a gesture; the preview must not sit over the drop targets.
  document.addEventListener('pointerdown', function () { Preview.hide(); }, true);

  // ---- long press: the touch stand-in for hover -----------------------------------
  // Touch/pen only, distance beats time: drift past the slop hands the gesture back to
  // the drag (which is the one that can commit an action).
  let pressTimer = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    const t = cardTarget(e.target);
    if (!t) return;
    clearTimeout(pressTimer);
    const sx = e.clientX, sy = e.clientY;
    function moved(ev) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_SLOP_PX) end();
    }
    function end() {
      clearTimeout(pressTimer); pressTimer = null;
      document.removeEventListener('pointermove', moved, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
    }
    document.addEventListener('pointermove', moved, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    pressTimer = setTimeout(function () {
      end();
      // The finger is still down: take the gesture off the drag and swallow the click
      // that follows, so the release cannot also play the card that was being read.
      if (LC.drag) { LC.drag.cancel(); LC.drag.swallowClick(); }
      const iid = t.dataset.iid != null ? (isNaN(t.dataset.iid) ? t.dataset.iid : Number(t.dataset.iid)) : null;
      LC.inspector.open(t.dataset.cardId, iid);
    }, LONG_PRESS_MS);
  }, true);
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('.card') && e.pointerType && e.pointerType !== 'mouse') e.preventDefault();
  });

  // ---- B. inspector ----------------------------------------------------------------
  function escClose(e) { if (e.key === 'Escape') { e.stopPropagation(); LC.inspector.close(); } }
  LC.inspector = {
    open: function (cardId, iid, extra) {
      Preview.hide();
      const box = ensure('inspector');
      box.textContent = '';
      const body = el('div', 'inspect-body');
      body.addEventListener('click', function (e) { e.stopPropagation(); });
      body.appendChild(buildRow(cardId, iid, liveState()).row);
      if (extra) body.appendChild(extra);
      const close = el('button', 'peek-btn inspect-close', 'Close');
      close.onclick = LC.inspector.close;
      body.appendChild(close);
      box.appendChild(body);
      box.classList.add('open');
      box.onclick = LC.inspector.close;
      document.addEventListener('keydown', escClose, true);
    },
    close: function () {
      const box = document.getElementById('inspector');
      if (box) box.classList.remove('open');
      document.removeEventListener('keydown', escClose, true);
    },
  };

  // ---- C. zone browser ----------------------------------------------------------------
  // Read-only, so it can never be confused with a choice. The information boundary is
  // the CALLER's job: this renders exactly what it is handed.
  function escBrowse(e) { if (e.key === 'Escape') { e.stopPropagation(); LC.zoneBrowser.close(); } }
  LC.zoneBrowser = {
    // items: [{cardId, iid?, count?, hidden?, dim?}]
    open: function (title, items, note) {
      Preview.hide();
      const box = ensure('zone-browser', 'browse-overlay');
      box.textContent = '';
      const body = el('div', 'browse-body');
      body.addEventListener('click', function (e) { e.stopPropagation(); });
      const head = el('div', 'browse-head');
      const total = items.reduce(function (n, it) { return n + (it.count || 1); }, 0);
      head.appendChild(el('div', 'browse-title', title + ' (' + total + ')'));
      if (note) head.appendChild(el('div', 'browse-note', note));
      const closeBtn = el('button', 'browse-close', 'Close');
      closeBtn.onclick = LC.zoneBrowser.close;
      head.appendChild(closeBtn);
      body.appendChild(head);
      if (!items.length) body.appendChild(el('div', 'browse-empty', 'Nothing here.'));
      else {
        const grid = el('div', 'browse-grid');
        const state = liveState();
        items.forEach(function (it) {
          const node = it.hidden ? LC.renderCard(null, { size: 'hand', hidden: true })
            : LC.renderCard(it.iid != null && state && state.cards[it.iid] ? it.iid : it.cardId,
              { size: 'hand', state: it.iid != null ? state : null });
          node.tabIndex = 0;
          const cell = el('div', 'browse-cell');
          cell.appendChild(node);
          if (it.count > 1) cell.appendChild(el('div', 'browse-count', '×' + it.count));
          if (it.label) cell.appendChild(el('div', 'browse-label', it.label));
          grid.appendChild(cell);
        });
        body.appendChild(grid);
      }
      box.appendChild(body);
      box.classList.add('open');
      box.onclick = LC.zoneBrowser.close;
      document.addEventListener('keydown', escBrowse, true);
      closeBtn.focus();
    },
    close: function () {
      const box = document.getElementById('zone-browser');
      if (box) box.classList.remove('open');
      Preview.hide();
      document.removeEventListener('keydown', escBrowse, true);
    },
    isOpen: function () { const b = document.getElementById('zone-browser'); return !!(b && b.classList.contains('open')); },
  };

  // ---- D. spotlight of every played card ----------------------------------------------
  const TRAVEL_MS = 500, HOLD_MS = 1200, FADE_MS = 250;
  let spotTimer = null, fadeTimer = null;
  function finishSpot(box, immediate) {
    clearTimeout(spotTimer);
    if (!box || !box.isConnected) return;
    if (immediate) { box.remove(); return; }
    box.style.opacity = '0';
    fadeTimer = setTimeout(function () { box.remove(); }, FADE_MS);
  }
  // opts: {caption, fromEl, holdScale}
  LC.spotlight = function (cardId, opts) {
    opts = opts || {};
    const old = document.getElementById('spotlight');
    if (old) finishSpot(old, true);              // a second play finishes the first
    const box = el('div');
    box.id = 'spotlight';
    const k = (LC.anim && LC.anim.rate) ? LC.anim.rate() : 1;
    if (opts.caption) box.appendChild(el('div', 'spotlight-caption', opts.caption));
    box.appendChild(LC.renderCard(cardId, { size: 'preview' }));
    let dx = 0, dy = 0;
    if (opts.fromEl && opts.fromEl.getBoundingClientRect) {
      const r = opts.fromEl.getBoundingClientRect();
      dx = r.left + r.width / 2 - window.innerWidth / 2;
      dy = r.top + r.height / 2 - window.innerHeight / 2;
    }
    box.style.transition = 'transform ' + Math.round(TRAVEL_MS * k) + 'ms cubic-bezier(.22,.72,.3,1), opacity ' + Math.round(300 * k) + 'ms ease-out';
    box.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(.3)';
    box.style.opacity = '.35';
    box.onclick = function () { finishSpot(box, true); };
    document.body.appendChild(box);
    // Start state flushed with a forced LAYOUT READ, not rAF: rAF does not fire in a
    // background tab and would strand the card in the middle of the screen.
    void box.getBoundingClientRect();
    // On a short window the preview-size card would overflow: land it scaled to fit.
    const fit = Math.min(1, (window.innerHeight - 24) / Math.max(1, box.offsetHeight), (window.innerWidth - 24) / Math.max(1, box.offsetWidth));
    box.style.transform = 'translate(-50%,-50%) scale(' + fit.toFixed(3) + ')';
    box.style.opacity = '1';
    clearTimeout(fadeTimer);
    spotTimer = setTimeout(function () { finishSpot(box, false); }, Math.round((TRAVEL_MS + (opts.short ? HOLD_MS * 0.5 : HOLD_MS)) * k));
    return box;
  };
  LC.spotlight.clear = function () { finishSpot(document.getElementById('spotlight'), true); };
  LC.spotlight.durationMs = function () {
    const k = (LC.anim && LC.anim.rate) ? LC.anim.rate() : 1;
    return Math.round((TRAVEL_MS + HOLD_MS + FADE_MS) * k);
  };
})();
