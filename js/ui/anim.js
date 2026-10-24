// js/ui/anim.js — the animation layer (PRESENTATION-REFERENCE A8, B2). Two halves:
//
//   plan(prev, next, fresh, viewSeat) — PURE. Turns the log entries one apply added into
//     steps. No DOM, no clock; safe to run headless.
//   run(steps, next, ctx, done) — DOM. Plays the steps on the OLD board (the caller has
//     not rendered `next` yet, so a banished card is still on screen to leave), patches
//     the numbers in place at each impact so the later redraw changes nothing, then hands
//     control back. Input is locked under #fx-lock meanwhile; any click or key skips.
//
// Lorcana's challenge damage is simultaneous and all of it is melee: every challenge
// lunges, and both damage numbers land on ONE impact beat (a starburst "pow" and a
// swirl). The look is storybook magic, not sci-fi: quests send a trail of golden
// sparkles to the lore trail, ability damage is a glittering magic missile in the
// source's ink colour, a banished card dissolves into motes that drift to its discard,
// inking is an ink-splash swirl, songs throw musical notes, a lore-20 win is fireworks.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el, $ = U.$;

  const D = {
    exert: 200,      // the quarter-turn before the action it pays for
    lunge: 480, recoil: 380,
    travel: 520,     // a bolt in the air
    impact: 460,
    diamond: 720,    // quest sparkle flying to the lore trail
    inkSplash: 560,  // the ink-splash swirl on the inkwell
    beatGap: 180,
    banishHold: 320, banishFly: 850,
    discardFly: 650,
    spotWait: 700,   // let a spotlight land before anything fires from it
    sparkle: 900,
    finaleCharge: 600, finaleBoom: 1700, finaleHold: 1000,
  };
  const RATE = { full: 1, quick: 0.45, off: 0 };

  const INK_FX = { Amber: '#ffcf5a', Amethyst: '#c08bff', Emerald: '#5fe39a', Ruby: '#ff6a6a', Sapphire: '#6ab8ff', Steel: '#d8e4ee' };

  // ======================= planning (pure) =======================
  function cardOf(prev, next, iid) { return (prev.cards && prev.cards[iid]) || (next.cards && next.cards[iid]) || null; }
  function inkColor(prev, next, iid) {
    const c = cardOf(prev, next, iid);
    const def = c && LC.CARDS[c.id];
    const inks = def ? U.inksOf(def) : [];
    return inks.length ? INK_FX[inks[0]] : '#ffe08a';
  }
  function wasInPlay(prev, iid) { const c = prev.cards[iid]; return !!(c && c.zone === 'play'); }

  LC.anim = LC.anim || {};
  LC.anim.plan = function (prev, next, fresh) {
    const steps = [];
    let spotted = false;
    for (let i = 0; i < fresh.length; i++) {
      const l = fresh[i];
      switch (l.type) {
        case 'play': {
          spotted = true;
          const singers = (l.singers && l.singers.length) ? l.singers.slice() : (l.singer != null ? [l.singer] : []);
          if ((l.pay === 'sing' || l.pay === 'singTogether') && singers.length) {
            steps.push({ kind: 'sing', singers: singers.filter(function (s) { return wasInPlay(prev, s); }), color: inkColor(prev, next, l.iid) });
          }
          break;
        }
        case 'quest':
          if (wasInPlay(prev, l.iid)) steps.push({ kind: 'quest', iid: l.iid, lore: l.lore, who: l.who });
          break;
        case 'ink':
          steps.push({ kind: 'ink', who: l.who, color: inkColor(prev, next, l.iid) });
          break;
        case 'challenge': {
          const st = { kind: 'challenge', iid: l.iid, target: l.target, hits: [] };
          // The challenge's damage follows it in the log; gather it into this one beat.
          while (i + 1 < fresh.length && fresh[i + 1].type === 'damage' && fresh[i + 1].challenge) {
            i++;
            st.hits.push({ iid: fresh[i].iid, amount: fresh[i].amount });
          }
          if (wasInPlay(prev, l.iid) && wasInPlay(prev, l.target)) steps.push(st);
          break;
        }
        case 'damage':
          if (!wasInPlay(prev, l.iid) && !(next.cards[l.iid] && next.cards[l.iid].zone === 'play')) break;
          steps.push({ kind: 'bolt', from: l.from != null ? l.from : (l.via != null ? l.via : null), to: l.iid,
            amount: l.amount, put: !!l.put, color: inkColor(prev, next, l.from != null ? l.from : l.via) });
          break;
        case 'heal':
          steps.push({ kind: 'heal', iid: l.iid, amount: l.amount });
          break;
        case 'banish':
          if (wasInPlay(prev, l.iid)) steps.push({ kind: 'banish', iid: l.iid, owner: prev.cards[l.iid].owner });
          break;
        case 'lore':
          if (l.amount < 0) steps.push({ kind: 'loreLoss', who: l.who, amount: -l.amount });
          break;
        case 'discard':
          steps.push({ kind: 'handDiscard', iid: l.iid, owner: cardOf(prev, next, l.iid) ? cardOf(prev, next, l.iid).owner : l.who });
          break;
        case 'win':
          // The light-burst finale is for reaching 20 lore; a concession or a deck-out ends quietly.
          if (l.reason === 'lore') steps.push({ kind: 'finale', who: l.who });
          break;
      }
    }
    if (steps.length && spotted) steps.unshift({ kind: 'wait', ms: D.spotWait });
    return steps;
  };

  // ======================= playback (DOM) =======================
  let mode = null;
  let speedMul = 1;           // spectate slider: >1 slower, <1 faster
  let job = null;

  function readMode() {
    if (mode) return mode;
    const saved = U.store.get('anim', null);
    mode = (saved === 'full' || saved === 'quick' || saved === 'off') ? saved : (U.reducedMotion() ? 'off' : 'full');
    return mode;
  }
  LC.anim.mode = readMode;
  LC.anim.setMode = function (m) { mode = m; U.store.set('anim', m); if (m === 'off') LC.anim.skip(); };
  LC.anim.cycleMode = function () {
    const order = ['full', 'quick', 'off'];
    LC.anim.setMode(order[(order.indexOf(readMode()) + 1) % order.length]);
    return mode;
  };
  LC.anim.setSpeed = function (k) { speedMul = k; };
  // Duration multiplier used by the spotlight and AI pacing too (0 when off).
  LC.anim.rate = function () { return (RATE[readMode()] || 0.0001) * speedMul; };
  LC.anim.busy = function () { return !!job; };
  LC.anim.willAnimate = function (steps) { return !!(steps && steps.length) && readMode() !== 'off'; };

  function ms(n) { return Math.round(n * RATE[readMode()] * speedMul); }
  function sfx(tag) { LC.sound.sfx(tag); }

  function layer() {
    let n = $('fx-layer');
    if (!n) { n = el('div'); n.id = 'fx-layer'; document.body.appendChild(n); }
    return n;
  }
  function lock(on) {
    let n = $('fx-lock');
    if (!n) {
      n = el('div'); n.id = 'fx-lock';
      n.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); LC.anim.skip(); });
      document.body.appendChild(n);
    }
    n.classList.toggle('open', !!on);
    document.body.classList.toggle('is-animating', !!on);
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); LC.anim.skip(); }
  }

  function cardNode(iid) { return document.querySelector('#mat .card[data-iid="' + iid + '"]'); }
  function slotNode(iid) { const c = cardNode(iid); return c ? c.closest('.char-slot') : null; }
  function sideOf(seat) { return seat === job.ctx.viewSeat ? 'my-' : 'enemy-'; }
  function zone(seat, what) { return $(sideOf(seat) + what); }
  function centre(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r: r };
  }
  function later(delay, fn) {
    if (!job) return;
    const t = setTimeout(function () {
      if (!job) return;
      const i = job.timers.indexOf(t); if (i >= 0) job.timers.splice(i, 1);
      fn();
    }, delay);
    job.timers.push(t);
  }

  // ---- in-place patching from the NEXT state -------------------------------------
  function patchCard(iid, next) {
    const node = cardNode(iid);
    if (!node) return;
    const c = next.cards[iid];
    if (!c || c.zone !== 'play') {
      const n = node.querySelector('.stat.wp .n'); if (n) n.textContent = '0';
      return;
    }
    const ch = LC.chars(next, iid);
    const wp = node.querySelector('.stat.wp');
    if (wp) { wp.querySelector('.n').textContent = String(ch.wp - ch.damage); wp.classList.toggle('damaged', ch.damage > 0); }
    let m = node.querySelector('.damage-marker');
    if (ch.damage > 0) { if (!m) { m = el('div', 'damage-marker'); node.appendChild(m); } m.textContent = String(ch.damage); }
    else if (m) m.remove();
  }
  function patchLore(seat, next) {
    const z = zone(seat, 'lore');
    if (z) LC.ui.placeLoreMarker(z, next.players[seat].lore);
  }

  function floatText(node, text, cls) {
    const c = centre(node);
    const n = el('div', 'fx-number ' + (cls || ''));
    n.textContent = text;
    n.style.left = c.x + 'px'; n.style.top = (c.y - c.h * 0.15) + 'px';
    n.style.setProperty('--dur', ms(900) + 'ms');
    layer().appendChild(n);
    job.trash.push(n);
    later(ms(950), function () { n.remove(); });
  }
  function shake(node) {
    node.classList.remove('fx-hit'); void node.offsetWidth; node.classList.add('fx-hit');
    later(ms(420), function () { node.classList.remove('fx-hit'); });
  }
  function burst(node, color, cls) {
    const c = centre(node);
    const size = Math.max(c.w, c.h) * 1.5;
    const s = el('div', 'fx-impact ' + (cls || ''));
    s.style.left = (c.x - size / 2) + 'px'; s.style.top = (c.y - size / 2) + 'px';
    s.style.width = size + 'px'; s.style.height = size + 'px';
    s.style.setProperty('--fx', color || '#ffd36b');
    s.style.setProperty('--dur', ms(D.impact) + 'ms');
    layer().appendChild(s);
    job.trash.push(s);
    later(ms(D.impact) + 40, function () { s.remove(); });
  }
  const JEWELS = ['#ffd36b', '#fff4c2', '#c4a2ef', '#6fd39a', '#f0828a', '#7fbdf0'];
  // Sparkle motes: n particles from (x, y) flung by (spread) with a drift, each a soft dot
  // or a four-point twinkle. opts: {colors, spread, up, size, dur}.
  function motes(x, y, n, opts) {
    opts = opts || {};
    const cols = opts.colors || ['#ffd36b', '#fff4c2'];
    const spread = opts.spread || 60, up = opts.up || 0, size = opts.size || 9, dur = opts.dur || 800;
    for (let i = 0; i < n; i++) {
      const star = i % 3 === 0;
      const m = el('div', 'fx-mote' + (star ? ' is-star' : ''));
      if (star) m.textContent = '✦';
      const a = Math.random() * Math.PI * 2, r = spread * (0.35 + Math.random() * 0.65);
      m.style.left = x + 'px'; m.style.top = y + 'px';
      m.style.setProperty('--dx', (Math.cos(a) * r).toFixed(1) + 'px');
      m.style.setProperty('--dy', (Math.sin(a) * r - up).toFixed(1) + 'px');
      m.style.setProperty('--c', cols[i % cols.length]);
      m.style.setProperty('--sz', (size * (0.6 + Math.random() * 0.8)).toFixed(1) + 'px');
      m.style.setProperty('--dur', ms(dur * (0.75 + Math.random() * 0.5)) + 'ms');
      layer().appendChild(m);
      job.trash.push(m);
    }
  }
  // A curved flight from a to b along a CSS offset-path (linear timing, so the sparkle
  // trail spawned along the same curve stays under the flyer). Returns the duration.
  function arcPath(a, b, lift) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - lift;
    return { d: 'M 0 0 Q ' + (mx - a.x).toFixed(1) + ' ' + (my - a.y).toFixed(1) + ' ' + (b.x - a.x).toFixed(1) + ' ' + (b.y - a.y).toFixed(1),
      at: function (t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y }; } };
  }
  function flyer(node, a, b, lift, dur, trailColors, cb) {
    const path = arcPath(a, b, lift);
    // Keyframes sampled from the same curve the trail uses (Web Animations, linear), so
    // the glitter is always laid down under the flyer.
    node.style.left = '0px'; node.style.top = '0px';
    const frames = [];
    for (let k = 0; k <= 16; k++) {
      const q = path.at(k / 16);
      frames.push({ transform: 'translate(' + q.x.toFixed(1) + 'px,' + q.y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + (k * 22) + 'deg)' });
    }
    node.style.transform = frames[0].transform;
    layer().appendChild(node);
    job.trash.push(node);
    if (node.animate) node.animate(frames, { duration: Math.max(1, dur), easing: 'linear', fill: 'forwards' });
    const n = Math.max(4, Math.round(dur / 45));
    for (let k = 1; k <= n; k++) {
      later(Math.round(dur * k / (n + 1)), function () {
        const q = path.at(k / (n + 1));
        motes(q.x, q.y, 2, { colors: trailColors, spread: 14, up: -10, size: 7, dur: 600 });
      });
    }
    later(dur, function () { node.remove(); cb(); });
  }
  // The challenge's "pow": a gilded starburst with a magic swirl ring behind it.
  function pow(node, color) {
    const c = centre(node);
    const size = Math.max(c.w, c.h) * 1.25;
    const ring = el('div', 'fx-swirlring');
    const star = el('div', 'fx-pow');
    [ring, star].forEach(function (n, i) {
      const sz = i ? size : size * 1.3;
      n.style.left = (c.x - sz / 2) + 'px'; n.style.top = (c.y - sz / 2) + 'px';
      n.style.width = sz + 'px'; n.style.height = sz + 'px';
      n.style.setProperty('--fx', color || '#ffd36b');
      n.style.setProperty('--dur', ms(D.impact + 160) + 'ms');
      layer().appendChild(n);
      job.trash.push(n);
    });
    motes(c.x, c.y, 14, { colors: JEWELS.slice(0, 3), spread: size * 0.7, size: 10, dur: 700 });
    later(ms(D.impact + 200), function () { ring.remove(); star.remove(); });
  }
  // The quarter-turn: the slot widens and the card turns, exactly as the redraw will
  // show it, so the action that exerted it reads as one continuous motion.
  function exertNow(iid) {
    const slot = slotNode(iid);
    if (slot && !slot.classList.contains('is-exerted')) { slot.classList.add('is-exerted'); sfx('exert'); return true; }
    return false;
  }

  function hitLand(hit, next) {
    const node = cardNode(hit.iid);
    if (!node) return;
    shake(node);
    if (hit.amount > 0) floatText(node, '−' + hit.amount, '');
    else floatText(node, '0', 'is-zero');
    patchCard(hit.iid, next);
  }

  function playChallenge(step, next, cb) {
    const from = cardNode(step.iid), to = cardNode(step.target);
    if (!from || !to) { step.hits.forEach(function (h) { hitLand(h, next); }); later(ms(D.impact), cb); return; }
    const exerted = exertNow(step.iid);
    later(exerted ? ms(D.exert) + 40 : 0, function () {
      const a = centre(from), b = centre(to);
      LC.arrow.draw({ x: a.x, y: a.y }, { x: b.x, y: b.y }, 'declared');
      const clone = from.cloneNode(true);
      clone.className = from.className.replace(/\b(role-\S+|drop-\S+)\b/g, '') + ' fx-clone';
      clone.removeAttribute('data-iid'); clone.removeAttribute('data-card-id');
      const rot = from.closest('.char-slot.is-exerted') ? ' rotate(90deg)' : '';
      clone.style.left = a.r.left + 'px'; clone.style.top = a.r.top + 'px';
      clone.style.width = from.offsetWidth + 'px'; clone.style.height = from.offsetHeight + 'px';
      clone.style.left = (a.x - from.offsetWidth / 2) + 'px'; clone.style.top = (a.y - from.offsetHeight / 2) + 'px';
      clone.style.transform = rot;
      layer().appendChild(clone);
      from.classList.add('fx-hidden');
      job.trash.push(clone); job.unhide.push(from);
      sfx('challenge');
      void clone.getBoundingClientRect();
      const dx = b.x - a.x, dy = b.y - a.y;
      const k = 1 - Math.min(0.35, (b.w * 0.45) / Math.max(1, Math.sqrt(dx * dx + dy * dy)));
      clone.style.transition = 'transform ' + ms(D.lunge) + 'ms cubic-bezier(.6,-.1,.9,.5)';
      clone.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)' + rot + ' scale(1.08)';
      later(ms(D.lunge), function () {
        // ONE impact beat: both sides' damage lands together (simultaneous, CR 4.6).
        sfx('hit');
        pow(to, '#ffd36b');
        step.hits.forEach(function (h) { hitLand(h, next); });
        LC.arrow.clear();
        clone.style.transition = 'transform ' + ms(D.recoil) + 'ms cubic-bezier(.2,.7,.4,1)';
        clone.style.transform = 'translate(0,0)' + rot + ' scale(1)';
        later(ms(D.recoil) + 20, function () { clone.remove(); from.classList.remove('fx-hidden'); cb(); });
      });
    });
  }

  // Ability damage: a glittering magic missile in the source's ink colour, arcing from
  // the card (or the spotlit action) to its target.
  function playBolt(step, next, cb) {
    const toNode = cardNode(step.to);
    if (!toNode) { cb(); return; }
    const fromNode = step.from != null ? (cardNode(step.from) || $('spotlight')) : $('spotlight');
    const land = function () {
      sfx('hit');
      const c = centre(toNode);
      burst(toNode, step.color, step.put ? 'fx-put' : 'fx-magic');
      motes(c.x, c.y, 12, { colors: [step.color, '#ffffff'], spread: c.w * 0.8, size: 9, dur: 700 });
      hitLand({ iid: step.to, amount: step.amount }, next);
      later(ms(D.impact), cb);
    };
    if (!fromNode || fromNode === toNode) { land(); return; }
    const a = centre(fromNode), b = centre(toNode);
    const orb = el('div', 'fx-orb');
    orb.style.setProperty('--fx', step.color);
    sfx('ability');
    flyer(orb, a, b, Math.min(160, Math.abs(b.x - a.x) * 0.3 + 60), ms(D.travel), [step.color, '#ffffff'], land);
  }

  // Questing: the card exerts, then a golden sparkle flies to the next star on the lore
  // trail, leaving glitter behind it; the star lights as it lands.
  function playQuest(step, next, cb) {
    const node = cardNode(step.iid);
    const dest = zone(step.who, 'lore');
    if (!node || !dest) { patchLore(step.who, next); cb(); return; }
    const exerted = exertNow(step.iid);
    later(exerted ? ms(D.exert) + 40 : 0, function () {
      const a = centre(node);
      const mark = LC.ui.loreStarNode(dest, next.players[step.who].lore);
      const b = centre(mark);
      const gem = el('div', 'fx-diamond');
      gem.innerHTML = U.iconHTML('L');
      sfx('quest');
      floatText(node, '+' + step.lore, 'is-lore');
      motes(a.x, a.y, 10, { colors: ['#ffd36b', '#fff4c2'], spread: a.w * 0.6, up: 20, size: 9, dur: 700 });
      flyer(gem, a, b, 120, ms(D.diamond), ['#ffd36b', '#fff4c2', '#ffe9a8'], function () {
        sfx('lore');
        patchLore(step.who, next);
        motes(b.x, b.y, 14, { colors: ['#ffd36b', '#ffffff'], spread: 46, size: 10, dur: 700 });
        dest.classList.remove('fx-received'); void dest.offsetWidth; dest.classList.add('fx-received');
        floatText(mark, '+' + step.lore, 'is-lore');
        later(ms(380), cb);
      });
    });
  }

  // Inking: an ink-splash swirl over the inkwell in the inked card's colour.
  function playInk(step, next, cb) {
    const z = zone(step.who, 'ink');
    if (!z) { cb(); return; }
    const fan = z.querySelector('.res-fan');
    const last = fan && fan.lastElementChild;
    const c = centre(last || z);
    const sz = Math.max(c.w, c.h) * 1.6;
    const sp = el('div', 'fx-splash');
    sp.style.left = (c.x - sz / 2) + 'px'; sp.style.top = (c.y - sz / 2) + 'px';
    sp.style.width = sz + 'px'; sp.style.height = sz + 'px';
    sp.style.setProperty('--fx', step.color);
    sp.style.setProperty('--dur', ms(D.inkSplash) + 'ms');
    layer().appendChild(sp);
    job.trash.push(sp);
    motes(c.x, c.y, 10, { colors: [step.color, '#ffffff'], spread: sz * 0.45, size: 8, dur: 600 });
    later(ms(D.inkSplash), function () { sp.remove(); cb(); });
  }

  function playSing(step, next, cb) {
    let any = false;
    step.singers.forEach(function (iid) {
      const node = cardNode(iid);
      if (!node) return;
      any = true;
      exertNow(iid);
      const c = centre(node);
      for (let i = 0; i < 7; i++) {
        const sp = el('div', 'fx-note');
        sp.textContent = i % 2 ? '♪' : '✦';
        sp.style.left = (c.x + (Math.random() - 0.5) * c.w * 0.8) + 'px';
        sp.style.top = (c.y + (Math.random() - 0.2) * c.h * 0.4) + 'px';
        sp.style.color = step.color;
        sp.style.setProperty('--dur', ms(D.sparkle) + 'ms');
        sp.style.animationDelay = ms(i * 70) + 'ms';
        layer().appendChild(sp);
        job.trash.push(sp);
      }
    });
    if (any) sfx('song');
    later(any ? ms(D.sparkle) : 0, cb);
  }

  function flyTo(node, rect, destNode, dur, cb) {
    const clone = node.cloneNode(true);
    clone.className = node.className.replace(/\b(role-\S+|drop-\S+|fx-hidden)\b/g, '') + ' fx-clone fx-flyer';
    clone.removeAttribute('data-iid'); clone.removeAttribute('data-card-id');
    clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px'; clone.style.height = rect.height + 'px';
    layer().appendChild(clone);
    job.trash.push(clone);
    void clone.getBoundingClientRect();
    let tx = 0, ty = -rect.height * 0.3, sc = 0.05;
    if (destNode) {
      const d = destNode.getBoundingClientRect();
      tx = (d.left + d.width / 2) - (rect.left + rect.width / 2);
      ty = (d.top + d.height / 2) - (rect.top + rect.height / 2);
      sc = Math.max(0.12, (d.height / rect.height) * 0.7);
    }
    clone.style.transition = 'transform ' + dur + 'ms cubic-bezier(.4,0,.8,.3), opacity ' + dur + 'ms ease-in';
    clone.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ') rotate(' + (tx > 0 ? 18 : -18) + 'deg)';
    clone.style.opacity = '0.15';
    later(dur, function () {
      clone.remove();
      if (destNode) { destNode.classList.remove('fx-received'); void destNode.offsetWidth; destNode.classList.add('fx-received'); }
      cb();
    });
  }

  // Banishing: the card dissolves into sparkles and ink motes, and what is left of it
  // drifts into its owner's discard pile.
  function playBanish(step, next, cb) {
    const node = cardNode(step.iid);
    if (!node) { cb(); return; }
    sfx('banish');
    shake(node);
    const r = node.getBoundingClientRect();
    later(ms(D.banishHold), function () {
      node.classList.add('fx-dissolve');
      node.style.setProperty('--dur', ms(D.banishFly * 0.7) + 'ms');
      job.unhide.push(node);
      for (let k = 0; k < 4; k++) {
        later(ms(k * 110), function () {
          motes(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 6,
            { colors: ['#c4a2ef', '#ffd36b', '#9fc8ff', '#ffffff'], spread: r.width * 0.5, up: 40, size: 10, dur: 900 });
        });
      }
      const dest = zone(step.owner, 'discard');
      later(ms(D.banishFly * 0.45), function () {
        node.classList.add('fx-hidden');
        if (!dest) { later(ms(300), cb); return; }
        const a = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, b = centre(dest);
        const orb = el('div', 'fx-orb is-ink');
        orb.style.setProperty('--fx', '#b48cff');
        flyer(orb, a, b, 60, ms(D.banishFly * 0.55), ['#c4a2ef', '#ffffff'], function () {
          dest.classList.remove('fx-received'); void dest.offsetWidth; dest.classList.add('fx-received');
          cb();
        });
      });
    });
  }

  function playHandDiscard(step, next, cb) {
    const bar = step.owner === job.ctx.viewSeat ? $('hand') : $('enemy-hand');
    const c = next.cards[step.iid];
    if (!bar || !c) { cb(); return; }
    const h = bar.getBoundingClientRect();
    const face = LC.renderCard(c.id, { size: 'hand' });
    face.style.position = 'fixed';
    const w = 90, hh = 126;
    sfx('discard');
    flyTo(face, { left: h.left + h.width / 2 - w / 2, top: h.top, width: w, height: hh }, zone(step.owner, 'discard'), ms(D.discardFly), cb);
  }

  function playLoreLoss(step, next, cb) {
    const z = zone(step.who, 'lore');
    if (!z) { cb(); return; }
    patchLore(step.who, next);
    floatText(LC.ui.loreStarNode(z, next.players[step.who].lore + step.amount), '−' + step.amount, 'is-lore-loss');
    sfx('fizzle');
    later(ms(600), cb);
  }

  function playHeal(step, next, cb) {
    const node = cardNode(step.iid);
    if (!node) { cb(); return; }
    floatText(node, '+' + step.amount, 'is-heal');
    burst(node, '#8ee0ac', 'fx-heal');
    sfx('heal');
    patchCard(step.iid, next);
    later(ms(D.impact), cb);
  }

  // The lore-20 finale: fireworks of jewel-coloured sparkles bursting over the winner's
  // lore trail and across the table, then a second of quiet before the results panel.
  // The hold is NOT scaled by speed: a pause to let the picture land, not part of it.
  function playFinale(step, next, cb) {
    const z = zone(step.who, 'lore');
    const charge = ms(D.finaleCharge), boom = ms(D.finaleBoom);
    const after = charge + boom + D.finaleHold;
    if (!z) { later(after, cb); return; }
    patchLore(step.who, next);
    const goal = centre(LC.ui.loreStarNode(z, 20));
    const glow = el('div', 'fx-finale-glow');
    const gs = Math.max(goal.w, goal.h) * 6;
    glow.style.left = (goal.x - gs / 2) + 'px'; glow.style.top = (goal.y - gs / 2) + 'px';
    glow.style.width = gs + 'px'; glow.style.height = gs + 'px';
    glow.style.setProperty('--dur', (charge + boom) + 'ms');
    layer().appendChild(glow);
    job.trash.push(glow);
    sfx('lore');
    const mat = $('mat').getBoundingClientRect();
    const spots = [goal,
      { x: mat.left + mat.width * 0.35, y: mat.top + mat.height * 0.3 },
      { x: mat.left + mat.width * 0.65, y: mat.top + mat.height * 0.25 },
      { x: mat.left + mat.width * 0.5, y: mat.top + mat.height * 0.5 },
      { x: mat.left + mat.width * 0.25, y: mat.top + mat.height * 0.65 },
      { x: mat.left + mat.width * 0.75, y: mat.top + mat.height * 0.6 }];
    spots.forEach(function (p, k) {
      later(charge + Math.round(boom * k / (spots.length + 1)), function () {
        if (k === 0) sfx('win');
        const cols = [JEWELS[k % JEWELS.length], JEWELS[(k + 2) % JEWELS.length], '#ffffff'];
        motes(p.x, p.y, 26, { colors: cols, spread: Math.min(220, mat.width * 0.16), up: -30, size: 12, dur: 1300 });
      });
    });
    later(after, function () { glow.remove(); cb(); });
  }

  function finish() {
    if (!job) return;
    const j = job;
    job = null;
    j.timers.forEach(clearTimeout);
    j.trash.forEach(function (n) { if (n && n.parentNode) n.remove(); });
    j.unhide.forEach(function (n) { n.classList.remove('fx-hidden', 'fx-hit'); });
    const l = $('fx-layer'); if (l) l.textContent = '';
    LC.arrow.clear();
    lock(false);
    document.removeEventListener('keydown', onKey, true);
    j.done();
  }
  LC.anim.skip = function () { finish(); };

  // ctx: {viewSeat}
  LC.anim.run = function (steps, next, ctx, done) {
    if (job) finish();
    if (!LC.anim.willAnimate(steps)) { done(); return; }
    job = { timers: [], trash: [], unhide: [], done: done, ctx: ctx, started: Date.now() };
    lock(true);
    document.addEventListener('keydown', onKey, true);
    let i = 0;
    function step() {
      if (!job) return;
      if (i >= steps.length) { finish(); return; }
      const s = steps[i++];
      const nxt = function () { later(ms(D.beatGap), step); };
      switch (s.kind) {
        case 'wait': later(ms(s.ms), step); break;
        case 'challenge': playChallenge(s, next, nxt); break;
        case 'bolt': playBolt(s, next, nxt); break;
        case 'quest': playQuest(s, next, nxt); break;
        case 'ink': playInk(s, next, nxt); break;
        case 'sing': playSing(s, next, nxt); break;
        case 'banish': playBanish(s, next, nxt); break;
        case 'handDiscard': playHandDiscard(s, next, nxt); break;
        case 'loreLoss': playLoreLoss(s, next, nxt); break;
        case 'heal': playHeal(s, next, nxt); break;
        case 'finale': playFinale(s, next, step); break;
        default: step();
      }
    }
    step();
  };
  // How long the current job has run (the bot's 5 s watchdog reads this).
  LC.anim.age = function () { return job ? Date.now() - job.started : 0; };
})();
