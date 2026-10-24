// Amethyst card abilities (first ink Amethyst). Authoring guide: docs/ABILITIES.md.
(function () {
  const LC = globalThis.LC;
  const H = LC.H;
  const A = LC.ABIL;

  // EXAMPLE — "you may choose one" at the start of your turn (declining is an option).
  A['mrs-incredible-super-stretchy'] = {
    triggers: [{
      name: 'FLEXIBLE THINKING', on: 'turnStart', when: H.mine,
      run(x) {
        const m = x.mode('Flexible Thinking: you may choose one.', ['Gain Evasive until the start of your next turn', 'Get +1 lore this turn', 'Choose neither']);
        if (m === 0) x.buff(x.me, { kw: { Evasive: true } }, x.until.myNextTurn(), 'gains Evasive until the start of your next turn');
        if (m === 1) x.buff(x.me, { lore: 1 }, x.until.eot(), '+1 lore this turn');
      },
    }],
  };

  // EXAMPLE — item activated ability with exert + ink + banish-this costs.
  A['junior-woodchuck-guidebook'] = {
    activated: [{ name: 'THE BOOK KNOWS EVERYTHING', text: 'Draw 2 cards.', cost: { exert: true, ink: 1, banishSelf: true }, run(x) { x.draw(x.ctrl, 2); } }],
  };

  // EXAMPLE — granting an activated ability to other cards (late aura reads finished keywords).
  const BREAKING = { name: 'BREAKING RECORDS', text: 'Draw a card and gain 1 lore.', cost: { exert: true, ink: 1 }, run(x) { x.draw(x.ctrl, 1); x.gainLore(x.ctrl, 1); } };
  A['dumbo-ninth-wonder-of-the-universe'] = {
    activated: [BREAKING],
    lateAuras: [(s, me, t, r) => {
      if (t === me || s.cards[t].owner !== s.cards[me].owner || r.type !== 'character' || !r.kw.Evasive) return;
      r.activated.push({ src: 'dumbo-ninth-wonder-of-the-universe', i: 0, ab: BREAKING });
    }],
  };

  // ---- remaining Amethyst cards below ----

  A['rafiki-mystical-fighter'] = {
    // ANCIENT SKILLS: "Whenever he challenges a Hyena character, this character takes no damage
    // from the challenge." The engine reads noDamageFromClass on the challenger only.
    auras: [(s, me, t, r) => { if (t === me) r.flags.noDamageFromClass = 'Hyena'; }],
  };

  // "you may move up to `max` damage from chosen character to chosen opposing character".
  // Declining the first choice is the "may"; the amount is asked when more than 1 could move.
  function moveDamageBetween(x, label, max) {
    const src = x.chooseOne(x.characters().filter((i) => x.s.cards[i].damage > 0), `${label}: you may choose a character to move up to ${max} damage from.`, { optional: true });
    if (!src) return;
    const dst = x.chooseOne(x.characters(x.opp).filter((i) => i !== src), `${label}: choose an opposing character to move the damage from ${x.name(src)} to.`);
    if (!dst) return;
    const have = Math.min(max, x.s.cards[src].damage);
    let n = have;
    if (have > 1) {
      const labels = [];
      for (let k = have; k >= 1; k--) labels.push(`Move ${k} damage`);
      n = have - x.mode(`${label}: how much damage to move from ${x.name(src)} to ${x.name(dst)}?`, labels);
    }
    x.moveDamage(src, dst, n);
  }

  A['cheshire-cat-inexplicable'] = {
    triggers: [{
      name: "IT'S LOADS OF FUN", on: 'putUnder', when: H.self,
      run(x) { moveDamageBetween(x, "It's Loads of Fun", 2); },
    }],
  };

  A['dumbo-the-flying-elephant'] = {
    triggers: [{
      name: 'AERIAL DUO', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(), 'Aerial Duo: choose a character to gain Evasive until the start of your next turn.');
        if (t) x.buff(t, { kw: { Evasive: true } }, x.until.myNextTurn(), 'gains Evasive until the start of your next turn');
      },
    }],
  };

  A['isis-vanderchill-ice-queen-of-st-canard'] = {
    triggers: [{
      name: 'CHILL OUT', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), 'Chill Out: choose an opposing character to exert.');
        if (t) x.exert(t);
      },
    }],
  };

  A['tigger-bouncing-all-the-way'] = {
    triggers: [{
      name: 'SPLENDERIFFIC BOUNCE', on: 'played', when: H.self,
      run(x) {
        const from = x.inPlay().filter((i) => (x.isChar(i) || x.isItem(i) || LC.isLocation(x.def(i))) && x.cost(i) <= 2);
        const t = x.chooseOne(from, "Splenderiffic Bounce: you may return a chosen character, item, or location with cost 2 or less to their player's hand.", { optional: true });
        if (t) x.toHand(t);
      },
    }],
  };

  A['luisa-madrigal-confident-climber'] = {
    activated: [{
      name: 'I CAN TAKE IT', cost: { ink: 1 },
      text: 'Move up to 1 damage from chosen character of yours to this character. Then, if this character has 3 or more damage, move all damage from this character to chosen opposing character.',
      run(x) {
        const src = x.chooseOne(x.characters(x.ctrl), 'I Can Take It: choose a character of yours to move up to 1 damage from to Luisa Madrigal.');
        if (src && src !== x.me && x.s.cards[src].damage > 0 && x.s.cards[x.me].zone === 'play') {
          if (x.may(`I Can Take It: move 1 damage from ${x.name(src)} to Luisa Madrigal?`, 'Move 1 damage', 'Move none')) x.moveDamage(src, x.me, 1);
        }
        if (x.s.cards[x.me].zone !== 'play' || x.s.cards[x.me].damage < 3) return;
        const n = x.s.cards[x.me].damage;
        const t = x.chooseOne(x.characters(x.opp), `I Can Take It: choose an opposing character to move all ${n} damage from Luisa Madrigal to.`);
        if (t) x.moveDamage(x.me, t, 'all');
      },
    }],
  };

  A['demona-scourge-of-the-wyvern-clan'] = {
    triggers: [{
      name: 'AD SAXUM COMMUTATE', on: 'played', when: H.self,
      run(x) {
        for (const t of x.characters(x.opp)) x.exert(t);
        // CR 6.7.6: the active player acts first.
        for (const p of [x.s.active, 1 - x.s.active]) {
          const need = 3 - x.s.players[p].hand.length;
          if (need > 0) x.draw(p, need);
        }
      },
    }],
    auras: [H.stoneByDay],
  };

  A['christopher-robin-joining-the-fun'] = { selfCost: H.underdog };

  A['violet-parr-learning-new-powers'] = {
    triggers: [{
      name: 'DEFLECT', on: 'played', when: H.self,
      run(x) { moveDamageBetween(x, 'Deflect', 1); },
    }],
  };

  A['hades-looking-for-a-deal'] = {
    triggers: [{
      name: "WHAT D'YA SAY?", on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), "What D'ya Say?: you may choose an opposing character. Its player puts it on the bottom of their deck, or you draw 2 cards.", { optional: true });
        if (!t) return;
        const owner = x.s.cards[t].owner;
        const bottom = x.may(`What D'ya Say?: put ${x.name(t)} on the bottom of your deck? If you don't, your opponent draws 2 cards.`, 'Put it on the bottom', 'Opponent draws 2', owner);
        if (bottom) x.toDeck(t, 'bottom');
        else x.draw(x.ctrl, 2);
      },
    }],
  };

  const discardChars = (s, p) => s.players[p].discard.filter((i) => LC.isCharacter(LC.CARDS[s.cards[i].id]));
  A['maleficent-and-diablo-evil-incarnate'] = {
    // FOOLS!: an alternate Shift cost. The cards go to the bottom in the order picked.
    altShift: {
      can: (s, iid) => discardChars(s, s.cards[iid].owner).length >= 5,
      pay(x, iid) {
        const p = x.s.cards[iid].owner;
        const pick = x.chooseCards({ who: p, src: iid, from: discardChars(x.s, p), min: 5, max: 5, chosen: false, prompt: 'Fools!: choose 5 character cards from your discard to put on the bottom of your deck (in the order picked) to shift Maleficent & Diablo for free.' });
        for (const i of pick) x.toDeck(i, 'bottom');
      },
    },
    triggers: [{
      name: "RAVEN'S CALL", on: 'exerts', when: (s, me, ev) => ev.iid === me && H.myTurn(s, me),
      run(x) { x.draw(x.ctrl, 1); },
    }],
  };

  A['elsa-exploring-the-unknown'] = {
    triggers: [{
      name: 'CLOSER LOOK', on: 'played', when: H.self,
      run(x) { if (x.may('Closer Look: draw a card?', 'Draw 1', 'No')) x.draw(x.ctrl, 1); },
    }],
  };

  A['aladdin-and-genie-mischievous-pals'] = {
    triggers: [{
      name: 'SLEIGHT OF HAND', on: 'played', when: H.self,
      run(x) {
        const hand = x.hand(x.ctrl);
        const pick = x.chooseCards({ from: hand, min: 0, max: hand.length, chosen: false, prompt: 'Sleight of Hand: you may put any number of cards from your hand on the bottom of your deck (in the order picked), then draw that many plus 1.' });
        if (!pick.length) return;
        for (const i of pick) x.toDeck(i, 'bottom');
        x.draw(x.ctrl, pick.length + 1);
      },
    }],
  };

  A['taran-magically-armed'] = {
    triggers: [{
      name: 'WEAKEN THE CAULDRON', on: 'played', when: H.self,
      run(x) {
        const m = x.mode("Weaken the Cauldron: choose a player. Put up to 2 cards from that player's discard on the bottom of their deck.", ['You', 'Your opponent']);
        const p = m === 0 ? x.ctrl : x.opp;
        const pick = x.chooseCards({ from: x.discardPile(p), min: 0, max: 2, chosen: false, prompt: `Weaken the Cauldron: choose up to 2 cards from ${p === x.ctrl ? 'your' : "your opponent's"} discard to put on the bottom of their deck (in the order picked).` });
        for (const i of pick) x.toDeck(i, 'bottom');
      },
    }],
  };

  A['second-star-to-the-right'] = {
    action(x) {
      const m = x.mode('Second Star to the Right: choose a player to draw 5 cards.', ['You draw 5 cards', 'Your opponent draws 5 cards']);
      x.draw(m === 0 ? x.ctrl : x.opp, 5);
    },
  };

  A['demona-betrayer-of-the-clan'] = { auras: [H.stoneByDay] };

  A['ursula-whisper-of-vanessa'] = {
    auras: [(s, me, t, r) => {
      if (t !== me || !s.cards[me].under.length) return;
      r.lore += 1;
      if (r.kw.Evasive === undefined) r.kw.Evasive = true;
    }],
  };

  A['elsa-spirit-of-winter'] = {
    triggers: [{
      name: 'DEEP FREEZE', on: 'played', when: H.self,
      run(x) {
        const pick = x.chooseCards({ from: x.characters(), min: 0, max: 2, prompt: "Deep Freeze: choose up to 2 characters to exert. They can't ready at the start of their next turn." });
        for (const t of pick) {
          x.exert(t);
          x.buff(t, { flags: { cantReady: true } }, x.until.theirNextReady(x.s.cards[t].owner), "can't ready at the start of their next turn");
        }
      },
    }],
  };

  A['camilo-madrigal-prankster'] = {
    triggers: [{
      name: 'MANY FORMS', on: 'turnStart', when: H.mine,
      run(x) {
        const m = x.mode('Many Forms: you may choose one.', ['Get +1 lore this turn', 'Gain Challenger +2 this turn', 'Choose neither']);
        if (m === 0) x.buff(x.me, { lore: 1 }, x.until.eot(), '+1 lore this turn');
        if (m === 1) x.buff(x.me, { kw: { Challenger: 2 } }, x.until.eot(), 'gains Challenger +2 this turn');
      },
    }],
  };
})();
