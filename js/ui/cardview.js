// js/ui/cardview.js — THE card renderer (PRESENTATION-REFERENCE A3, B2): one function,
// three sizes (board / hand / preview). Art is the card: the illustration fills the face
// and the text floats on a measured scrim with a four-stop shadow. The only content
// difference between sizes is the rules-text block, rendered at preview size only.
// Every live number comes from the engine (LC.chars / LC.costToPlay), never the client.
(function () {
  'use strict';
  const LC = globalThis.LC;
  const U = LC.U;
  const el = U.el;

  // ---- art cache: one decoded prototype per file, cloned per render ----------
  // A fresh <img> paints a frame late and the whole board flickers on every redraw;
  // a clone of an already-decoded image paints in the same frame (A3 "Art loading").
  const artProtos = {};   // cardId -> HTMLImageElement | 'failed'
  const svgProtos = {};   // cardId -> SVG prototype

  // The ONLY place a card-art path is resolved. A card with no manifest entry is a
  // normal state while art is being generated (fallback art); a missing MANIFEST is a
  // broken build, and main.js throws for that before anything renders.
  LC.artUrl = function (cardId) { return LC.ART.cards[cardId] || null; };
  LC.uiArtUrl = function (name) { return LC.ART.ui[name] || null; };

  function paintedProto(cardId, url) {
    if (artProtos[cardId]) return artProtos[cardId];
    const proto = new Image();
    proto.className = 'art art-painted';
    proto.alt = '';
    proto.draggable = false;               // load-bearing: native image drag cancels pointer drags
    proto.setAttribute('aria-hidden', 'true');
    proto.decoding = 'sync';               // NOT lazy/async: those defer paint past the clone frame
    proto.src = url;
    artProtos[cardId] = proto;
    return proto;
  }

  let backProto = null, backFailed = false;
  function cardBackUrl() { return LC.uiArtUrl('cardback') || 'art/ui/cardback.svg'; }
  function cardBackProto() {
    if (!backProto) {
      backProto = new Image();
      backProto.className = 'art card-back-art';
      backProto.alt = '';
      backProto.draggable = false;
      backProto.setAttribute('aria-hidden', 'true');
      backProto.decoding = 'sync';
      backProto.src = cardBackUrl();
      backProto.onerror = function () { backFailed = true; };
    }
    return backProto;
  }

  // Deterministic storybook fallback seeded by the card id: a dusk sky tinted by the
  // card's ink, soft glowing orbs, rolling hills and a gold diamond. Consistent across
  // runs, distinct between neighbours, never a blank rectangle.
  function svgFallback(cardId) {
    if (svgProtos[cardId]) return svgProtos[cardId].cloneNode(true);
    const rand = U.rand('art|' + cardId);
    const def = LC.CARDS[cardId];
    const inkHue = { Amber: 40, Amethyst: 275, Emerald: 145, Ruby: 355, Sapphire: 210, Steel: 205 };
    const inks = def ? U.inksOf(def) : [];
    const base = inks.length ? inkHue[inks[0]] : Math.floor(rand() * 360);
    const hue = (base + Math.floor(rand() * 40) - 20 + 360) % 360;
    const svg = U.svgEl('svg', { viewBox: '0 0 50 70', class: 'art art-fallback', 'aria-hidden': 'true',
      preserveAspectRatio: 'xMidYMid slice' });
    const gid = 'fg' + Math.floor(rand() * 1e9);
    let inner = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + hue + ',42%,22%)"/>' +
      '<stop offset=".6" stop-color="hsl(' + ((hue + 30) % 360) + ',38%,34%)"/>' +
      '<stop offset="1" stop-color="hsl(' + ((hue + 50) % 360) + ',30%,14%)"/></linearGradient></defs>' +
      '<rect width="50" height="70" fill="url(#' + gid + ')"/>';
    for (let i = 0; i < 6; i++) {
      const cx = 4 + rand() * 42, cy = 4 + rand() * 34, r = 2 + rand() * 9;
      inner += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) +
        '" fill="hsl(' + ((hue + 20 + i * 22) % 360) + ',60%,' + (52 + i * 5) + '%)" opacity="' + (0.18 + rand() * 0.25).toFixed(2) + '"/>';
    }
    const h1 = 40 + rand() * 8, h2 = 46 + rand() * 8;
    inner += '<path d="M0 ' + h1.toFixed(1) + ' Q 14 ' + (h1 - 7).toFixed(1) + ' 28 ' + h1.toFixed(1) +
      ' T 50 ' + (h1 - 2).toFixed(1) + ' V70 H0 Z" fill="hsl(' + ((hue + 160) % 360) + ',22%,20%)" opacity=".8"/>';
    inner += '<path d="M0 ' + h2.toFixed(1) + ' Q 20 ' + (h2 - 5).toFixed(1) + ' 34 ' + h2.toFixed(1) +
      ' T 50 ' + (h2 + 1).toFixed(1) + ' V70 H0 Z" fill="hsl(' + ((hue + 180) % 360) + ',18%,12%)"/>';
    inner += '<polygon points="25,13 33,26 25,39 17,26" fill="hsl(44,90%,64%)" opacity=".85"/>' +
      '<polygon points="25,18 29.5,26 25,34 20.5,26" fill="hsl(44,95%,82%)" opacity=".7"/>';
    svg.innerHTML = inner;
    svgProtos[cardId] = svg;
    return svg.cloneNode(true);
  }

  // ---- rules text -------------------------------------------------------------
  const KEYWORDS = ['Alert', 'Bodyguard', 'Boost', 'Challenger', 'Evasive', 'Reckless', 'Resist',
    'Rush', 'Shift', 'Singer', 'Sing Together', 'Support', 'Vanish', 'Ward'];
  // Keyword reminders in our own words (never the printed reminder text). N is filled in.
  const KW_HELP = {
    'Alert': 'This character can challenge as if it had Evasive.',
    'Bodyguard': 'It may enter play exerted. An opposing character who challenges one of your characters must choose one with Bodyguard if able.',
    'Boost': 'Once during your turn, you may pay N ink to put the top card of your deck facedown under this character.',
    'Challenger': 'While this character is challenging, it gets +N strength.',
    'Evasive': 'Only characters with Evasive can challenge this character.',
    'Reckless': 'This character can’t quest, and you can’t end your turn while it is ready and able to challenge.',
    'Resist': 'Damage dealt to this character is reduced by N.',
    'Rush': 'This character can challenge the turn it is played (it does not have to dry first).',
    'Shift': 'You may pay N ink to play this on top of one of your characters with the same name. It keeps that character’s dry/exerted state and damage.',
    'Singer': 'This character counts as cost N when it exerts to sing a song.',
    'Sing Together': 'Any number of your characters with total cost N or more may exert together to sing this song for free.',
    'Support': 'Whenever this character quests, you may add its strength to another chosen character’s strength this turn.',
    'Vanish': 'When an opponent chooses this character for an action, banish it.',
    'Ward': 'Opponents can’t choose this character except to challenge it.',
    'Song': 'A song is an action. Instead of paying its ink cost, you may exert one of your ready characters with cost equal to or greater than the song’s cost to sing it for free.',
  };
  LC.U.KW_HELP = KW_HELP;
  // engine kw keys -> printed keyword names
  const KW_KEY = { SingTogether: 'Sing Together' };
  const KW_NUM = { Boost: 1, Challenger: 1, Resist: 1, Shift: 1, Singer: 1, 'Sing Together': 1 };

  function kwLabel(name, n) {
    if (n == null || n === true) return name;
    if (name === 'Challenger' || name === 'Resist') return name + ' +' + n;
    return name + ' ' + n;
  }

  // Appends text with {S}/{W}/{L}/{I}/{E} rendered as inline icons.
  function appendIcons(node, text) {
    const re = /\{([SWLIE])\}/g;
    let at = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > at) node.appendChild(document.createTextNode(text.slice(at, m.index)));
      node.appendChild(U.icon(m[1]));
      at = m.index + m[0].length;
    }
    if (at < text.length) node.appendChild(document.createTextNode(text.slice(at)));
  }
  U.appendIcons = appendIcons;

  // Coloured ink words inside rules text, matching the corner dots.
  function appendRich(node, text) {
    const re = /\b(Amber|Amethyst|Emerald|Ruby|Sapphire|Steel)\b/g;
    let at = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > at) appendIcons(node, text.slice(at, m.index));
      const w = el('span', 'ink-word', m[0]);
      w.style.color = U.INK[m[0]].text;
      node.appendChild(w);
      at = m.index + m[0].length;
    }
    if (at < text.length) appendIcons(node, text.slice(at));
  }

  // One printed paragraph: an ALL-CAPS ability name becomes a gold chip, a leading
  // keyword becomes a blue chip, and a parenthesised reminder is set muted.
  function abilityRow(line) {
    const row = el('div', 'ability');
    let rest = line;
    const kw = KEYWORDS.find(function (k) { return rest.indexOf(k) === 0 && !/[a-z]/.test(rest.charAt(k.length)); });
    if (kw) {
      const m = rest.match(/^([A-Za-z ]+?)(\s[+]?\d+)?(\s\{I\})?(?=\s|\(|$)/);
      const head = m ? m[0] : kw;
      const chip = el('span', 'kw-name');
      appendIcons(chip, head);
      row.appendChild(chip);
      rest = rest.slice(head.length);
    } else {
      // Ability names are runs of capitalised words ("THE BOOK KNOWS EVERYTHING").
      const m = rest.match(/^((?:[A-Z0-9][A-Z0-9'’!?.,&\-]*\s)+?)(?=[A-Z][a-z]|\{|\d|[“"(]|Once|When|During)/);
      if (m && m[1].replace(/[^A-Z]/g, '').length >= 3) {
        row.appendChild(el('span', 'trigger', m[1].trim()));
        rest = rest.slice(m[1].length);
      }
    }
    const pm = rest.match(/^(\s*)\(([^)]*)\)(.*)$/);
    if (pm) {
      row.appendChild(document.createTextNode(' '));
      const rem = el('span', 'reminder');
      appendRich(rem, '(' + pm[2] + ')');
      row.appendChild(rem);
      rest = pm[3];
    }
    if (rest) appendRich(row, rest);
    return row;
  }

  // ---- live data --------------------------------------------------------------
  function instanceOf(ref, state) {
    if (state && state.cards && state.cards[ref]) return state.cards[ref];
    return null;
  }

  // Keywords this card ACTUALLY has right now (A3: "the face never claims a keyword the
  // unit does not have"). In play: the engine's live kw table. Elsewhere: printed.
  function liveKeywords(def, inst, state) {
    if (inst && state && inst.zone === 'play') {
      const kw = LC.chars(state, inst.iid).kw || {};
      return Object.keys(kw).filter(function (k) { return kw[k] !== undefined && kw[k] !== false && (KW_HELP[KW_KEY[k] || k]); }).map(function (k) {
        const name = KW_KEY[k] || k;
        return { k: name, n: kw[k] === true ? null : kw[k] };
      });
    }
    return printedKeywords(def);
  }
  function printedKeywords(def) {
    return (def.keywords || []).map(function (k) {
      const m = def.text.match(new RegExp(k + '\\s\\+?(\\d+)'));
      return { k: k, n: KW_NUM[k] && m ? Number(m[1]) : null };
    });
  }

  // The glossary walks the WHOLE text, so a card that grants "Evasive" to others still
  // explains Evasive; live keywords (granted to this instance) are added on top.
  LC.cardGlossary = function (cardId, inst, state) {
    const def = LC.CARDS[cardId];
    if (!def) return [];
    const found = {};
    function add(k, n) {
      if (!KW_HELP[k]) return;
      if (found[k] && found[k].n != null) return;
      found[k] = { k: k, n: n };
    }
    liveKeywords(def, inst, state).forEach(function (x) { add(x.k, x.n); });
    printedKeywords(def).forEach(function (x) { add(x.k, x.n); });
    KEYWORDS.forEach(function (k) {
      const re = new RegExp('\\b' + k + '\\b(\\s\\+?(\\d+))?');
      const m = def.text.match(re);
      if (m) add(k, m[2] ? Number(m[2]) : null);
    });
    if (U.isSong(def)) add('Song', null);
    return Object.keys(found).map(function (k) {
      const g = found[k];
      let text = KW_HELP[k];
      text = text.split('N ink').join((g.n != null ? g.n : 'N') + ' ink')
        .split('+N').join('+' + (g.n != null ? g.n : 'N'))
        .split('by N').join('by ' + (g.n != null ? g.n : 'N'))
        .split('cost N').join('cost ' + (g.n != null ? g.n : 'N'));
      return { name: kwLabel(k, g.n), text: text };
    });
  };

  function loreDiamonds(n) {
    const wrap = el('span', 'stat lore');
    for (let i = 0; i < n; i++) wrap.appendChild(U.icon('L'));
    if (n === 0) wrap.appendChild(el('span', 'lore-zero', '0'));
    return wrap;
  }

  // ---- the renderer -------------------------------------------------------------
  // ref: an instance id present in opts.state.cards, or a card definition id.
  // opts: {size:'board'|'hand'|'preview', state?, hidden?, owner?}
  LC.renderCard = function (ref, opts) {
    opts = opts || {};
    const size = opts.size || 'board';
    const state = opts.state || null;
    const inst = instanceOf(ref, state);
    const cardId = inst ? inst.id : ref;
    const root = el('div', 'card card-' + size);

    if (opts.hidden) {
      // Face-down: no data-card-id, so the document-level hover preview ignores it.
      root.classList.add('card-back');
      root.appendChild(el('div', 'back-mark'));
      if (!backFailed) {
        const back = cardBackProto().cloneNode(false);
        back.onerror = function () { backFailed = true; back.remove(); };
        root.appendChild(back);
      }
      return root;
    }
    const def = LC.CARDS[cardId];
    if (!def) {                      // defensive render: never throw out of a board redraw
      root.classList.add('card-missing');
      root.appendChild(el('div', 'card-name', '—'));
      return root;
    }
    root.dataset.cardId = cardId;
    if (inst) root.dataset.iid = inst.iid;
    const type = U.mainType(def);
    root.classList.add('type-' + type);

    // Layer 0: art + scrim (::after in CSS).
    const artWrap = el('div', 'card-art');
    const url = LC.artUrl(cardId);
    const failed = !url || artProtos[cardId] === 'failed';
    const img = failed ? null : paintedProto(cardId, url).cloneNode(false);
    if (img) {
      img.onerror = function () {
        artProtos[cardId] = 'failed';
        if (img.parentNode) img.parentNode.replaceChild(svgFallback(cardId), img);
      };
    }
    artWrap.appendChild(img || svgFallback(cardId));
    root.appendChild(artWrap);

    // Layer 3: corners — ink cost hexagon (inkable ring) and ink dots.
    const corners = el('div', 'card-corners');
    let cost = def.cost;
    let costCls = '';
    if (inst && state && inst.zone === 'hand') {
      const live = LC.costToPlay(state, inst.iid);
      if (live < def.cost) costCls = 'is-cheaper';
      else if (live > def.cost) costCls = 'is-dearer';
      cost = live;
    }
    const hex = U.costGem(cost, !!def.inkwell, costCls, U.inksOf(def)[0]);
    hex.setAttribute('data-tip', (def.inkwell ? 'Ink cost ' + cost + ' · inkable (can go into your inkwell)'
      : 'Ink cost ' + cost + ' · not inkable'));
    corners.appendChild(hex);
    const dots = el('span', 'ink-dots');
    U.inksOf(def).forEach(function (ink) {
      const d = el('span', 'ink-dot');
      d.style.background = U.INK[ink].dot;
      d.setAttribute('data-tip', ink);
      dots.appendChild(d);
    });
    corners.appendChild(dots);
    root.appendChild(corners);

    // Layer 2: the text plate (in flow, hugs the bottom, grows upward).
    const plate = el('div', 'card-plate');
    plate.appendChild(el('div', 'card-name', def.name));
    // The version is part of the card's identity ("Elsa - Spirit of Winter" and
    // "Elsa - Snow Queen" are different cards): never dropped, wraps instead.
    if (def.version) plate.appendChild(el('div', 'card-version', def.version));

    const typeLine = el('div', 'card-type');
    const tags = def.type.slice();
    typeLine.appendChild(el('span', 'type-tag' + (U.isSong(def) ? ' is-song' : ''), tags.join(' · ')));
    const cls = (inst && state && inst.zone === 'play') ? (LC.chars(state, inst.iid).classifications || def.classifications)
      : def.classifications;
    if (cls && cls.length) typeLine.appendChild(el('span', 'traits', cls.join(' · ')));
    plate.appendChild(typeLine);

    const kws = liveKeywords(def, inst, state);
    if (kws.length) {
      plate.appendChild(el('div', 'card-kw', kws.map(function (k) { return kwLabel(k.k, k.n); }).join('  ·  ')));
    }

    if (size === 'preview') {
      const detail = el('div', 'card-detail');
      def.text.split('\n').filter(Boolean).forEach(function (line) { detail.appendChild(abilityRow(line)); });
      if (def.text) plate.appendChild(detail);
      if (def.flavor) {
        const fl = el('div', 'card-flavor');
        appendIcons(fl, def.flavor);
        plate.appendChild(fl);
      }
    }

    // Stats: items and actions print none.
    if (type === 'character' || type === 'location') {
      const row = el('div', 'card-stats');
      let str = def.strength, wp = def.willpower, lore = def.lore, dmg = 0;
      let chars = null;
      if (inst && state && inst.zone === 'play') {
        chars = LC.chars(state, inst.iid);
        str = chars.str; wp = chars.wp; lore = chars.lore; dmg = chars.damage || 0;
      }
      if (type === 'character') {
        const s = el('span', 'stat str');
        s.appendChild(U.icon('S')); s.appendChild(el('span', 'n', String(str)));
        if (str !== def.strength) s.classList.add(str > def.strength ? 'is-up' : 'is-down');
        row.appendChild(s);
      }
      const w = el('span', 'stat wp' + (dmg > 0 ? ' damaged' : ''));
      w.appendChild(U.icon('W')); w.appendChild(el('span', 'n', String(wp - dmg)));
      w.setAttribute('data-tip', dmg > 0 ? (wp - dmg) + ' of ' + wp + ' willpower left (' + dmg + ' damage)' : wp + ' willpower');
      row.appendChild(w);
      row.appendChild(el('span', 'stat-gap'));
      const l = loreDiamonds(lore || 0);
      l.setAttribute('data-tip', (lore || 0) + ' lore when it quests');
      row.appendChild(l);
      plate.appendChild(row);
    }
    root.appendChild(plate);

    if (inst && state && inst.zone === 'play') decorate(root, inst, state);
    return root;
  };

  function decorate(root, inst, state) {
    const c = LC.chars(state, inst.iid);
    if (c.exerted) root.classList.add('is-exerted');
    if (c.drying) root.classList.add('is-drying');
    if (c.damage > 0) {
      const m = el('div', 'damage-marker', String(c.damage));
      m.setAttribute('data-tip', c.damage + ' damage');
      root.appendChild(m);
    }
    if (inst.under && inst.under.length) {
      const down = inst.under.filter(function (u) { return state.cards[u] && state.cards[u].facedown; }).length;
      const up = inst.under.length - down;
      const b = el('div', 'under-badge', '▤ ' + inst.under.length);
      b.setAttribute('data-tip', (up ? up + ' shifted-onto card' + (up > 1 ? 's' : '') : '') +
        (up && down ? ', ' : '') + (down ? down + ' facedown card' + (down > 1 ? 's' : '') + ' (Boost)' : '') + ' under this');
      root.appendChild(b);
    }
  }

  // The card face for any instance, honouring who may see it. Face-down ink, hand cards
  // of the other seat and Boost cards render as backs; everything public renders up.
  LC.canSee = function (state, iid, viewer) {
    const c = state.cards[iid];
    if (!c) return false;
    if (state.phase === 'over') return true;           // post-mortem: nothing left to protect
    if (c.zone === 'ink') return c.owner === viewer;    // you know what you inked
    if (c.facedown) return false;
    if (c.zone === 'deck') return false;
    if (c.zone === 'hand') {
      if (c.owner === viewer) return true;
      const rev = state.revealed && state.revealed[c.owner];
      return !!(rev && rev.indexOf(iid) >= 0);
    }
    return true;
  };
})();
