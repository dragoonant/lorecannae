// js/ui/boardart.js — the play surface, DRAWN rather than photographed
// (PRESENTATION-REFERENCE A2, B2), dressed as an enchanted storybook tabletop: a night
// sky inside a gilded double rule, zones framed with gold filigree corners, ink swirls
// between groups, the inkwell as a pool of ink, the lore track as a winding trail of
// twenty stars. ONE geometry table in a fixed 2048x1280 board space is used twice: to
// draw every slot and to place every DOM zone by percentage, so a painted outline and
// the hitbox inside it are the same numbers by construction.
//
// Per side, outer edge to centre line:  deck | discard | inkwell   (outer row)
//                                       lore | characters | items  (inner row)
// The opponent's half is yours rotated 180 degrees about the board centre, so each
// player reads their own side in the same order and the halves cannot drift apart.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const W = 2048, H = 1280;

  // YOUR half. Wider gaps between groups (lore | play+items, piles | inkwell) than
  // within them is what makes the row read as groups rather than equal boxes.
  const MINE = {
    lore:    { x: 40,   y: 660, w: 116,  h: 580 },
    play:    { x: 182,  y: 660, w: 1400, h: 300 },
    items:   { x: 1606, y: 660, w: 402,  h: 300 },
    deck:    { x: 182,  y: 986, w: 196,  h: 254 },
    discard: { x: 400,  y: 986, w: 196,  h: 254 },
    ink:     { x: 676,  y: 986, w: 1332, h: 254 },
  };
  function mirror(r) { return { x: W - r.x - r.w, y: H - r.y - r.h, w: r.w, h: r.h }; }
  const THEIRS = {};
  Object.keys(MINE).forEach(function (k) { THEIRS[k] = mirror(MINE[k]); });

  const LAYOUT = LC.boardLayout = { w: W, h: H, mine: MINE, theirs: THEIRS };
  // The lore trail inside its zone: steps 0..20 over this share of the zone height,
  // measured from the OUTER end (the big number sits at the outer end, below the trail).
  LAYOUT.loreTrack = { from: 0.215, to: 0.965 };
  // Star i (0..20) of the winding trail, as fractions of the lore zone: x across, y from
  // the TOP. The opponent's trail is the same points rotated 180 degrees (both players
  // race toward the centre line). Shared by the SVG trail and the DOM stars, so a lit
  // star sits exactly on its drawn path.
  LAYOUT.loreStar = function (i, theirs) {
    const T = LAYOUT.loreTrack;
    const f = T.from + (T.to - T.from) * i / 20;
    const x = 0.5 + 0.2 * Math.sin(i * 0.95);
    return theirs ? { x: 1 - x, y: f } : { x: x, y: 1 - f };
  };

  const ZONE_KEYS = { lore: 'lore', play: 'play', items: 'items', deck: 'deck', discard: 'discard', ink: 'ink' };
  const LABELS = { play: 'Characters', items: 'Items', deck: 'Deck', discard: 'Discard', ink: 'Inkwell' };

  const pct = function (v, total) { return (v / total * 100) + '%'; };
  const svgEl = U.svgEl;

  // A filigree corner: a scrolled stroke along each edge meeting in a curl, drawn in local
  // coordinates for the top-left corner and mirrored into the other three. Ornament, not
  // hardware: no brackets, no glowing rails.
  function filigree(len) {
    const L = len;
    return 'M ' + L + ' 3 C ' + (L * 0.55) + ' 1, 26 2, 16 8 C 9 12, 7 18, 8 26 C 7 ' + (L * 0.45) + ', 3 ' + (L * 0.7) + ', 3 ' + L +
      ' M 16 8 C 22 10, 24 17, 18 19 C 13 20, 12 14, 16 13';
  }
  function frame(rect, cls, radius) {
    const g = U.svgEl('g', { class: 'bz ' + cls });
    const r = radius == null ? 18 : radius;
    g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: r, ry: r, class: 'bz-fill' }));
    g.appendChild(svgEl('rect', { x: rect.x + 1, y: rect.y + 1, width: rect.w - 2, height: rect.h - 2, rx: r, ry: r, class: 'bz-line' }));
    g.appendChild(svgEl('rect', { x: rect.x + 9, y: rect.y + 9, width: rect.w - 18, height: rect.h - 18,
      rx: Math.max(4, r - 8), ry: Math.max(4, r - 8), class: 'bz-inner' }));
    const len = Math.min(70, rect.w / 3.2, rect.h / 3.2);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (sg) {
      const cx = sg[0] > 0 ? rect.x : rect.x + rect.w;
      const cy = sg[1] > 0 ? rect.y : rect.y + rect.h;
      g.appendChild(svgEl('path', { class: 'bz-filigree', d: filigree(len),
        transform: 'translate(' + cx + ' ' + cy + ') scale(' + sg[0] + ' ' + sg[1] + ')' }));
    });
    return g;
  }

  function artLayer(rect, id, radius) {
    const g = svgEl('g', { class: 'bz-artlayer' });
    const clipId = 'bz-clip-' + id;
    const cp = svgEl('clipPath', { id: clipId });
    cp.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: radius, ry: radius }));
    g.appendChild(cp);
    g.appendChild(svgEl('image', { id: id, x: rect.x, y: rect.y, width: rect.w, height: rect.h,
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#' + clipId + ')', class: 'bz-zone-art' }));
    return g;
  }

  function label(text, x, y, cls) {
    const t = svgEl('text', { x: x, y: y, class: 'bz-label ' + (cls || ''), 'text-anchor': 'middle' });
    t.textContent = String(text);
    return t;
  }

  function star4(x, y, r) {
    return 'M' + x + ',' + (y - r) + ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y + ' Q' + x + ',' + y + ' ' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x - r) + ',' + y + ' Q' + x + ',' + y + ' ' + x + ',' + (y - r) + ' Z';
  }
  LC.U.star4 = star4;
  function grad(d, id, kind, attrs, stops) {
    const gr = svgEl(kind, Object.assign({ id: id }, attrs));
    stops.forEach(function (st) {
      const o = svgEl('stop', { offset: st[0], 'stop-color': st[1] });
      if (st[2] != null) o.setAttribute('stop-opacity', st[2]);
      gr.appendChild(o);
    });
    d.appendChild(gr);
  }

  function defs() {
    const d = svgEl('defs', {});
    // A night sky: a tile of tiny stars of three sizes plus a few four-point twinkles.
    // A pattern costs a few nodes whatever size the board renders at.
    const p = svgEl('pattern', { id: 'bz-stars', width: 260, height: 260, patternUnits: 'userSpaceOnUse' });
    const rnd = U.rand('board-stars');
    for (let i = 0; i < 26; i++) {
      p.appendChild(svgEl('circle', { cx: (rnd() * 260).toFixed(1), cy: (rnd() * 260).toFixed(1),
        r: (0.6 + rnd() * 1.6).toFixed(2), class: 'bz-star', opacity: (0.25 + rnd() * 0.6).toFixed(2) }));
    }
    [[40, 60, 7], [190, 30, 5], [130, 170, 9], [220, 210, 5]].forEach(function (t) {
      p.appendChild(svgEl('path', { class: 'bz-twinkle', d: star4(t[0], t[1], t[2]) }));
    });
    d.appendChild(p);
    [['bz-glow', 12], ['bz-glow-soft', 5]].forEach(function (g) {
      const f = svgEl('filter', { id: g[0], x: '-40%', y: '-40%', width: '180%', height: '180%' });
      f.appendChild(svgEl('feGaussianBlur', { stdDeviation: g[1], result: 'b' }));
      const m = svgEl('feMerge', {});
      m.appendChild(svgEl('feMergeNode', { in: 'b' }));
      m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
      f.appendChild(m);
      d.appendChild(f);
    });
    grad(d, 'bz-sky', 'radialGradient', { cx: '50%', cy: '45%', r: '75%' },
      [['0%', '#2b1f57'], ['55%', '#1a1340'], ['100%', '#0d0a22']]);
    grad(d, 'bz-cover', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#33194a'], ['50%', '#1c0f30'], ['100%', '#33194a']]);
    grad(d, 'bz-gold', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#fff0c0'], ['35%', '#e7c06a'], ['70%', '#b88a33'], ['100%', '#f4d58a']]);
    grad(d, 'bz-zone', 'radialGradient', { cx: '50%', cy: '50%', r: '70%' },
      [['0%', '#2c2160', 0.38], ['100%', '#0f0b26', 0.6]]);
    grad(d, 'bz-nebula-a', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#8a55c8', 0.3], ['100%', '#8a55c8', 0]]);
    grad(d, 'bz-nebula-b', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#3a7fb0', 0.2], ['100%', '#3a7fb0', 0]]);
    grad(d, 'bz-inkpool', 'radialGradient', { cx: '50%', cy: '55%', r: '60%' },
      [['0%', '#4a2f9a', 0.5], ['60%', '#22185a', 0.32], ['100%', '#100b2a', 0]]);
    grad(d, 'bz-seam', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '0' },
      [['0%', '#e7c06a', 0], ['20%', '#e7c06a', 0.8], ['50%', '#fff4cc', 1], ['80%', '#c3bdf0', 0.8], ['100%', '#c3bdf0', 0]]);
    return d;
  }

  // An ink swirl: the spiral flourish used as the divider between groups of zones.
  function swirl(x, y, h, cls) {
    const g = svgEl('g', { class: 'bz-swirl ' + (cls || '') });
    const top = y + 10, bot = y + h - 10, mid = y + h / 2;
    g.appendChild(svgEl('path', { d: 'M' + x + ',' + top + ' C' + (x + 18) + ',' + (top + h * 0.2) + ' ' + (x - 18) + ',' + (mid - h * 0.15) + ' ' + x + ',' + (mid - 14) +
      ' M' + x + ',' + bot + ' C' + (x - 18) + ',' + (bot - h * 0.2) + ' ' + (x + 18) + ',' + (mid + h * 0.15) + ' ' + x + ',' + (mid + 14) }));
    g.appendChild(svgEl('path', { d: 'M' + x + ',' + (mid - 14) + ' c 12,2 14,16 2,18 c -9,1 -11,-9 -4,-11 c 4,-1 6,3 3,5' }));
    g.appendChild(svgEl('path', { class: 'bz-swirl-star', d: star4(x, mid + 18, 7) }));
    return g;
  }

  // The inkwell as a pool of ink: a soft dark-jewel well with a few slow swirls in it.
  function inkPool(rect) {
    const g = svgEl('g', { class: 'bz-inkpool' });
    g.appendChild(svgEl('ellipse', { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, rx: rect.w * 0.5, ry: rect.h * 0.48, fill: 'url(#bz-inkpool)' }));
    [[0.2, 0.52, 44], [0.52, 0.42, 58], [0.82, 0.58, 40]].forEach(function (c) {
      const cx = rect.x + rect.w * c[0], cy = rect.y + rect.h * c[1], r = c[2];
      const sw = svgEl('g', { class: 'bz-inkswirl' });
      sw.appendChild(svgEl('path', { d: 'M' + (cx - r) + ',' + cy + ' a' + r + ',' + (r * 0.55) + ' 0 1,1 ' + (r * 1.6) + ',' + (r * 0.2) +
        ' a' + (r * 0.6) + ',' + (r * 0.34) + ' 0 1,1 ' + (-r * 0.9) + ',' + (-r * 0.15) }));
      g.appendChild(sw);
    });
    return g;
  }

  // The lore trail for YOUR side (the opponent's copy is rotated 180 degrees): a dotted
  // winding path through the 21 star positions and numbers every five. The stars are DOM
  // (js/ui/game.js) so they can light up.
  function loreTrack(rect, side) {
    const g = svgEl('g', { class: 'bz-lore bz-lore-' + side });
    g.appendChild(frame(rect, 'bz-slot bz-lore-frame', 18));
    const pt = function (i) { const q = LAYOUT.loreStar(i, false); return { x: rect.x + rect.w * q.x, y: rect.y + rect.h * q.y }; };
    let d = '';
    for (let i = 0; i <= 20; i++) {
      const a = pt(i);
      if (i === 0) { d = 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1); continue; }
      const b = pt(i - 1);
      d += ' Q' + ((a.x + b.x) / 2 + (i % 2 ? 9 : -9)).toFixed(1) + ',' + ((a.y + b.y) / 2).toFixed(1) + ' ' + a.x.toFixed(1) + ',' + a.y.toFixed(1);
    }
    g.appendChild(svgEl('path', { d: d, class: 'bz-lore-trail' }));
    [5, 10, 15].forEach(function (i) {
      const a = pt(i);
      const x = a.x < rect.x + rect.w / 2 ? a.x + 32 : a.x - 32;
      const t = svgEl('text', { x: x, y: a.y + 7, class: 'bz-lore-num', 'text-anchor': 'middle' });
      t.textContent = String(i);
      if (side === 'theirs') t.setAttribute('transform', 'rotate(180 ' + x + ' ' + a.y + ')');
      g.appendChild(t);
    });
    return g;
  }

  function build() {
    const svg = svgEl('svg', { id: 'board-svg', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(defs());
    // The book cover: deep plum, a gilded rule set into it, then the night sky.
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 34, class: 'bz-table' }));
    svg.appendChild(svgEl('rect', { x: 11, y: 11, width: W - 22, height: H - 22, rx: 26, class: 'bz-rule' }));
    const P = 26;
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 18, class: 'bz-panel' }));
    // The painted scene, very low: a place, not a picture competing with cards.
    svg.appendChild(artLayer({ x: P, y: P, w: W - P * 2, h: H - P * 2 }, 'board-art', 18));
    svg.appendChild(svgEl('ellipse', { cx: 520, cy: 360, rx: 620, ry: 360, fill: 'url(#bz-nebula-a)' }));
    svg.appendChild(svgEl('ellipse', { cx: 1560, cy: 920, rx: 640, ry: 380, fill: 'url(#bz-nebula-b)' }));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 18, class: 'bz-stars-fill' }));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 18, class: 'bz-rule-inner' }));
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (sg) {
      svg.appendChild(svgEl('path', { class: 'bz-filigree bz-cover-filigree', d: filigree(130),
        transform: 'translate(' + (sg[0] > 0 ? P - 6 : W - P + 6) + ' ' + (sg[1] > 0 ? P - 6 : H - P + 6) + ') scale(' + sg[0] + ' ' + sg[1] + ')' }));
    });

    // The centre line: a gilded flourish with a star where the halves meet, warm gold at
    // your end and silver-violet at theirs, so it reads as the middle of the table.
    const seam = svgEl('g', { class: 'bz-seam-g' });
    seam.appendChild(svgEl('rect', { x: 240, y: H / 2 - 2, width: W - 480, height: 4, rx: 2, fill: 'url(#bz-seam)' }));
    seam.appendChild(svgEl('path', { class: 'bz-seam-curl', d: 'M' + (W / 2 - 46) + ',' + (H / 2) + ' c -30,-16 -60,-16 -84,0 c 24,16 54,16 84,0 Z M' +
      (W / 2 + 46) + ',' + (H / 2) + ' c 30,-16 60,-16 84,0 c -24,16 -54,16 -84,0 Z' }));
    seam.appendChild(svgEl('path', { class: 'bz-seam-star', d: star4(W / 2, H / 2, 26), filter: 'url(#bz-glow-soft)' }));
    svg.appendChild(seam);

    [['mine', MINE], ['theirs', THEIRS]].forEach(function (pair) {
      const side = pair[0], R = pair[1];
      const g = svgEl('g', { class: 'bz-row bz-row-' + side });
      g.appendChild(artLayer(R.play, 'play-art-' + side, 18));
      g.appendChild(frame(R.play, 'bz-slot bz-play', 18));
      g.appendChild(frame(R.items, 'bz-slot bz-items', 18));
      g.appendChild(frame(R.deck, 'bz-slot', 14));
      g.appendChild(frame(R.discard, 'bz-slot', 14));
      g.appendChild(inkPool(R.ink));
      g.appendChild(frame(R.ink, 'bz-slot bz-ink', 14));
      // Ink-swirl dividers between groups: piles | inkwell, characters | items.
      const gap1 = R.discard.x < R.ink.x ? (R.discard.x + R.discard.w + R.ink.x) / 2 : (R.ink.x + R.ink.w + R.discard.x) / 2;
      g.appendChild(swirl(gap1, R.ink.y, R.ink.h));
      const gap2 = R.play.x < R.items.x ? (R.play.x + R.play.w + R.items.x) / 2 : (R.items.x + R.items.w + R.play.x) / 2;
      g.appendChild(swirl(gap2, R.play.y + 30, R.play.h - 60, 'is-small'));
      // Watermarks in the lanes (visible when a lane is empty), upright for the viewer.
      [['play', 58], ['items', 42], ['ink', 48]].forEach(function (z) {
        const r = R[z[0]];
        const t = label(LABELS[z[0]], r.x + r.w / 2, r.y + r.h / 2 + z[1] * 0.35, 'bz-watermark');
        t.style.fontSize = z[1] + 'px';
        g.appendChild(t);
      });
      // Pile captions ride in the gap between the two rows (a card covers the slot).
      ['deck', 'discard'].forEach(function (k) {
        const r = R[k];
        const y = side === 'mine' ? r.y - 5 : r.y + r.h + 21;
        g.appendChild(label(LABELS[k], r.x + r.w / 2, y, 'bz-caption'));
      });
      const lore = loreTrack(MINE.lore, side);
      if (side === 'theirs') lore.setAttribute('transform', 'rotate(180 ' + W / 2 + ' ' + H / 2 + ')');
      g.appendChild(lore);
      svg.appendChild(g);
    });
    return svg;
  }

  // ---- scenery: rolled per game, never the same as last game -----------------
  let lastScene = null;
  function sceneUrls() {
    // Every ui art entry named board-* (board-forest, board-courtyard, ...).
    return Object.keys(LC.ART.ui).filter(function (k) { return k.indexOf('board-') === 0; }).sort()
      .map(function (k) { return LC.ART.ui[k]; });
  }

  LC.boardArt = {
    init: function (mat) {
      if (mat.querySelector('#board-svg')) return;
      mat.insertBefore(build(), mat.firstChild);
      ['mine', 'theirs'].forEach(function (side) {
        const prefix = side === 'mine' ? 'my-' : 'enemy-';
        Object.keys(ZONE_KEYS).forEach(function (k) {
          const node = U.$(prefix + k);
          if (!node) throw new Error('index.html is missing zone #' + prefix + k);
          const r = LAYOUT[side][k];
          node.style.left = pct(r.x, W); node.style.top = pct(r.y, H);
          node.style.width = pct(r.w, W); node.style.height = pct(r.h, H);
        });
      });
      this.rollScenes();
    },
    rollScenes: function () {
      const urls = sceneUrls();
      const set = function (id, href) {
        const n = document.getElementById(id);
        if (!n) return;
        if (href) n.setAttribute('href', href); else n.removeAttribute('href');
      };
      if (!urls.length) { set('board-art', null); set('play-art-mine', null); set('play-art-theirs', null); return; }
      let i = Math.floor(Math.random() * urls.length);
      if (urls.length > 1 && urls[i] === lastScene) i = (i + 1) % urls.length;
      lastScene = urls[i];
      set('board-art', urls[i]);
      // Each lane gets its own shot, different from its opposite number when possible.
      const a = (i + 1) % urls.length, b = (i + 2) % urls.length;
      set('play-art-mine', urls[a]);
      set('play-art-theirs', urls[urls.length > 2 ? b : a]);
    },
  };
})();
