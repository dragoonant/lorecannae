// js/ui/hud.js — the chrome around the board (PRESENTATION-REFERENCE A7, B2): the log
// drawer and its controls, the turn banner (every turn — Lorcana turns alternate
// cleanly, so per-turn does not strobe), the card action popover, the hot-seat curtain,
// the How-to-play panel and the results panel. None of it is game state.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  let drawerOpen = false;
  let bannerKey = null;
  let popoverFor = null;
  let curtainFor = null, curtainCb = null;
  let finished = false;

  function setDrawer(on) {
    drawerOpen = on;
    document.body.classList.toggle('drawer-open', on);
    $('log-handle').setAttribute('aria-expanded', String(on));
  }

  function syncControls() {
    const m = $('mute-btn');
    m.textContent = LC.sound.isMuted() ? 'Sound: off' : 'Sound: on';
    m.classList.toggle('is-muted', LC.sound.isMuted());
    const a = $('anim-btn');
    const mode = LC.anim.mode();
    a.textContent = 'Animations: ' + (mode === 'full' ? 'full' : mode === 'quick' ? 'quick' : 'off');
    $('volume').value = String(Math.round(LC.sound.volume() * 100));
    const ui = LC.ui;
    const live = ui.state && !LC.isTerminal(ui.state) && ui.humanSeatForConcede() != null;
    $('concede-btn').disabled = !live;
    $('new-game-btn').textContent = live ? 'New game (concedes)' : 'New game';
  }

  // ---- banner -------------------------------------------------------------------------
  function showBanner(main, sub) {
    const node = $('turn-banner');
    node.textContent = '';
    node.appendChild(el('div', 'turn-banner-main', main));
    if (sub) node.appendChild(el('div', 'turn-banner-sub', sub));
    node.classList.remove('show');
    void node.offsetWidth;                  // restart the keyframes on a node mid-fade
    node.classList.add('show');
  }
  function maybeBanner(s) {
    if (LC.isTerminal(s) || s.phase !== 'main') return;
    const key = s.turn + ':' + s.active;
    if (key === bannerKey) return;
    bannerKey = key;
    const ui = LC.ui;
    const vs = ui.mode === 'ai' || ui.mode === 'tutorial';
    const main = vs ? (s.active === 0 ? 'Your turn' : 'Opponent’s turn') : ui.names[s.active] + '’s turn';
    showBanner(main, 'Turn ' + s.turn);
    LC.sound.sfx('turn');
  }

  // ---- the action popover ---------------------------------------------------------------
  // A tap on your own card asks what to do with it ON that card, enlarged, one button per
  // legal action, each saying what it does with its numbers. Disabled reasons are shown
  // too, so a card that can't act explains itself instead of looking broken.
  function reasons(s, iid) {
    const out = [];
    const c = s.cards[iid];
    if (c.zone === 'hand') {
      const why = LC.whyNot(s, iid);
      if (why) out.push('Play: ' + why);
      const wi = LC.whyNotInk(s, iid);
      if (wi) out.push('Ink: ' + wi);
      return out;
    }
    const ch = LC.chars(s, iid);
    if (ch.type === 'character') {
      if (ch.exerted) out.push('Exerted: it readies at the start of your next turn.');
      else if (ch.drying && !ch.kw.Rush) out.push('Drying: it arrived this turn, so it can’t quest or challenge until your next turn.');
      else if (ch.drying && ch.kw.Rush) out.push('Drying, but Rush lets it challenge this turn (it still can’t quest).');
      if (!ch.canQuest && !ch.exerted) out.push(ch.kw.Reckless ? 'Reckless: it can’t quest.' : 'It can’t quest right now.');
    }
    ch.activated.forEach(function (ab) {
      if (!ab.usable) out.push((ab.name || 'Ability') + ': ' + ab.why);
    });
    return out;
  }
  function openActions(iid) {
    const ui = LC.ui, s = ui.state;
    LC.preview.hide();
    const acts = LC.legalActions(s).filter(function (a) { return a.iid === iid && a.type !== 'end'; });
    const node = $('action-popover');
    node.textContent = '';
    const box = el('div', 'pop-box');
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    const c = s.cards[iid];
    box.appendChild(el('div', 'pop-title', LC.fullName(LC.CARDS[c.id])));
    const body = el('div', 'pop-body');
    body.appendChild(LC.preview.face(c.id, iid, s));
    const btns = el('div', 'pop-buttons');
    // Challenges are listed per target; everything else in a fixed, readable order.
    const order = { ink: 5, play: 1, quest: 2, challenge: 3, activate: 4, boost: 4 };
    acts.sort(function (a, b) { return (order[a.type] || 9) - (order[b.type] || 9); });
    acts.forEach(function (a) {
      const b = el('button', 'action-btn', ui.actionLabel(s, a));
      b.onclick = function () { close(); ui.doAction(a); };
      ui.hintOn(b, a.target != null ? a.target : (a.onto != null ? a.onto : a.singer));
      btns.appendChild(b);
    });
    if (!acts.length) btns.appendChild(el('div', 'pop-empty', 'Nothing to do with this card right now.'));
    const why = reasons(s, iid);
    if (why.length) {
      const w = el('div', 'pop-why');
      why.forEach(function (t) { w.appendChild(el('div', null, t)); });
      btns.appendChild(w);
    }
    if (c.zone === 'play' && acts.some(function (a) { return a.type === 'challenge'; })) {
      btns.appendChild(el('div', 'pop-tip', 'Tip: drag this character onto an exerted rival to challenge it, or onto your lore track to quest.'));
    } else if (c.zone === 'hand' && acts.length) {
      btns.appendChild(el('div', 'pop-tip', 'Tip: drag the card onto your play area to play it, or onto your inkwell to ink it.'));
    }
    const cl = el('button', 'peek-btn', 'Close');
    cl.onclick = close;
    btns.appendChild(cl);
    body.appendChild(btns);
    box.appendChild(body);
    node.appendChild(box);
    node.classList.add('open');
    node.onclick = close;
    popoverFor = iid;
  }
  function close() {
    popoverFor = null;
    const node = $('action-popover');
    node.classList.remove('open');
    node.textContent = '';
    LC.ui.hint(null);
  }

  // ---- hot-seat curtain -------------------------------------------------------------------
  function curtain(seat, cb) {
    const node = $('curtain');
    if (seat == null) { curtainFor = null; node.classList.remove('open'); return; }
    if (curtainFor === seat && node.classList.contains('open')) { curtainCb = cb; return; }
    curtainFor = seat; curtainCb = cb;
    node.textContent = '';
    const box = el('div', 'curtain-box');
    const s = LC.ui.state;
    box.appendChild(el('div', 'curtain-title', 'Pass the device to ' + LC.ui.names[seat]));
    const what = s.ask ? (s.ask.kind === 'mulligan' ? 'to choose their opening hand' : 'to answer a choice') : 'for their turn';
    box.appendChild(el('div', 'curtain-sub', LC.ui.names[seat] + ', click when you are ready ' + what + '. Your hand is hidden until then.'));
    const b = el('button', 'action-btn', 'I’m ' + LC.ui.names[seat] + ' — show my hand');
    b.onclick = function () { node.classList.remove('open'); curtainFor = null; const f = curtainCb; curtainCb = null; if (f) f(); };
    box.appendChild(b);
    node.appendChild(box);
    node.classList.add('open');
    b.focus();
  }

  // ---- results -----------------------------------------------------------------------------
  function stats(s) {
    const quest = [{}, {}];
    s.log.forEach(function (l) {
      if (l.type === 'quest' && s.cards[l.iid]) {
        const o = s.cards[l.iid].owner;
        quest[o][l.iid] = (quest[o][l.iid] || 0) + l.lore;
      }
    });
    return [0, 1].map(function (p) {
      let best = null;
      Object.keys(quest[p]).forEach(function (iid) { if (!best || quest[p][iid] > best.n) best = { iid: iid, n: quest[p][iid] }; });
      return { lore: s.players[p].lore, ink: s.players[p].ink.length, best: best };
    });
  }
  function showResults(s) {
    const node = $('results');
    node.textContent = '';
    const ui = LC.ui;
    const vs = ui.mode === 'ai' || ui.mode === 'tutorial';
    const box = el('div', 'results-box');
    const won = s.winner;
    const title = vs ? (won === 0 ? 'Victory!' : 'Defeat') : ui.names[won] + ' wins!';
    const art = LC.uiArtUrl(vs ? (won === 0 ? 'victory' : 'defeat') : 'victory');
    if (art) box.style.setProperty('--results-art', 'url("' + art + '")');
    box.appendChild(el('div', 'results-title' + (vs && won !== 0 ? ' is-loss' : ''), title));
    const why = { lore: 'reached 20 lore', deckout: 'won when the other deck ran out', concede: 'won by concession' }[s.endReason] || '';
    box.appendChild(el('div', 'results-sub', (vs ? (won === 0 ? 'You ' : 'The opponent ') : ui.names[won] + ' ') + why + ' on turn ' + s.turn + '.'));
    const st = stats(s);
    const table = el('div', 'results-table');
    [0, 1].forEach(function (p) {
      const col = el('div', 'results-col' + (p === won ? ' is-winner' : ''));
      col.appendChild(el('div', 'results-name', (vs ? (p === 0 ? 'You' : 'Opponent') : ui.names[p]) + ' · ' + s.players[p].deckName));
      col.appendChild(el('div', 'results-lore', String(st[p].lore)));
      col.appendChild(el('div', 'results-meta', 'lore · ' + st[p].ink + ' cards inked'));
      if (st[p].best && s.cards[st[p].best.iid]) {
        const b = el('div', 'results-best');
        b.appendChild(document.createTextNode('Top quester: '));
        const r = el('span', 'card-ref', LC.CARDS[s.cards[st[p].best.iid].id].name);
        r.dataset.cardId = s.cards[st[p].best.iid].id;
        b.appendChild(r);
        b.appendChild(document.createTextNode(' (' + st[p].best.n + ' lore)'));
        col.appendChild(b);
      }
      table.appendChild(col);
    });
    box.appendChild(table);
    box.appendChild(el('div', 'results-note', 'Every hand and inkwell is now face up — close this to read the board back.'));
    const row = el('div', 'results-buttons');
    const re = el('button', 'action-btn', 'Rematch (same decks)');
    re.onclick = function () { node.classList.remove('open'); ui.rematch(); };
    const ng = el('button', 'action-btn', 'New game');
    ng.onclick = function () { node.classList.remove('open'); LC.title.openPicker(); };
    const lk = el('button', null, 'Look at the board');
    lk.onclick = function () { node.classList.remove('open'); };
    row.appendChild(re); row.appendChild(ng); row.appendChild(lk);
    box.appendChild(row);
    node.appendChild(box);
    node.classList.add('open');
  }

  // ---- how to play ----------------------------------------------------------------------------
  const HELP = [
    ['Goal', 'Be the first to reach 20 lore. Characters earn lore by questing.'],
    ['Your turn', 'Everything readies, you draw a card (the first player skips the very first draw), then you act in any order and click End turn.'],
    ['Ink', 'Once per turn you may put a card with the gold ring around its cost into your inkwell (drag it there). Each ready ink pays 1 for playing cards; ink readies every turn.'],
    ['Playing cards', 'Drag a card onto your play area (or tap it and pick an option). Characters arrive drying: they can’t quest or challenge until your next turn.'],
    ['Questing', 'Drag a ready, dry character onto your lore track (or tap it → Quest). It exerts (turns sideways) and you gain its lore ◆.'],
    ['Challenging', 'Drag a ready, dry character onto an EXERTED opposing character. Both deal damage equal to their strength at once; a character with damage equal to its willpower is banished.'],
    ['Songs', 'Songs are actions. Instead of paying ink, you may exert one of your characters whose cost is at least the song’s cost to sing it (drag the song onto that character).'],
    ['Items', 'Items stay in play in their own lane; many have abilities you use from the card’s options.'],
    ['Reading the table', 'Hover any face-up card for its full text and keyword help. Click a discard pile, your deck or your inkwell to look through it. The log drawer on the right edge shows everything that happened.'],
  ];
  function openHelp() {
    const node = $('help');
    node.textContent = '';
    const box = el('div', 'help-box');
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    const head = el('div', 'help-head');
    head.appendChild(el('h2', null, 'How to play'));
    const x = el('button', null, 'Close');
    x.onclick = function () { node.classList.remove('open'); };
    head.appendChild(x);
    box.appendChild(head);
    const body = el('div', 'help-body');
    HELP.forEach(function (h) { body.appendChild(el('h3', null, h[0])); body.appendChild(el('p', null, h[1])); });
    box.appendChild(body);
    node.appendChild(box);
    node.onclick = function () { node.classList.remove('open'); };
    node.classList.add('open');
  }

  function saveReport() {
    const ui = LC.ui;
    if (!ui.trace) return;
    const t = Object.assign({}, ui.trace, { saved: new Date().toISOString(),
      log: ui.state ? ui.state.log : [] });
    // Download name says what it is; the file carries ids only (safe to paste anywhere).
    const blob = new Blob([JSON.stringify(t, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lorecannae-trace-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  LC.hud = {
    init: function () {
      $('log-handle').onclick = function () { setDrawer(!drawerOpen); };
      $('side-close').onclick = function () { setDrawer(false); };
      $('mute-btn').onclick = function () { LC.sound.toggleMute(); syncControls(); };
      $('volume').oninput = function () { LC.sound.setVolume(Number(this.value) / 100); };
      $('anim-btn').onclick = function () { LC.anim.cycleMode(); syncControls(); };
      $('new-game-btn').onclick = function () {
        setDrawer(false);
        const ui = LC.ui;
        if (ui.state && !LC.isTerminal(ui.state)) {
          const seat = ui.humanSeatForConcede();
          if (seat != null) ui.concede(seat);
        }
        $('results').classList.remove('open');
        LC.title.openPicker();
      };
      $('concede-btn').onclick = function () {
        const ui = LC.ui;
        const seat = ui.humanSeatForConcede();
        if (seat == null || !ui.state || LC.isTerminal(ui.state)) return;
        setDrawer(false);
        ui.concede(seat);
      };
      $('help-btn').onclick = openHelp;
      $('report-btn').onclick = saveReport;
      $('turn-banner').onclick = function () { this.classList.remove('show'); };
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const modal = $('choice-modal');
        if (modal && modal.classList.contains('open')) return;   // Esc is the modal's peek
        if (popoverFor != null) { close(); return; }
        if ($('help').classList.contains('open')) { $('help').classList.remove('open'); return; }
        if (drawerOpen) setDrawer(false);
      });
      syncControls();
      setDrawer(false);
    },
    reset: function () { bannerKey = null; finished = false; close(); $('results').classList.remove('open'); setDrawer(false); },
    render: function (s) {
      maybeBanner(s);
      if (popoverFor != null && (!s.cards[popoverFor] || LC.whoActs(s) !== LC.ui.viewSeat)) close();
      syncControls();
      LC.sound.match(s);
    },
    openActions: openActions,
    closeActions: close,
    curtain: curtain,
    showResults: showResults,
    openHelp: openHelp,
    // The match just ended (after its finale played): music, then the results panel.
    finish: function (s) {
      if (finished) return;
      finished = true;
      const ui = LC.ui;
      const vs = ui.mode === 'ai' || ui.mode === 'tutorial';
      LC.sound.ending(vs ? s.winner === 0 : true);
      setTimeout(function () { if (LC.ui.state === s) showResults(s); }, 700);
    },
    setDrawer: setDrawer,
  };
})();
