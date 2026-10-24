// js/ui/boardart.js — the play surface, DRAWN rather than photographed
// (PRESENTATION-REFERENCE A2, B2). ONE geometry table in a fixed 2048x1280 board space
// is used twice: to draw every slot as SVG and to place every DOM zone by percentage,
// so a painted outline and the hitbox inside it are the same numbers by construction.
//
// Per side, outer edge to centre line:  deck | discard | inkwell   (outer row)
//                                       lore | characters | items  (inner row)
// The lore tracker runs the full height of the half. The opponent's half is yours
// rotated 180 degrees about the board centre, so each player reads their own side in
// the same order and the two halves cannot drift apart.
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
  // The lore track inside its zone: steps 0..20 over this vertical share of the zone,
  // measured from the OUTER end (the big number sits at the outer end, below the track).
  LAYOUT.loreTrack = { from: 0.215, to: 0.975 };   // fraction of zone height, outer -> inner

  const ZONE_KEYS = { lore: 'lore', play: 'play', items: 'items', deck: 'deck', discard: 'discard', ink: 'ink' };
  const LABELS = { play: 'Characters', items: 'Items', deck: 'Deck', discard: 'Discard', ink: 'Inkwell' };

  const pct = function (v, total) { return (v / total * 100) + '%'; };
  const svgEl = U.svgEl;

  function frame(rect, cls, radius) {
    const g = svgEl('g', { class: 'bz ' + cls });
    const r = radius == null ? 18 : radius;
    g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: r, ry: r, class: 'bz-fill' }));
    g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: r, ry: r, class: 'bz-line' }));
    // Four open corner flourishes: read as a frame's hardware, not as a double border.
    const b = Math.min(34, rect.w / 5, rect.h / 5), i = 10;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (s) {
      const cx = s[0] > 0 ? rect.x + i : rect.x + rect.w - i;
      const cy = s[1] > 0 ? rect.y + i : rect.y + rect.h - i;
      g.appendChild(svgEl('path', { class: 'bz-bracket',
        d: 'M' + (cx + s[0] * b) + ',' + cy + ' L' + cx + ',' + cy + ' L' + cx + ',' + (cy + s[1] * b) }));
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
    t.textContent = String(text).toUpperCase();
    return t;
  }

  function defs() {
    const d = svgEl('defs', {});
    // A storybook night: a repeating tile of small four-point sparkles. A pattern costs
    // a few nodes whatever size the board renders at.
    const p = svgEl('pattern', { id: 'bz-sparkles', width: 220, height: 220, patternUnits: 'userSpaceOnUse' });
    [[30, 40, 5], [150, 22, 3.5], [96, 120, 6], [190, 160, 4], [40, 190, 3]].forEach(function (s) {
      const x = s[0], y = s[1], r = s[2];
      p.appendChild(svgEl('path', { class: 'bz-spark',
        d: 'M' + x + ',' + (y - r * 2) + ' Q' + x + ',' + y + ' ' + (x + r * 2) + ',' + y + ' Q' + x + ',' + y + ' ' + x + ',' + (y + r * 2) +
          ' Q' + x + ',' + y + ' ' + (x - r * 2) + ',' + y + ' Q' + x + ',' + y + ' ' + x + ',' + (y - r * 2) + ' Z' }));
    });
    d.appendChild(p);
    [['bz-glow', 14], ['bz-glow-soft', 6]].forEach(function (g) {
      const f = svgEl('filter', { id: g[0], x: '-40%', y: '-40%', width: '180%', height: '180%' });
      f.appendChild(svgEl('feGaussianBlur', { stdDeviation: g[1], result: 'b' }));
      const m = svgEl('feMerge', {});
      m.appendChild(svgEl('feMergeNode', { in: 'b' }));
      m.appendChild(svgEl('feMergeNode', { in: 'b' }));
      m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
      f.appendChild(m);
      d.appendChild(f);
    });
    const wood = svgEl('linearGradient', { id: 'bz-wood', x1: '0', y1: '0', x2: '0', y2: '1' });
    [['0%', '#3e2a1c'], ['18%', '#5e4129'], ['50%', '#33241a'], ['82%', '#5e4129'], ['100%', '#3a281b']]
      .forEach(function (s) { wood.appendChild(svgEl('stop', { offset: s[0], 'stop-color': s[1] })); });
    d.appendChild(wood);
    const seam = svgEl('linearGradient', { id: 'bz-seam', x1: '0', y1: '0', x2: '1', y2: '0' });
    [['0%', 'seam-a'], ['46%', 'seam-mid'], ['54%', 'seam-mid'], ['100%', 'seam-b']]
      .forEach(function (s) { seam.appendChild(svgEl('stop', { offset: s[0], class: s[1] })); });
    d.appendChild(seam);
    // The warm end of the lore track (steps 16-19 heat toward gold).
    const lg = svgEl('linearGradient', { id: 'bz-lore-heat', x1: '0', y1: '1', x2: '0', y2: '0' });
    [['0%', '#2a3a5c'], ['70%', '#3a4a6c'], ['80%', '#a8782a'], ['100%', '#ffd166']]
      .forEach(function (s) { lg.appendChild(svgEl('stop', { offset: s[0], 'stop-color': s[1] })); });
    d.appendChild(lg);
    return d;
  }

  // The lore track: 21 steps, numbers every five, 16-19 warming to gold, 20 a star.
  // Drawn for YOUR side with 0 at the outer (bottom) end; the opponent's copy is the
  // same group rotated 180 degrees, so both players race toward the centre line.
  function loreTrack(rect, side) {
    const g = svgEl('g', { class: 'bz-lore bz-lore-' + side });
    g.appendChild(frame(rect, 'bz-slot bz-lore-frame', 18));
    const T = LAYOUT.loreTrack;
    const cx = rect.x + rect.w / 2;
    const y0 = rect.y + rect.h * (1 - T.from), y20 = rect.y + rect.h * (1 - T.to);
    const step = (y0 - y20) / 20;
    g.appendChild(svgEl('rect', { x: cx - 7, y: y20, width: 14, height: y0 - y20, rx: 7, class: 'bz-lore-rail' }));
    for (let i = 0; i <= 20; i++) {
      const y = y0 - i * step;
      const warm = i >= 16;
      if (i === 20) {
        g.appendChild(svgEl('path', { class: 'bz-lore-goal', d: 'M' + cx + ',' + (y - 16) + ' L' + (cx + 15) + ',' + y +
          ' L' + cx + ',' + (y + 16) + ' L' + (cx - 15) + ',' + y + ' Z' }));
      } else {
        g.appendChild(svgEl('circle', { cx: cx, cy: y, r: i % 5 === 0 ? 6 : 4,
          class: 'bz-lore-step' + (warm ? ' is-warm is-warm-' + i : '') }));
      }
      if (i % 5 === 0 && i < 20) {
        const t = svgEl('text', { x: cx + 30, y: y + 8, class: 'bz-lore-num', 'text-anchor': 'middle' });
        t.textContent = String(i);
        if (side === 'theirs') t.setAttribute('transform', 'rotate(180 ' + (cx + 30) + ' ' + y + ')');
        g.appendChild(t);
      }
    }
    return g;
  }

  function build() {
    const svg = svgEl('svg', { id: 'board-svg', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(defs());
    const B = 26;
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 30, class: 'bz-table' }));
    svg.appendChild(svgEl('rect', { x: B, y: B, width: W - B * 2, height: H - B * 2, rx: 20, class: 'bz-rail', filter: 'url(#bz-glow)' }));
    const P = B + 6;
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 14, class: 'bz-panel' }));
    // The whole-table painted scene, very low: a place, not a picture competing with cards.
    svg.appendChild(artLayer({ x: P, y: P, w: W - P * 2, h: H - P * 2 }, 'board-art', 14));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 14, class: 'bz-sparkle-fill' }));

    // The seam between the two halves: warm on one side, cool on the other, a flare
    // where they meet, so the centre line reads as the table's middle, not as anyone's.
    svg.appendChild(svgEl('rect', { x: 260, y: H / 2 - 3, width: W - 520, height: 6, class: 'bz-seam', filter: 'url(#bz-glow)' }));

    [['mine', MINE], ['theirs', THEIRS]].forEach(function (pair) {
      const side = pair[0], R = pair[1];
      const g = svgEl('g', { class: 'bz-row bz-row-' + side });
      g.appendChild(artLayer(R.play, 'play-art-' + side, 18));
      g.appendChild(frame(R.play, 'bz-slot bz-play', 18));
      g.appendChild(frame(R.items, 'bz-slot bz-items', 18));
      g.appendChild(frame(R.deck, 'bz-slot', 14));
      g.appendChild(frame(R.discard, 'bz-slot', 14));
      g.appendChild(frame(R.ink, 'bz-slot bz-ink', 14));
      // Watermarks in the lanes (visible when a lane is empty). All board text stays
      // upright for the viewer: the opponent's labels are for reading their side, and
      // upside-down words are just noise to the person at this screen.
      [['play', 54], ['items', 40], ['ink', 44]].forEach(function (z) {
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
