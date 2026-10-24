// js/ui/sound.js — every audio decision (PRESENTATION-REFERENCE A9, kb/LESSONS-DIGEST §6).
//
//  * SFX ride the structured log: an entry's `sound` tag, else a mapping from its type.
//    One clip per tag per action; frequent tags are rate-limited. Tags the animation
//    owns (quest, challenge, hit, banish, lore, song...) are voiced by js/ui/anim.js at
//    the moment of the picture, never at apply time.
//  * ONE AudioContext for everything, plus the iPadOS survival kit (silent looping media
//    element held from a gesture, unlock on any gesture, wake on every state change,
//    rebuild a context parked for good).
//  * Music: menu track on the title screens; in a match three tiers keyed to the HIGHEST
//    lore on the table (<10 / <16 / >=16), crossfading; victory/defeat stings.
//  * A clip missing from LC.AUDIO is never silence: each tag has a procedural Web Audio
//    voice. A missing LC.AUDIO MODULE is a broken build (main.js throws).
//
// Ids looked up in LC.AUDIO (data/audio-manifest.js):
//   sfx:   the ids tools/gen-audio.mjs renders (card-play, ink-card, quest, ...), reached
//          from UI tags through CLIP below
//   music: menu, battle-1, battle-2, battle-3, victory, defeat  (see MUSIC_IDS)
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;

  const TYPE_TAG = { ink: 'ink', play: 'play', quest: 'quest', challenge: 'challenge', damage: 'hit',
    banish: 'banish', draw: 'draw', shuffle: 'shuffle', heal: 'heal', exert: 'exert', ready: 'ready',
    boost: 'boost', ability: 'ability', turn: 'turn', discard: 'discard', fizzle: 'fizzle',
    reveal: 'reveal', lore: 'lore', win: 'win', toDiscard: 'discard', toHand: 'draw', mulligan: 'mulligan' };
  const ANIM_OWNED = { quest: 1, challenge: 1, hit: 1, banish: 1, lore: 1, song: 1, exert: 1, discard: 1, heal: 1, win: 1, ability: 1 };
  const MIN_GAP_MS = { draw: 120, hit: 80, exert: 90, ready: 200, ink: 120, turn: 600, click: 40 };
  const MUSIC_IDS = {
    menu: ['menu', 'title', 'music-menu'],
    tier1: ['battle-1', 'tier1', 'tier-1', 'music-1'],
    tier2: ['battle-2', 'tier2', 'tier-2', 'music-2'],
    tier3: ['battle-3', 'tier3', 'tier-3', 'music-3'],
    victory: ['victory', 'win', 'end-win'],
    defeat: ['defeat', 'loss', 'lose', 'end-loss'],
  };

  // UI tag -> clip id in LC.AUDIO.sfx (the ids tools/gen-audio.mjs renders).
  const CLIP = { ink: 'ink-card', play: 'card-play', item: 'item-play', lore: 'lore-tick', hit: 'damage',
    draw: 'card-draw', ability: 'glimmer', turn: 'turn-start', win: 'victory-sting', lose: 'defeat-sting',
    fizzle: 'error', reveal: 'page-turn' };
  let muted = !!U.store.get('muted', false);
  let volume = Number(U.store.get('volume', 0.8));
  if (!(volume >= 0 && volume <= 1)) volume = 0.8;

  // ---- the context and the iPad kit -------------------------------------------------
  let ctx = null, master = null, stuck = 0, poll = null;
  function actx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      ctx.onstatechange = wake;
      if (poll == null) poll = setInterval(wake, 1000);
    }
    return ctx;
  }
  function wake() {
    if (!ctx) return;
    if (ctx.state === 'running') { stuck = 0; return; }
    if (ctx.state === 'closed' || (ctx.state === 'interrupted' && ++stuck > 3)) { rebuild(); return; }
    try { ctx.resume(); } catch (e) { /* resumes on the next gesture */ }
  }
  function rebuild() {
    const old = ctx;
    stuck = 0; ctx = null; master = null;
    Music.current = null;
    try { if (old && old.state !== 'closed') old.close(); } catch (e) { /* already gone */ }
    if (actx() && Music.want) playTrack(Music.want, true);
  }
  let holder = null;
  function silentWavUrl() {
    const sr = 8000, n = sr / 2;
    const bytes = new Uint8Array(44 + n);
    const dv = new DataView(bytes.buffer);
    function tag(off, s) { for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i); }
    tag(0, 'RIFF'); dv.setUint32(4, 36 + n, true); tag(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    tag(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) bytes[44 + i] = 128;
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(s);
  }
  // A page whose only output is Web Audio rides the iPad RINGER and Silent mode; holding
  // one silent media element open promotes it to the media session. Never stopped: it was
  // elements starting and stopping that parked contexts.
  function holdSession() {
    try {
      if (!holder) { holder = new Audio(silentWavUrl()); holder.loop = true; holder.volume = 0.001; holder.setAttribute('playsinline', ''); }
      if (holder.paused) { const p = holder.play(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* no media support */ }
  }
  let unlocked = false;
  function unlock() {
    const c = actx();
    holdSession();
    if (!c) return;
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
    } catch (e) { /* torn down */ }
    wake();
    if (!unlocked) { unlocked = true; if (Music.want) playTrack(Music.want, true); }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, unlock, true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { wake(); holdSession(); } });
  window.addEventListener('focus', function () { wake(); });
  window.addEventListener('pageshow', function () { wake(); });

  function decode(c, ab) {
    return new Promise(function (resolve, reject) {
      const p = c.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  const buffers = {}, loading = {}, failed = {};
  function load(src) {
    const c = actx();
    if (!c || !src) return Promise.resolve(null);
    if (buffers[src]) return Promise.resolve(buffers[src]);
    if (failed[src]) return Promise.resolve(null);
    if (!loading[src]) {
      loading[src] = fetch(src).then(function (r) { if (!r.ok) throw new Error(src + ' ' + r.status); return r.arrayBuffer(); })
        .then(function (ab) { return decode(c, ab); })
        .then(function (b) { buffers[src] = b; return b; })
        .catch(function (e) { failed[src] = true; console.warn('[sound] ' + e.message); return null; });
    }
    return loading[src];
  }

  // ---- SFX ------------------------------------------------------------------------------
  const lastAt = {};
  function sfx(tag) {
    if (muted) return;
    const now = performance.now();
    if (lastAt[tag] && now - lastAt[tag] < (MIN_GAP_MS[tag] || 60)) return;
    lastAt[tag] = now;
    const c = actx();
    if (!c || !master) return;
    const entry = LC.AUDIO.sfx[CLIP[tag] || tag] || LC.AUDIO.sfx[tag];
    if (entry && entry.src && !failed[entry.src]) {
      const buf = buffers[entry.src];
      if (buf) {
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = entry.gain != null ? entry.gain : 0.5;
        src.connect(g).connect(master); src.start();
        return;
      }
      load(entry.src);           // decode for next time; voice it procedurally now
    }
    synth(tag);
  }

  // Procedural voices: short, soft, storybook-ish (bells, plucks, chimes). The floor so a
  // missing clip is never silence — not a substitute for the real kit.
  function tone(freq, t0, dur, type, gain, glideTo) {
    const c = ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, gain, lp) {
    const c = ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 2000;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }
  const SYNTH = {
    ink: function (t) { tone(220, t, 0.25, 'sine', 0.18, 140); noise(t, 0.12, 0.05, 900); },
    play: function (t) { tone(523, t, 0.18, 'triangle', 0.14); tone(784, t + 0.06, 0.25, 'triangle', 0.1); },
    item: function (t) { tone(660, t, 0.12, 'square', 0.05); tone(990, t + 0.05, 0.2, 'triangle', 0.08); },
    song: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.09, 0.4, 'sine', 0.1); }); },
    quest: function (t) { tone(880, t, 0.3, 'sine', 0.12); tone(1320, t + 0.08, 0.35, 'sine', 0.08); },
    lore: function (t) { tone(1175, t, 0.5, 'sine', 0.14); tone(1568, t + 0.05, 0.6, 'sine', 0.08); },
    challenge: function (t) { noise(t, 0.25, 0.18, 1400); tone(180, t, 0.2, 'sawtooth', 0.06, 90); },
    hit: function (t) { noise(t, 0.14, 0.25, 2600); tone(120, t, 0.16, 'sine', 0.2, 60); },
    banish: function (t) { tone(660, t, 0.6, 'sine', 0.1, 110); noise(t, 0.5, 0.06, 1200); },
    draw: function (t) { noise(t, 0.09, 0.08, 5000); },
    shuffle: function (t) { for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.05, 0.06, 4500); },
    heal: function (t) { tone(660, t, 0.35, 'sine', 0.1, 990); },
    exert: function (t) { noise(t, 0.07, 0.06, 1800); },
    ready: function (t) { tone(440, t, 0.1, 'triangle', 0.05); },
    boost: function (t) { tone(330, t, 0.2, 'triangle', 0.1, 660); },
    ability: function (t) { tone(740, t, 0.22, 'triangle', 0.1, 1110); },
    turn: function (t) { tone(392, t, 0.35, 'sine', 0.1); tone(587, t + 0.12, 0.45, 'sine', 0.08); },
    click: function (t) { tone(1200, t, 0.04, 'square', 0.03); },
    win: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, t + i * 0.11, 0.9, 'triangle', 0.1); }); },
    lose: function (t) { [392, 349, 311, 262].forEach(function (f, i) { tone(f, t + i * 0.18, 0.8, 'sine', 0.1); }); },
    discard: function (t) { noise(t, 0.16, 0.08, 1500); },
    shift: function (t) { tone(330, t, 0.45, 'sine', 0.1, 990); tone(660, t + 0.2, 0.3, 'triangle', 0.06); },
    mulligan: function (t) { for (let i = 0; i < 3; i++) noise(t + i * 0.06, 0.06, 0.06, 4000); },
    fizzle: function (t) { tone(300, t, 0.3, 'sawtooth', 0.04, 150); },
    reveal: function (t) { tone(988, t, 0.25, 'sine', 0.08); },
  };
  function synth(tag) {
    const fn = SYNTH[tag];
    if (!fn || !ctx || ctx.state !== 'running') return;
    try { fn(ctx.currentTime + 0.005); } catch (e) { /* context torn down mid-call */ }
  }

  // ---- music ------------------------------------------------------------------------------
  const Music = { want: null, current: null };
  function musicEntry(role) {
    const ids = MUSIC_IDS[role] || [role];
    for (let i = 0; i < ids.length; i++) if (LC.AUDIO.music[ids[i]]) return LC.AUDIO.music[ids[i]];
    return null;
  }
  const warnedMusic = {};
  // RMS-envelope loop span: the sustained body, not the fade-in or closing decrescendo.
  const spanCache = new WeakMap();
  function loopSpan(buf) {
    if (spanCache.has(buf)) return spanCache.get(buf);
    const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.max(1, Math.round(sr * 0.05));
    const env = [];
    for (let i = 0; i + win <= d.length; i += win) {
      let sum = 0;
      for (let j = i; j < i + win; j++) sum += d[j] * d[j];
      env.push(Math.sqrt(sum / win));
    }
    let span = { start: 0, end: buf.duration };
    const loud = env.filter(function (v) { return v > 0.004; }).sort(function (a, b) { return a - b; });
    if (loud.length) {
      const thr = Math.max(0.004, loud[Math.floor(loud.length / 2)] * 0.8);
      let lo = 0, hi = env.length - 1;
      while (lo < env.length && env[lo] < thr) lo++;
      while (hi > lo && env[hi] < thr) hi--;
      const start = Math.min(lo + 1, hi) * win / sr, end = Math.min(d.length, (hi + 1) * win) / sr;
      if (end - start > 1) span = { start: start, end: end };
    }
    spanCache.set(buf, span);
    return span;
  }
  function fadeOut(cur, t) {
    if (!cur || !ctx) return;
    try {
      cur.gain.gain.cancelScheduledValues(ctx.currentTime);
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, ctx.currentTime);
      cur.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + t);
      cur.src.stop(ctx.currentTime + t + 0.05);
    } catch (e) { /* already stopped */ }
  }
  const ROLE_GAIN = { menu: 0.22, tier1: 0.16, tier2: 0.21, tier3: 0.26, victory: 0.3, defeat: 0.3 };
  function playTrack(role, force) {
    Music.want = role;
    if (!force && Music.current && Music.current.role === role) return;
    const entry = musicEntry(role);
    if (!entry) {
      if (!warnedMusic[role]) { warnedMusic[role] = true; console.warn('[sound] no music for "' + role + '" in LC.AUDIO.music'); }
      fadeOut(Music.current, 0.9); Music.current = null;
      return;
    }
    const c = actx();
    if (!c || !unlocked) return;
    load(entry.src).then(function (buf) {
      if (!buf || Music.want !== role || !ctx) return;
      if (Music.current && Music.current.role === role && !force) return;
      const once = role === 'victory' || role === 'defeat';
      const src = ctx.createBufferSource(); src.buffer = buf;
      if (!once) { const sp = loopSpan(buf); src.loop = true; src.loopStart = sp.start; src.loopEnd = sp.end; }
      const g = ctx.createGain();
      const level = (entry.gain != null ? entry.gain : 1) * (ROLE_GAIN[role] || 0.2);
      // The new tier comes in at full level; only the old one ducks out under it.
      g.gain.setValueAtTime(level, ctx.currentTime);
      src.connect(g).connect(master);
      src.start(0, once ? 0 : loopSpan(buf).start);
      fadeOut(Music.current, 1.6);
      Music.current = { role: role, src: src, gain: g };
    });
  }
  function stopMusic() { Music.want = null; fadeOut(Music.current, 0.9); Music.current = null; }

  function tierFor(s) {
    const hi = Math.max(s.players[0].lore, s.players[1].lore);
    return hi < 10 ? 'tier1' : hi < 16 ? 'tier2' : 'tier3';
  }

  LC.sound = {
    sfx: sfx,
    // Voice the fresh entries of one apply. `animated`: anim.js will voice its own tags.
    play: function (fresh, animated) {
      if (muted) return;
      const seen = {};
      fresh.forEach(function (l) {
        let tag = l.sound || TYPE_TAG[l.type];
        if (l.type === 'play') {
          const d = LC.CARDS[(LC.ui.state.cards[l.iid] || {}).id];
          if (d && U.isSong(d)) tag = 'song';
          else if (l.pay === 'shift' || l.pay === 'shiftAlt') tag = 'shift';
          else if (d && U.mainType(d) === 'item') tag = 'item';
        }
        if (!tag || seen[tag]) return;
        if (animated && ANIM_OWNED[tag]) return;
        seen[tag] = true;
        sfx(tag);
      });
    },
    menu: function () { playTrack('menu'); },
    match: function (s) { if (!LC.isTerminal(s)) playTrack(tierFor(s)); },
    ending: function (win) { playTrack(win ? 'victory' : 'defeat'); if (!musicEntry(win ? 'victory' : 'defeat')) sfx(win ? 'win' : 'lose'); },
    stop: stopMusic,
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      U.store.set('muted', muted);
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
      return muted;
    },
    volume: function () { return volume; },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      U.store.set('volume', volume);
      if (master && ctx && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    prewarm: function () {
      const c = actx();
      if (!c) return;
      Object.keys(LC.AUDIO.sfx).forEach(function (k) { const e = LC.AUDIO.sfx[k]; if (e && e.src) load(e.src); });
    },
    _debug: function () { return { ctx: ctx ? ctx.state : 'none', muted: muted, volume: volume, music: Music.current ? Music.current.role : null, want: Music.want, unlocked: unlocked }; },
  };
})();
