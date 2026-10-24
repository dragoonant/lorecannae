// js/ui/game.js — the match controller: modes, the one apply funnel, the bot loop, the
// board redraw and the drag manager. Tap inspects (or opens a card's actions), drag
// commits. EVERY affordance here is a filter over LC.legalActions; the UI cannot invent
// a rule (PRESENTATION-REFERENCE A0.3, CLAUDE.md rule 2).
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  const DRAG_THRESHOLD_PX = 8;
  const CLICK_GRACE_MS = 350;
  const AI_GAP_MS = 820;          // between bot actions at full speed: followable, not slow
  const TURN_HOLD_MS = 1100;      // extra beat when the turn changes hands (banner)
  const WATCHDOG_MS = 5000;       // the bot never waits longer than this for a picture

  const UI = LC.ui = {
    state: null, mode: 'ai', seats: ['human', 'ai'], levels: [null, 'normal'],
    viewSeat: 0, names: ['You', 'Opponent'], decks: null, lastN: -1, paused: false,
    variants: null, trace: null, curtainFor: null, resultsShown: false, lastTurnSeen: null,
  };

  // ---------------------------------------------------------------- setup
  function deckLabel(d) {
    if (typeof d === 'string') { const k = LC.DECKS.find(function (x) { return x.id === d; }); return k ? k.name : d; }
    return d.name;
  }

  UI.start = function (opts) {
    LC.anim.skip();
    LC.spotlight.clear();
    LC.asks.reset();
    LC.hud.reset();
    UI.mode = opts.mode || 'ai';
    UI.decks = opts.decks.slice();
    const lvl = opts.level || 'normal';
    if (UI.mode === 'ai' || UI.mode === 'tutorial') {
      UI.seats = ['human', 'ai'];
      UI.levels = [null, UI.mode === 'tutorial' ? 'easy' : lvl];
      UI.names = ['You', 'Opponent'];
    } else if (UI.mode === 'hotseat') {
      UI.seats = ['human', 'human'];
      UI.levels = [null, null];
      UI.names = ['Player 1', 'Player 2'];
    } else {
      UI.seats = ['ai', 'ai'];
      UI.levels = [opts.levels ? opts.levels[0] : lvl, opts.levels ? opts.levels[1] : lvl];
      UI.names = ['Bot A', 'Bot B'];
    }
    LC.logText.setPerspective(UI.mode === 'hotseat' ? { you: null, sees: null, names: UI.names }
      : UI.mode === 'spectate' ? { you: null, sees: 'all', names: UI.names }
      : { you: 0, sees: 0, names: ['You', 'The opponent'] });
    const seed = opts.seed != null ? opts.seed : ('g' + Math.floor(Math.random() * 1e9));
    UI.state = LC.newGame({ decks: UI.decks, seed: seed, first: opts.first != null ? opts.first : 'random',
      names: UI.names });
    UI.lastN = UI.state.log.length ? UI.state.log[UI.state.log.length - 1].n : -1;
    // The black box: the engine's trace shape (tools/replay-report.mjs replays it), plus
    // the view's own notes under `ui` (mode, levels, who played each action).
    UI.trace = LC.makeTrace({ decks: UI.decks, seed: seed, first: opts.first != null ? opts.first : 'random', names: UI.names });
    UI.trace.ui = { app: 'lorecannae', at: new Date().toISOString(), mode: UI.mode, levels: UI.levels, sources: [] };
    UI.paused = false;
    UI.variants = null;
    UI.resultsShown = false;
    UI.lastTurnSeen = null;
    UI.viewSeat = UI.mode === 'hotseat' ? null : 0;
    LC.boardArt.rollScenes();
    if (UI.mode === 'tutorial') LC.tutorial.begin(); else LC.tutorial.end();
    UI.render();
    schedule();
  };

  UI.rematch = function () {
    UI.start({ mode: UI.mode, decks: UI.decks, level: UI.levels[1] || UI.levels[0] || 'normal', levels: UI.levels.slice() });
  };

  UI.seatName = function (seat) { return UI.names[seat]; };

  // Concede (CR 2.3.3): either seat, any time, not in legalActions. Leaving a live match
  // for a new one concedes it, so the result is recorded rather than abandoned.
  UI.concede = function (seat) {
    const s = UI.state;
    if (!s || LC.isTerminal(s)) return;
    LC.anim.skip();
    applyFrom(seat, { type: 'concede', who: seat }, 'human');
  };
  UI.humanSeatForConcede = function () {
    if (UI.mode === 'spectate') return null;
    if (UI.mode === 'hotseat') return UI.viewSeat == null ? 0 : UI.viewSeat;
    return 0;
  };
  UI.isHuman = function (seat) { return UI.seats[seat] === 'human'; };

  // ---------------------------------------------------------------- the one apply funnel
  function toast(text, cls) {
    let t = $('toast');
    if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = text;
    t.className = 'show ' + (cls || '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.className = ''; }, 3800);
  }
  UI.toast = toast;

  function applyFrom(seat, action, source) {
    const prev = UI.state;
    let next;
    try {
      next = LC.apply(prev, action);
    } catch (err) {
      if (err instanceof LC.Illegal) {
        console.warn('[ui] illegal', action, err.message);
        toast('That isn’t allowed right now (' + err.message + ').', 'is-warn');
        UI.render();
        return false;
      }
      UI.trace.ui.error = { at: UI.trace.actions.length, action: action, message: String(err && err.message), stack: String(err && err.stack) };
      console.error('[ui] apply threw', action, err);
      toast('Engine error: ' + (err && err.message) + ' — the drawer’s "Save report" button saves the trace.', 'is-error');
      UI.render();
      throw err;
    }
    UI.trace.actions.push(action);
    UI.trace.ui.sources.push(source + ':' + seat);
    UI.state = next;
    UI.variants = null;
    if (!(action.type === 'answer')) LC.asks.reset();
    // Animate only entries newer than the last one shown: an answered ask re-runs its
    // effect from the snapshot and re-emits identical entries with the same n.
    const fresh = next.log.filter(function (e) { return e.n > UI.lastN; });
    if (fresh.length) UI.lastN = fresh[fresh.length - 1].n;
    settle(prev, next, fresh);
    return true;
  }

  UI.doAction = function (action) {
    if (LC.anim.busy()) return;
    const seat = LC.whoActs(UI.state);
    if (seat == null || !UI.isHuman(seat) || seat !== UI.viewSeat) return;
    LC.sound.sfx('click');
    applyFrom(seat, action, 'human');
  };
  UI.answer = function (value) { UI.doAction({ type: 'answer', value: value }); };

  function settle(prev, next, fresh) {
    const steps = LC.anim.plan(prev, next, fresh);
    const animated = LC.anim.willAnimate(steps);
    LC.sound.play(fresh, animated);
    if (LC.anim.mode() !== 'off') spotlightPlays(prev, next, fresh);
    if (!animated) { UI.render(); schedule(); return; }
    LC.anim.run(steps, next, { viewSeat: UI.viewSeat == null ? 0 : UI.viewSeat }, function () {
      UI.render();
      schedule();
    });
  }

  function spotlightPlays(prev, next, fresh) {
    fresh.forEach(function (l) {
      // The other seat's ink is revealed as it goes in (CR 4.2.1.1): a short look.
      if (l.type === 'ink' && l.who !== UI.viewSeat && next.cards[l.iid]) {
        const by = UI.mode === 'ai' || UI.mode === 'tutorial' ? 'The opponent inks' : UI.names[l.who] + ' inks';
        LC.spotlight(next.cards[l.iid].id, { caption: by, fromEl: $('enemy-hand'), short: true });
        return;
      }
      if (l.type !== 'play') return;
      const c = next.cards[l.iid] || prev.cards[l.iid];
      if (!c) return;
      const who = UI.mode === 'ai' || UI.mode === 'tutorial' ? (l.who === 0 ? 'You play' : 'The opponent plays') : UI.names[l.who] + ' plays';
      let caption = who;
      const singers = l.singers || [];
      if ((l.pay === 'sing' || l.pay === 'singTogether') && singers.length) {
        caption = 'Sung by ' + singers.map(function (i) { return next.cards[i] ? LC.CARDS[next.cards[i].id].name : '?'; }).join(' & ');
      } else if (l.pay === 'shift' || l.pay === 'shiftAlt') {
        const o = l.onto != null && next.cards[l.onto] ? LC.CARDS[next.cards[l.onto].id].name : '';
        caption = who + ' · shifted onto ' + o;
      }
      // Fly from where it came from: the actor's hand.
      const from = (l.who === UI.viewSeat) ? $('hand') : $('enemy-hand');
      LC.spotlight(c.id, { caption: caption, fromEl: from });
    });
  }

  // ---------------------------------------------------------------- the bot loop
  let botTimer = null;
  function schedule() {
    clearTimeout(botTimer);
    const s = UI.state;
    if (!s) return;
    if (LC.isTerminal(s)) { LC.hud.finish(s); return; }
    const acting = LC.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    if (UI.paused) return;
    const k = LC.anim.mode() === 'off' ? 0.15 : LC.anim.rate();
    let delay = Math.max(120, AI_GAP_MS * k);
    if (UI.lastTurnSeen !== s.turn) delay += TURN_HOLD_MS * Math.max(0.3, k);
    UI.lastTurnSeen = s.turn;
    botTimer = setTimeout(function () { botStep(Date.now()); }, delay);
  }
  UI.schedule = schedule;

  function botStep(since) {
    const s = UI.state;
    if (!s || LC.isTerminal(s) || UI.paused) return;
    const acting = LC.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    // The bot waits for the picture to finish; a watchdog bounds the wait.
    if (LC.anim.busy()) {
      if (Date.now() - since > WATCHDOG_MS || LC.anim.age() > WATCHDOG_MS) LC.anim.skip();
      else { botTimer = setTimeout(function () { botStep(since); }, 120); return; }
    }
    let action;
    try {
      action = LC.ai.choose(s, acting, UI.levels[acting] || 'normal');
    } catch (err) {
      console.error('[ui] LC.ai.choose threw', err);
      const legal = LC.legalActions(s);
      action = legal[Math.floor(Math.random() * legal.length)];
      toast('The AI failed to choose (' + (err && err.message) + '); it played a random legal move instead.', 'is-error');
    }
    applyFrom(acting, action, 'ai');
  }

  UI.setPaused = function (p) { UI.paused = p; if (!p) schedule(); else clearTimeout(botTimer); UI.render(); };
  UI.stepOnce = function () {
    if (!UI.paused) return;
    const s = UI.state;
    if (!s || LC.isTerminal(s)) return;
    if (LC.anim.busy()) LC.anim.skip();
    const acting = LC.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    applyFrom(acting, LC.ai.choose(s, acting, UI.levels[acting] || 'normal'), 'ai');
  };

  // ---------------------------------------------------------------- labels
  function nm(s, iid) { const c = s.cards[iid]; return c ? LC.CARDS[c.id].name : '?'; }
  function fullNm(s, iid) { const c = s.cards[iid]; return c ? LC.fullName(LC.CARDS[c.id]) : '?'; }
  // Buttons say what they do, with the numbers (kb/LESSONS-DIGEST §4.1).
  UI.actionLabel = function (s, a) {
    switch (a.type) {
      case 'ink': return 'Put into your inkwell (+1 ink)';
      case 'play': {
        const d = LC.CARDS[s.cards[a.iid].id];
        if (a.pay === 'ink') return 'Play for ' + LC.costToPlay(s, a.iid) + ' ink';
        if (a.pay === 'free') return 'Play for free';
        if (a.pay === 'shift') return 'Shift onto ' + fullNm(s, a.onto) + ' (' + LC.costToPlay(s, a.iid, LC.printedKeywords(d).Shift) + ' ink)';
        if (a.pay === 'shiftAlt') return 'Shift onto ' + fullNm(s, a.onto) + ' (alternate cost)';
        if (a.pay === 'sing') return 'Sing it with ' + fullNm(s, a.singer) + ' (exert, no ink)';
        if (a.pay === 'singTogether') return 'Sing Together… (exert characters with total cost ' + LC.printedKeywords(d).SingTogether + '+)';
        return 'Play';
      }
      case 'quest': return 'Quest (+' + LC.chars(s, a.iid).lore + ' lore)';
      case 'challenge': {
        const A = LC.chars(s, a.iid), T = LC.chars(s, a.target);
        const ch = A.kw.Challenger ? ' +' + A.kw.Challenger + ' Challenger' : '';
        const res = T.kw.Resist ? ', it has Resist +' + T.kw.Resist : '';
        return 'Challenge ' + fullNm(s, a.target) + ' — you deal ' + Math.max(0, A.str) + ch + res +
          ' (it has ' + (T.wp - T.damage) + ' left), you take ' + Math.max(0, T.str) + ' (you have ' + (A.wp - A.damage) + ' left)';
      }
      case 'activate': {
        const ab = LC.chars(s, a.iid).activated[a.idx];
        return (ab.name || 'Ability') + (ab.costText ? ' (' + ab.costText + ')' : '') + (ab.text ? ': ' + ab.text : '');
      }
      case 'boost': return 'Boost (pay ' + LC.chars(s, a.iid).kw.Boost + ' ink: top card of your deck goes facedown under it)';
      case 'end': return 'End turn';
      default: return a.type;
    }
  };

  // ---------------------------------------------------------------- hover hints
  UI.hint = function (iid) {
    document.querySelectorAll('.role-hinted').forEach(function (n) { n.classList.remove('role-hinted'); });
    if (iid == null) return;
    const n = document.querySelector('.card[data-iid="' + iid + '"]');
    if (n) n.classList.add('role-hinted');
  };
  function hintOn(btn, iid) {
    if (iid == null) return;
    btn.addEventListener('mouseenter', function () { UI.hint(iid); });
    btn.addEventListener('mouseleave', function () { UI.hint(null); });
    btn.addEventListener('focus', function () { UI.hint(iid); });
    btn.addEventListener('blur', function () { UI.hint(null); });
  }
  UI.hintOn = hintOn;

  // ---------------------------------------------------------------- drag manager
  const Drag = LC.drag = (function () {
    let live = null, lastDragEnd = 0;
    function justDragged() { return Date.now() - lastDragEnd < CLICK_GRACE_MS; }
    function begin(node, e, spec) {
      if (live) finish(false);            // a fresh press proves the old gesture is over
      live = { node: node, spec: spec, startX: e.clientX, startY: e.clientY, moved: false };
      // Set at PRESS time: by the 8px threshold the browser has already begun selecting.
      document.documentElement.classList.add('is-dragging');
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', onUp);
      node.addEventListener('pointercancel', onCancel);
    }
    function onMove(e) {
      if (!live) return;
      const dx = e.clientX - live.startX, dy = e.clientY - live.startY;
      if (!live.moved) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
        live.moved = true;
        LC.preview.hide();
        if (!live.spec.targets.length) return;           // undraggable stays tappable
        markTargets(true);
        if (live.spec.kind === 'hand') {
          const clone = live.node.cloneNode(true);
          clone.classList.add('drag-clone');
          clone.removeAttribute('data-card-id');
          clone.style.width = live.node.offsetWidth + 'px';
          document.body.appendChild(clone);
          live.clone = clone;
          live.node.classList.add('is-dragging-source');
        } else live.arrow = true;
      }
      if (!live.spec.targets.length) return;
      if (live.clone) {
        live.clone.style.left = (e.clientX - live.clone.offsetWidth / 2) + 'px';
        live.clone.style.top = (e.clientY - live.clone.offsetHeight * 0.85) + 'px';
      }
      const hot = hotTarget(e.clientX, e.clientY);
      if (live.arrow) {
        const kind = hot && hot.kind === 'quest' ? 'quest' : 'aim';
        LC.arrow.draw(LC.arrow.centreOf(live.node), { x: e.clientX, y: e.clientY }, kind);
      }
    }
    function onUp(e) {
      if (!live) return;
      const wasDrag = live.moved;
      if (wasDrag && live.spec.targets.length) {
        const drop = findDrop(e.clientX, e.clientY);
        lastDragEnd = Date.now();
        armClickSwallow();
        const spec = live.spec;
        finish(false);
        if (drop) commitDrop(drop, spec);
        return;
      }
      if (wasDrag) { lastDragEnd = Date.now(); armClickSwallow(); }
      finish(!wasDrag);
    }
    function onCancel() { finish(false); }
    function finish(wasTap) {
      if (!live) return;
      const L = live;
      live = null;
      L.node.removeEventListener('pointermove', onMove);
      L.node.removeEventListener('pointerup', onUp);
      L.node.removeEventListener('pointercancel', onCancel);
      L.node.classList.remove('is-dragging-source');
      document.documentElement.classList.remove('is-dragging');
      if (L.clone) L.clone.remove();
      if (L.arrow) LC.arrow.clear();
      document.querySelectorAll('.drop-ok, .drop-hot').forEach(function (n) { n.classList.remove('drop-ok', 'drop-hot'); });
      if (wasTap && !L.moved && L.spec.onTap) L.spec.onTap(L.node);
    }
    function markTargets(on) {
      document.querySelectorAll('.drop-ok, .drop-hot').forEach(function (n) { n.classList.remove('drop-ok', 'drop-hot'); });
      if (!on || !live) return;
      live.spec.targets.forEach(function (t) { const n = t.el(); if (n) n.classList.add('drop-ok'); });
    }
    function hotTarget(x, y) {
      document.querySelectorAll('.drop-hot').forEach(function (n) { n.classList.remove('drop-hot'); });
      const d = findDrop(x, y);
      if (d) { const n = d.el(); if (n) n.classList.add('drop-hot'); }
      return d;
    }
    function findDrop(x, y) {
      const under = document.elementFromPoint(x, y);
      if (!under || !live) return null;
      // Most specific first: a card target beats the lane it sits in.
      let best = null, bestDepth = -1;
      live.spec.targets.forEach(function (t) {
        const n = t.el();
        if (!n || !(n === under || n.contains(under))) return;
        let depth = 0, p = n; while (p) { depth++; p = p.parentElement; }
        if (depth > bestDepth) { best = t; bestDepth = depth; }
      });
      return best;
    }
    function commitDrop(t, spec) {
      if (t.actions.length === 1) { UI.doAction(t.actions[0]); return; }
      UI.variants = { iid: spec.iid, actions: t.actions };   // several pays at one drop: ask
      UI.render();
    }
    function armClickSwallow() {
      function swallow(e) { e.stopPropagation(); e.preventDefault(); document.removeEventListener('click', swallow, true); }
      document.addEventListener('click', swallow, true);
      setTimeout(function () { document.removeEventListener('click', swallow, true); }, CLICK_GRACE_MS);
    }
    return { begin: begin, active: function () { return !!(live && live.moved); }, justDragged: justDragged,
      cancel: function () { finish(false); }, swallowClick: armClickSwallow };
  })();

  // ---------------------------------------------------------------- rendering
  function markActable(node) {
    node.classList.add('role-actable', 'is-draggable');
    node.style.animationDelay = U.animationPhase(1700);
  }
  function sidePrefix(seat) { return seat === UI.viewSeat ? 'my-' : 'enemy-'; }
  function acting(s) { return LC.whoActs(s); }

  UI.render = function () {
    const s = UI.state;
    if (!s) return;
    if (LC.anim.busy()) return;           // mid-animation the board is deliberately stale
    // Hot-seat: the device is passed between turns, and a question for the other seat
    // passes it too. The curtain hides both hands until the right person says ready.
    const who = acting(s);
    if (UI.mode === 'hotseat' && who != null && who !== UI.viewSeat) {
      LC.hud.curtain(who, function () { UI.viewSeat = who; LC.asks.reset(); UI.render(); });
      if (UI.viewSeat == null) return;
    } else LC.hud.curtain(null);
    const viewer = UI.viewSeat == null ? 0 : UI.viewSeat;
    const other = 1 - viewer;
    const mine = who === viewer && UI.isHuman(viewer) && !LC.isTerminal(s);
    const acts = mine && !s.ask ? LC.legalActions(s) : [];
    LC.preview.invalidate();
    renderSide(s, viewer, acts, true);
    renderSide(s, other, acts, false);
    renderHand(s, viewer, acts);
    renderEnemyHand(s, other);
    renderTurnBar(s, acts, mine);
    renderVariants(s);
    const modalOpen = LC.asks.render(s, viewer, who, UI.answer);
    const p = LC.asks.promptLine(s, viewer, who, promptNames());
    const m = $('choice-modal');
    const panelShowing = !!m && m.classList.contains('open') && !m.classList.contains('peek');
    // The centre echo shows only while a panel question is peeked away; a board question
    // is spelled out in the choice bar, and an echo in the middle would sit on the very
    // cards being chosen.
    LC.asks.renderEcho(p.text, p.cls === 'asking' && !panelShowing && LC.asks.mode(s) !== 'board' && !!m && m.classList.contains('peek'));
    LC.logPanel.render(s, p);
    LC.hud.render(s, viewer);
    if (UI.mode === 'tutorial') LC.tutorial.onRender(s, acts);
  };
  function promptNames() {
    if (UI.mode === 'ai' || UI.mode === 'tutorial') return ['you', 'the opponent'];
    return UI.names;
  }

  function renderSide(s, seat, acts, isMine) {
    const pre = isMine ? 'my-' : 'enemy-';
    const P = s.players[seat];
    renderLore($(pre + 'lore'), s, seat, isMine, acts);
    const chars = [], items = [];
    P.play.forEach(function (iid) {
      const t = U.mainType(LC.CARDS[s.cards[iid].id]);
      (t === 'item' ? items : chars).push(iid);
    });
    renderLane($(pre + 'play'), s, chars, acts, isMine, 'play');
    renderLane($(pre + 'items'), s, items, acts, isMine, 'items');
    renderDeck($(pre + 'deck'), s, seat, isMine);
    renderDiscard($(pre + 'discard'), s, seat, isMine);
    renderInk($(pre + 'ink'), s, seat, isMine, acts);
  }

  // The lore track's marker and number. Shared with js/ui/anim.js so a quest's diamond
  // lands on exactly the spot the redraw will use.
  UI.placeLoreMarker = function (zoneNode, lore) {
    const T = LC.boardLayout.loreTrack;
    const f = T.from + (T.to - T.from) * Math.min(20, Math.max(0, lore)) / 20;
    const mark = zoneNode.querySelector('.lore-marker');
    const theirs = zoneNode.id.indexOf('enemy') === 0;
    if (mark) {
      mark.style.top = theirs ? (f * 100) + '%' : ((1 - f) * 100) + '%';
      mark.classList.toggle('is-warm', lore >= 16);
    }
    const n = zoneNode.querySelector('.lore-num');
    if (n) { n.textContent = String(lore); n.classList.toggle('is-warm', lore >= 16); n.classList.toggle('is-won', lore >= 20); }
  };

  function renderLore(node, s, seat, isMine, acts) {
    node.textContent = '';
    const P = s.players[seat];
    const active = !LC.isTerminal(s) && s.active === seat && s.phase === 'main';
    node.classList.toggle('is-active', active);
    if (active) node.style.animationDelay = U.animationPhase(1900);
    const count = el('div', 'lore-count');
    count.appendChild(el('div', 'lore-num', String(P.lore)));
    // While it is this side's turn the caption under the number says so (the active-player
    // marker); a separate pill here would sit on the track's first steps.
    count.appendChild(el('div', 'lore-label' + (active ? ' is-turn' : ''), active ? (isMine && (UI.mode === 'ai' || UI.mode === 'tutorial') ? 'your turn' : 'turn') : 'lore'));
    node.appendChild(count);
    const mark = el('div', 'lore-marker');
    mark.innerHTML = U.iconHTML('L');
    node.appendChild(mark);
    node.setAttribute('data-tip', (UI.mode === 'ai' || UI.mode === 'tutorial' ? (seat === 0 ? 'Your' : 'Opponent’s') : UI.names[seat] + '’s') +
      ' lore: ' + P.lore + ' of 20. First to 20 wins.' + (isMine ? ' Drag a ready character here to quest.' : ''));
    UI.placeLoreMarker(node, P.lore);
  }

  function renderLane(node, s, iids, acts, isMine, lane) {
    node.textContent = '';
    const row = el('div', 'play-row');
    let ex = 0;
    iids.forEach(function (iid, i) {
      const slot = charSlot(s, iid, acts, isMine);
      if (s.cards[iid].exerted) ex++;
      slot.style.setProperty('--z', String(10 + i));
      row.appendChild(slot);
    });
    row.style.setProperty('--n', String(Math.max(1, iids.length)));
    row.style.setProperty('--ex', String(ex));
    node.appendChild(row);
    node.classList.toggle('is-empty', iids.length === 0);
  }

  function sourceActs(acts, iid) {
    return acts.filter(function (a) {
      return a.iid === iid && (a.type === 'quest' || a.type === 'challenge' || a.type === 'activate' || a.type === 'boost');
    });
  }

  function charSlot(s, iid, acts, isMine) {
    const c = s.cards[iid];
    const slot = el('div', 'char-slot');
    if (c.exerted) slot.classList.add('is-exerted');
    if (c.under && c.under.length) {
      slot.classList.add('has-stack');
      for (let k = Math.min(2, c.under.length); k >= 1; k--) {
        const lay = el('div', 'stack-layer');
        lay.style.setProperty('--k', String(k));
        slot.appendChild(lay);
      }
    }
    const card = LC.renderCard(iid, { size: 'board', state: s });
    card.tabIndex = 0;
    const mineActs = sourceActs(acts, iid);
    if (mineActs.length) markActable(card);
    const ask = s.ask;
    const asking = ask && LC.asks.mode(s) === 'board' && acting(s) === UI.viewSeat && UI.isHuman(UI.viewSeat);
    if (asking && LC.asks.isCandidate(s, iid)) {
      card.classList.add(LC.asks.isPicked(iid) ? 'role-picked' : 'role-target');
    } else if (asking && ask.seen && ask.seen.indexOf(iid) >= 0) card.classList.add('is-dim');
    // The card whose effect is asking wears the "selected" ring, so the question visibly
    // comes FROM somewhere on the board.
    if (ask && ask.src === iid) card.classList.add('is-asker');
    const targets = [];
    mineActs.forEach(function (a) {
      if (a.type === 'challenge') targets.push({ kind: 'challenge', actions: [a], el: function () { return document.querySelector('#enemy-play .card[data-iid="' + a.target + '"]'); } });
      if (a.type === 'quest') targets.push({ kind: 'quest', actions: [a], el: function () { return $('my-lore'); } });
    });
    card.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      Drag.begin(card, e, {
        kind: 'char', iid: iid, targets: targets,
        onTap: function () {
          if (asking && LC.asks.isCandidate(UI.state, iid)) { LC.asks.toggle(UI.state, iid, UI.answer); return; }
          if (isMine && UI.isHuman(UI.viewSeat) && acting(UI.state) === UI.viewSeat && !UI.state.ask) { LC.hud.openActions(iid); return; }
          LC.inspector.open(c.id, iid);
        },
      });
    });
    card.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (asking && LC.asks.isCandidate(UI.state, iid)) LC.asks.toggle(UI.state, iid, UI.answer);
      else if (isMine && !UI.state.ask && acting(UI.state) === UI.viewSeat) LC.hud.openActions(iid);
      else LC.inspector.open(c.id, iid);
    });
    slot.appendChild(card);
    return slot;
  }

  function handTargets(s, iid, acts) {
    const targets = [];
    const ink = acts.find(function (a) { return a.type === 'ink' && a.iid === iid; });
    if (ink) targets.push({ kind: 'ink', actions: [ink], el: function () { return $('my-ink'); } });
    const plays = acts.filter(function (a) { return a.type === 'play' && a.iid === iid; });
    if (plays.length) {
      targets.push({ kind: 'play', actions: plays, el: function () { return $('my-play'); } });
      targets.push({ kind: 'play', actions: plays, el: function () { return $('my-items'); } });
      // Shift and sing also land directly on the character they use.
      const byChar = {};
      plays.forEach(function (a) {
        const on = a.pay === 'shift' || a.pay === 'shiftAlt' ? a.onto : (a.pay === 'sing' ? a.singer : null);
        if (on == null) return;
        (byChar[on] = byChar[on] || []).push(a);
      });
      Object.keys(byChar).forEach(function (on) {
        targets.push({ kind: 'play', actions: byChar[on], el: function () { return document.querySelector('#my-play .card[data-iid="' + on + '"]'); } });
      });
    }
    return { targets: targets, ink: ink, plays: plays };
  }

  function renderHand(s, viewer, acts) {
    const node = $('hand');
    node.textContent = '';
    const P = s.players[viewer];
    const myMain = acting(s) === viewer && UI.isHuman(viewer) && s.phase === 'main' && !s.ask && s.active === viewer;
    P.hand.forEach(function (iid, i) {
      const c = s.cards[iid];
      const card = LC.renderCard(iid, { size: 'hand', state: s });
      card.tabIndex = 0;
      const spec = handTargets(s, iid, acts);
      if (spec.plays.length || spec.ink) markActable(card);
      if (spec.ink) card.classList.add('can-ink');
      if (!spec.plays.length && myMain && LC.whyNot(s, iid)) card.classList.add('is-unaffordable');
      if (s.ask && LC.asks.isCandidate(s, iid)) card.classList.add(LC.asks.isPicked(iid) ? 'role-picked' : 'role-target');
      card.style.setProperty('--z', String(10 + i));
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        Drag.begin(card, e, {
          kind: 'hand', iid: iid, targets: myMain ? spec.targets : [],
          onTap: function () {
            if (UI.state.ask && LC.asks.isCandidate(UI.state, iid) && acting(UI.state) === UI.viewSeat) { LC.asks.toggle(UI.state, iid, UI.answer); return; }
            if (myMain) { LC.hud.openActions(iid); return; }
            LC.inspector.open(c.id, iid);
          },
        });
      });
      card.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (myMain) LC.hud.openActions(iid); else LC.inspector.open(c.id, iid);
      });
      node.appendChild(card);
    });
    node.style.setProperty('--n', String(P.hand.length));
    // Whether the row actually overlaps is a layout outcome: measure it once, with a
    // forced synchronous read (never rAF, which stalls in a background tab).
    const cards = node.children;
    const over = cards.length > 1 && cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left <
      cards[0].getBoundingClientRect().width - 1;
    node.classList.toggle('is-fanned', over);
  }

  function renderEnemyHand(s, seat) {
    const node = $('enemy-hand');
    node.textContent = '';
    const hand = s.players[seat].hand;
    let anyOpen = false;
    hand.forEach(function (iid, i) {
      const open = LC.canSee(s, iid, UI.viewSeat == null ? -1 : UI.viewSeat) || UI.mode === 'spectate';
      const card = open ? LC.renderCard(iid, { size: 'hand', state: s }) : LC.renderCard(null, { size: 'hand', hidden: true });
      if (open) { card.classList.add('is-revealed'); card.tabIndex = 0; anyOpen = true; }
      card.style.setProperty('--z', String(10 + i));
      node.appendChild(card);
    });
    node.style.setProperty('--n', String(hand.length));
    $('enemy-hand-bar').classList.toggle('has-revealed', anyOpen);
    $('enemy-hand-bar').setAttribute('data-tip', (UI.mode === 'ai' || UI.mode === 'tutorial' ? 'Opponent’s' : UI.names[seat] + '’s') + ' hand: ' + hand.length + ' card' + (hand.length === 1 ? '' : 's'));
  }

  function pileStack(n, topNode) {
    const stack = el('div', 'pile-stack');
    const layers = Math.min(5, Math.floor(n / 6));
    for (let i = layers; i >= 1; i--) {
      const lay = el('div', 'pile-layer');
      lay.style.transform = 'translate(' + (i * -0.22) + 'cqw, ' + (i * -0.22) + 'cqw)';
      stack.appendChild(lay);
    }
    stack.appendChild(topNode);
    return stack;
  }
  function browsable(node, open) {
    node.classList.toggle('is-browsable', !!open);
    node.onclick = open ? function () { if (!Drag.justDragged()) open(); } : null;
    node.onkeydown = open ? function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : null;
    if (open) { node.tabIndex = 0; node.setAttribute('role', 'button'); } else { node.removeAttribute('tabindex'); node.removeAttribute('role'); }
  }
  function whose(seat) { return UI.mode === 'ai' || UI.mode === 'tutorial' ? (seat === 0 ? 'Your' : 'Opponent’s') : UI.names[seat] + '’s'; }

  // A deck browses as a LIST sorted by cost then name with copies collapsed — never in
  // deck order, so looking through it cannot leak what you draw next.
  function deckList(s, iids) {
    const byId = {};
    iids.forEach(function (i) { const id = s.cards[i].id; byId[id] = (byId[id] || 0) + 1; });
    return Object.keys(byId).sort(function (a, b) {
      const A = LC.CARDS[a], B = LC.CARDS[b];
      return A.cost - B.cost || LC.fullName(A).localeCompare(LC.fullName(B));
    }).map(function (id) { return { cardId: id, count: byId[id] }; });
  }

  function renderDeck(node, s, seat, isMine) {
    node.textContent = '';
    const P = s.players[seat];
    if (P.deck.length) node.appendChild(pileStack(P.deck.length, LC.renderCard(null, { size: 'board', hidden: true })));
    node.appendChild(el('div', 'zone-badge', String(P.deck.length)));
    node.setAttribute('data-tip', whose(seat) + ' deck: ' + P.deck.length + ' cards' + (P.deck.length <= 5 ? ' — running low!' : ''));
    node.classList.toggle('is-low', P.deck.length <= 5);
    const canLook = (isMine && UI.mode !== 'hotseat') || (UI.mode === 'hotseat' && seat === UI.viewSeat) || UI.mode === 'spectate' || LC.isTerminal(s);
    browsable(node, canLook && P.deck.length ? function () {
      LC.zoneBrowser.open(whose(seat) + ' deck', deckList(s, P.deck), 'Sorted by cost, copies collapsed — never in deck order.');
    } : null);
  }

  function renderDiscard(node, s, seat) {
    node.textContent = '';
    const P = s.players[seat];
    if (P.discard.length) {
      const top = LC.renderCard(P.discard[0], { size: 'board', state: s });
      node.appendChild(pileStack(P.discard.length, top));
    }
    node.appendChild(el('div', 'zone-badge', String(P.discard.length)));
    // Public in both directions, openable any time, even in the middle of a prompt.
    browsable(node, P.discard.length ? function () {
      LC.zoneBrowser.open(whose(seat) + ' discard', P.discard.map(function (i) { return { cardId: s.cards[i].id, iid: i }; }), 'Newest first.');
    } : null);
  }

  function renderInk(node, s, seat, isMine) {
    node.textContent = '';
    const P = s.players[seat];
    const fan = el('div', 'res-fan');
    fan.style.setProperty('--n', String(Math.max(1, P.ink.length)));
    let ready = 0;
    const open = LC.isTerminal(s);   // post-mortem: the inkwells turn face up too
    P.ink.forEach(function (iid) {
      const c = open ? LC.renderCard(s.cards[iid].id, { size: 'board' }) : LC.renderCard(null, { size: 'board', hidden: true });
      if (s.cards[iid].exerted) c.classList.add('is-spent'); else ready++;
      fan.appendChild(c);
    });
    node.appendChild(fan);
    const badge = el('div', 'zone-badge ink-badge');
    badge.appendChild(U.icon('I'));
    badge.appendChild(document.createTextNode(' ' + ready + '/' + P.ink.length));
    node.appendChild(badge);
    if (s.active === seat && s.phase === 'main') {
      node.appendChild(el('div', 'zone-badge zone-badge-alt' + (P.inkedThisTurn ? ' is-used' : ''),
        P.inkedThisTurn ? 'inked this turn' : 'can ink 1 card'));
    }
    node.setAttribute('data-tip', whose(seat) + ' inkwell: ' + ready + ' ready of ' + P.ink.length + '.' + (isMine ? ' Drag an inkable card here (once per turn).' : ''));
    const canLook = (UI.mode === 'hotseat' ? seat === UI.viewSeat : (isMine || UI.mode === 'spectate')) || LC.isTerminal(s);
    browsable(node, canLook && P.ink.length ? function () {
      LC.zoneBrowser.open(whose(seat) + ' inkwell', P.ink.map(function (i) {
        return { cardId: s.cards[i].id, label: s.cards[i].exerted ? 'exerted' : 'ready' };
      }), 'Face down on the table; only its owner knows these.');
    } : null);
  }

  function renderTurnBar(s, acts, mine) {
    const bar = $('turn-bar');
    bar.textContent = '';
    const viewer = UI.viewSeat == null ? 0 : UI.viewSeat;
    const left = el('div', 'turn-left');
    if (LC.isTerminal(s)) {
      const won = s.winner;
      left.appendChild(el('span', 'turn-result', UI.mode === 'ai' || UI.mode === 'tutorial' ? (won === 0 ? 'You win!' : 'You lose.') : UI.names[won] + ' wins!'));
      bar.appendChild(left);
      const r = el('button', 'action-btn', 'Results');
      r.onclick = function () { LC.hud.showResults(UI.state); };
      bar.appendChild(r);
      return;
    }
    const who = s.active;
    const label = s.phase === 'mulligan' ? 'Opening hands' :
      'Turn ' + s.turn + ' · ' + ((UI.mode === 'ai' || UI.mode === 'tutorial') ? (who === 0 ? 'Your turn' : 'Opponent’s turn') : UI.names[who] + '’s turn');
    left.appendChild(el('span', 'turn-label', label));
    bar.appendChild(left);

    const mid = el('div', 'turn-mid');
    if (mine && !s.ask && s.phase === 'main') {
      const end = acts.find(function (a) { return a.type === 'end'; });
      const btn = el('button', 'action-btn end-turn', 'End turn');
      if (end) {
        btn.onclick = function () { UI.doAction(end); };
        const left2 = acts.filter(function (a) { return a.type !== 'end'; });
        const actable = {};
        left2.forEach(function (a) { actable[a.iid] = 1; });
        const n = Object.keys(actable).length;
        if (n) mid.appendChild(el('span', 'turn-hint', n + ' card' + (n === 1 ? '' : 's') + ' can still act'));
      } else {
        btn.disabled = true;
        const blocker = LC.endTurnBlocker(s);
        const why = blocker != null ? 'Reckless: ' + fullNm(s, blocker) + ' must challenge before you can end your turn.' : 'You can’t end your turn yet.';
        btn.setAttribute('data-tip', why);
        mid.appendChild(el('span', 'turn-why', why));
      }
      mid.insertBefore(btn, mid.firstChild);
    } else if (!mine && !LC.isTerminal(s)) {
      const w = acting(s);
      if (UI.seats[w] === 'ai') mid.appendChild(el('span', 'turn-wait', (UI.mode === 'spectate' ? UI.names[w] : 'The opponent') + ' is ' + (s.ask ? 'choosing' : 'playing') + '…'));
    }
    bar.appendChild(mid);

    const right = el('div', 'turn-right');
    if (UI.mode === 'spectate') {
      const pause = el('button', null, UI.paused ? 'Resume' : 'Pause');
      pause.onclick = function () { UI.setPaused(!UI.paused); };
      right.appendChild(pause);
      const step = el('button', null, 'Step');
      step.disabled = !UI.paused;
      step.setAttribute('data-tip', 'Play the next bot action (while paused).');
      step.onclick = UI.stepOnce;
      right.appendChild(step);
      const lab = el('label', 'speed');
      lab.appendChild(document.createTextNode('Speed '));
      const r = el('input');
      r.type = 'range'; r.min = '0'; r.max = '4'; r.step = '1';
      const SPEEDS = [2.2, 1.5, 1, 0.6, 0.3];
      r.value = String(Math.max(0, SPEEDS.indexOf(UI.speed || 1)));
      r.oninput = function () { UI.speed = SPEEDS[Number(r.value)]; LC.anim.setSpeed(UI.speed); };
      lab.appendChild(r);
      right.appendChild(lab);
    }
    bar.appendChild(right);
  }

  function renderVariants(s) {
    const bar = $('choice-bar');
    if (bar.dataset.owner === 'variants' || !UI.variants) {
      if (bar.dataset.owner === 'variants') { bar.textContent = ''; bar.classList.remove('open'); bar.dataset.owner = ''; }
    }
    if (!UI.variants) return;
    bar.textContent = '';
    bar.dataset.owner = 'variants';
    const v = UI.variants;
    bar.appendChild(el('span', 'choice-bar-prompt', 'How do you pay for ' + fullNm(s, v.iid) + '?'));
    v.actions.forEach(function (a) {
      const b = el('button', 'action-btn', UI.actionLabel(s, a));
      b.onclick = function () { UI.doAction(a); };
      hintOn(b, a.onto != null ? a.onto : a.singer);
      bar.appendChild(b);
    });
    const cancel = el('button', null, 'Cancel');
    cancel.onclick = function () { UI.variants = null; UI.render(); };
    bar.appendChild(cancel);
    bar.classList.add('open');
  }

  // Re-anchor overlays and re-measure the fan when the window changes size.
  let resizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (UI.state && !LC.anim.busy()) UI.render(); }, 120);
  });
})();
