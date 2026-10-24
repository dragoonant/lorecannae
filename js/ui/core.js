// js/ui/core.js — shared UI plumbing: DOM helpers, the shared animation phase, ink
// colours, inline rules-text icons, persisted settings and the ONE shared tooltip.
// UI-only file (everything under js/ui/ is view layer; the engine never loads it).
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U = {};

  U.$ = function (id) { return document.getElementById(id); };
  U.el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  U.svgEl = function (tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  // A rebuilt node restarts its CSS animation, so a board redrawn after every action
  // would stutter its pulses back to frame one. Every pulse starts at the SAME
  // wall-clock phase instead (PRESENTATION-REFERENCE A6).
  U.animationPhase = function (periodMs) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return '-' + ((now % periodMs) / 1000).toFixed(3) + 's';
  };

  U.reducedMotion = function () {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  // ---- ink colours ----------------------------------------------------------
  // Tuned for legibility as dots on a dark scrim: Steel is lifted off grey-on-grey and
  // Amethyst is a touch lighter than the printed purple, or both vanish at board size.
  U.INK = {
    Amber:    { dot: '#f4b223', text: '#ffd36b' },
    Amethyst: { dot: '#8a5cc0', text: '#c4a2ef' },
    Emerald:  { dot: '#2e9e5b', text: '#6fd39a' },
    Ruby:     { dot: '#c8323c', text: '#f0828a' },
    Sapphire: { dot: '#2a7fc1', text: '#7fbdf0' },
    Steel:    { dot: '#9aaab8', text: '#cdd7e0' },
  };
  // A card's ink list. Dual-ink cards carry `inks`; some single-ink records carry
  // only `inks` (ink null), so this is the one reader of both fields.
  U.inksOf = function (def) {
    if (def.inks && def.inks.length) return def.inks.slice();
    return def.ink ? [def.ink] : [];
  };

  U.fullName = function (def) { return LC.fullName(def); };
  U.isSong = function (def) { return def.type.indexOf('Song') >= 0; };
  U.mainType = function (def) {
    if (def.type.indexOf('Character') >= 0) return 'character';
    if (def.type.indexOf('Item') >= 0) return 'item';
    if (def.type.indexOf('Location') >= 0) return 'location';
    return 'action';
  };

  // Deterministic PRNG from a string (cosmetic only: fallback art, sparkle jitter).
  U.rand = function (seedStr) {
    let a = LC.hashSeed(String(seedStr)) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---- persisted settings ---------------------------------------------------
  // localStorage can throw (private mode, blocked storage): every access is wrapped,
  // and a failure only loses the convenience, never the game.
  U.store = {
    get: function (key, dflt) {
      try {
        const v = localStorage.getItem('lc.' + key);
        return v == null ? dflt : JSON.parse(v);
      } catch (e) { return dflt; }
    },
    set: function (key, value) {
      try { localStorage.setItem('lc.' + key, JSON.stringify(value)); } catch (e) { /* convenience only */ }
    },
  };

  // ---- inline icons for rules text ------------------------------------------
  // Drawn geometry, never generated art. Each is sized in em so it rides the text.
  const ICON = {
    // {S} strength: a small upright sword.
    S: '<svg viewBox="0 0 16 16" class="ico ico-s"><path d="M8 1 L10 4 L10 10 L6 10 L6 4 Z" fill="currentColor"/><rect x="3.5" y="10" width="9" height="1.8" rx=".9" fill="currentColor"/><rect x="7" y="11.8" width="2" height="3.4" rx=".6" fill="currentColor"/></svg>',
    // {W} willpower: a shield.
    W: '<svg viewBox="0 0 16 16" class="ico ico-w"><path d="M8 1.2 L14 3.4 L13.4 8.6 C12.8 12 10.6 13.8 8 15 C5.4 13.8 3.2 12 2.6 8.6 L2 3.4 Z" fill="currentColor"/></svg>',
    // {L} lore: the diamond.
    L: '<svg viewBox="0 0 16 16" class="ico ico-l"><path d="M8 1 L14.5 8 L8 15 L1.5 8 Z" fill="currentColor"/><path d="M8 4 L11.2 8 L8 12 L4.8 8 Z" fill="rgba(0,0,0,.28)"/></svg>',
    // {I} ink: a hexagon with a drop.
    I: '<svg viewBox="0 0 16 16" class="ico ico-i"><path d="M8 .8 L14.4 4.4 L14.4 11.6 L8 15.2 L1.6 11.6 L1.6 4.4 Z" fill="currentColor"/><path d="M8 4.2 C9.6 6.6 10.6 7.8 10.6 9.2 A2.6 2.6 0 0 1 5.4 9.2 C5.4 7.8 6.4 6.6 8 4.2 Z" fill="rgba(0,0,0,.35)"/></svg>',
    // {E} exert: a quarter-turn arrow (the card turning sideways).
    E: '<svg viewBox="0 0 16 16" class="ico ico-e"><path d="M3 11 A5.5 5.5 0 1 1 11.4 12.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M13.8 9.8 L11.4 13.4 L8.6 10.8 Z" fill="currentColor"/></svg>',
  };
  U.iconHTML = function (k) { return ICON[k] || ''; };
  U.icon = function (k) {
    const span = U.el('span', 'ico-wrap');
    span.innerHTML = ICON[k] || '';
    return span;
  };

  // The ink-cost hexagon. `inkable` draws the inkwell ring around it (the printed card's
  // swirl): the one mark that says "this card can go into the inkwell".
  U.costHex = function (cost, inkable, cls) {
    const wrap = U.el('span', 'cost-hex' + (inkable ? ' is-inkable' : '') + (cls ? ' ' + cls : ''));
    wrap.innerHTML = '<svg viewBox="0 0 40 44" aria-hidden="true">' +
      (inkable ? '<path class="hex-ring" d="M20 1.5 L37.5 11.5 L37.5 32.5 L20 42.5 L2.5 32.5 L2.5 11.5 Z"/>' : '') +
      '<path class="hex-body" d="M20 5 L34 13 L34 31 L20 39 L6 31 L6 13 Z"/></svg>';
    wrap.appendChild(U.el('span', 'cost-num', String(cost)));
    return wrap;
  };

  // ---- the one shared tooltip ------------------------------------------------
  // No native title= tooltips anywhere: they are slow, unstyled and cannot be read on a
  // touch screen. Any node carrying data-tip gets this bubble, from ONE delegated
  // listener — opt-in per node is how earlier games ended up with modals that had none.
  let tipNode = null, tipFor = null;
  function tip() {
    if (!tipNode) { tipNode = U.el('div'); tipNode.id = 'tooltip'; document.body.appendChild(tipNode); }
    return tipNode;
  }
  function showTip(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    const t = tip();
    t.textContent = text;
    t.classList.add('open');
    const r = target.getBoundingClientRect();
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
    tipFor = target;
  }
  function hideTip() { tipFor = null; if (tipNode) tipNode.classList.remove('open'); }
  U.hideTip = hideTip;
  document.addEventListener('mouseover', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipFor) return;
    if (t) showTip(t); else hideTip();
  });
  document.addEventListener('focusin', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerdown', hideTip, true);
})();
