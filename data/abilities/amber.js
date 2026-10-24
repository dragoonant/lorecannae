// Amber card abilities (first ink Amber). Authoring guide: docs/ABILITIES.md.
(function () {
  const LC = globalThis.LC;
  const H = LC.H;
  const A = LC.ABIL;

  // EXAMPLE — optional targeted banish with a filter.
  A['gaston-superior-archer'] = {
    triggers: [{
      name: 'WATCH THIS!', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters().filter((i) => x.chars(i).str >= 5), 'Watch This!: you may banish a chosen character with 5 or more strength.', { optional: true });
        if (t) x.banish(t);
      },
    }],
  };

  // EXAMPLE — activated ability with an exert cost; "next character" payment modifier.
  A['hamm-piggy-bank'] = {
    activated: [{
      name: 'LOOSE CHANGE', text: 'You pay 1 less for the next character you play this turn.', cost: { exert: true },
      run(x) { x.costMod(x.ctrl, { amount: 1, type: 'character' }); },
    }],
  };

  // ---- remaining Amber cards below ----

  const cost = (s, i) => LC.CARDS[s.cards[i].id].cost;
  const isCharId = (s, i) => LC.isCharacter(LC.CARDS[s.cards[i].id]);
  const owner = (s, me) => s.cards[me].owner;
  const otherChars = (s, me) => LC.characters(s, owner(s, me)).filter((i) => i !== me).length;
  const onceUsed = (s, me, key) => !!s.ti.once[`once:${me}:${key}`];

  // SMOOTH THE WAY — static payment modifier (CR 4.3.6): during your turn, the first character
  // you play while this is in play costs 1 less, however it is played (free plays use it up).
  // The "used" mark is set the moment a character of yours enters play during your turn; the
  // `when` filter records it and never adds anything to the bag (this isn't a triggered ability).
  A['grandmother-willow-ancient-advisor'] = {
    costAura: (s, me, iid, p) => (p === owner(s, me) && s.active === p && isCharId(s, iid) && !onceUsed(s, me, 'SMOOTH THE WAY') ? -1 : 0),
    triggers: [{
      name: 'SMOOTH THE WAY', on: 'played',
      when(s, me, ev) {
        if (ev.iid !== me && ev.kind === 'character' && ev.p === owner(s, me) && s.active === ev.p) s.ti.once[`once:${me}:SMOOTH THE WAY`] = true;
        return false;
      },
      run() {},
    }],
  };

  A['stitch-carefree-surfer'] = {
    triggers: [{
      name: 'OHANA', on: 'played', when: H.self, // CR 6.2.4: the 'if' is checked on resolution
      run(x) {
        if (otherChars(x.s, x.me) < 2) return;
        if (x.may('Ohana: you have 2 or more other characters in play. You may draw 2 cards.', 'Draw 2', 'Decline')) x.draw(x.ctrl, 2);
      },
    }],
  };

  A['besties-assemble'] = {
    action(x) { x.lookPick({ n: 4, filter: (i) => x.isChar(i), prompt: 'Besties Assemble: look at the top 4 cards. You may reveal a character card and put it into your hand; the rest go on the bottom.' }); },
  };

  A['ohana-means-family'] = {
    action(x) {
      const t = x.chooseOne(x.characters(x.ctrl), 'Ohana Means Family: choose a character of yours to remove all damage from. Draw a card for each 1 damage removed.');
      if (!t) return;
      const n = x.heal(t, 'all');
      if (n > 0) x.draw(x.ctrl, n);
    },
  };

  A['the-horseman-strikes'] = {
    action(x) {
      x.draw(x.ctrl, 1);
      const t = x.chooseOne(x.characters().filter((i) => x.chars(i).kw.Evasive), 'The Horseman Strikes!: you may banish a chosen character with Evasive.', { optional: true });
      if (t) x.banish(t);
    },
  };

  A['angel-siren-singer'] = { selfCost: H.underdog };

  A['bambi-ethereal-fawn'] = {
    triggers: [{
      name: 'COME SEE!', on: 'exerts', when: (s, me, ev) => ev.iid === me && H.myTurn(s, me),
      run(x) {
        const n = x.s.cards[x.me].zone === 'play' ? x.s.cards[x.me].under.length : 0;
        const top = x.deck(x.ctrl).slice(0, n);
        if (!top.length) return;
        x.reveal(top);
        for (const i of top) if (x.isChar(i)) x.toHand(i);
        for (const i of top) if (!x.isChar(i)) LC.move(x.s, i, 'deck', { pos: 'bottom' });
      },
    }],
  };

  // SPIKE SUIT — the engine's dealWithWillpower flag (challenge damage = {W}; Challenger adds
  // {S}, so it doesn't count, CR 8.5.1). Applies whether your character challenges or is challenged.
  A['dale-ready-for-his-shot'] = {
    auras: [(s, me, t, r) => { if (r.type === 'character' && s.cards[t].owner === owner(s, me)) r.flags.dealWithWillpower = true; }],
  };

  A['tinker-bell-generous-fairy'] = {
    triggers: [{
      name: 'MAKE A NEW FRIEND', on: 'played', when: H.self,
      run(x) { x.lookPick({ n: 4, filter: (i) => x.isChar(i), prompt: 'Make a New Friend: look at the top 4 cards. You may reveal a character card and put it into your hand; the rest go on the bottom.' }); },
    }],
  };

  A['stitch-carefree-snowboarder'] = {
    triggers: [{
      name: 'BRING YOUR FRIENDS', on: 'quest', when: H.self, // CR 6.2.4
      run(x) {
        if (otherChars(x.s, x.me) < 2) return;
        if (x.may('Bring Your Friends: you have 2 or more other characters in play. You may draw a card.', 'Draw 1', 'Decline')) x.draw(x.ctrl, 1);
      },
    }],
  };

  A['akood-et-emuti'] = {
    action(x) {
      x.costMod(x.ctrl, { amount: 2, type: 'character' });
      LC.log(x.s, x.ctrl, 'buff', { iid: x.me, text: 'makes the next character you play this turn cost 2 less' });
      x.draw(x.ctrl, 1);
    },
  };

  A['aurora-holding-court'] = {
    triggers: [{
      name: 'ROYAL WELCOME', on: 'quest', when: H.self,
      run(x) { x.costMod(x.ctrl, { amount: 1, type: 'character', classes: ['Princess', 'Queen'] }); },
    }],
  };

  A['pluto-friendly-pooch'] = {
    activated: [{
      name: 'GOOD DOG', text: 'You pay 1 less for the next character you play this turn.', cost: { exert: true },
      run(x) { x.costMod(x.ctrl, { amount: 1, type: 'character' }); },
    }],
  };

  // FIND A FRIEND — each player in turn order reveals their top card. A character card they
  // decline to take stays on top (the "Otherwise" covers only non-character cards).
  A['mike-wazowski-heroic-climber'] = {
    triggers: [{
      name: 'FIND A FRIEND', on: ['played', 'quest'], when: H.self,
      run(x) {
        for (const p of [x.s.active, 1 - x.s.active]) {
          const top = x.s.players[p].deck[0];
          if (!top) continue;
          x.reveal([top], p);
          if (x.isChar(top)) {
            if (x.may(`Find a Friend: you revealed ${x.name(top)}, a character card. You may put it into your hand.`, 'Put into hand', 'Leave on top', p)) x.toHand(top);
          } else x.toDeck(top, 'bottom');
        }
      },
    }],
  };

  A['pocahontas-guiding-the-tribe'] = {
    triggers: [{
      name: 'STAY CLOSE', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.hand(x.ctrl).filter((i) => x.isChar(i) && x.cost(i) === 1), 'Stay Close: you may play a character with cost 1 from your hand for free.', { optional: true, chosen: false });
        if (t) x.playFree(t);
      },
    }],
  };

  A['nani-stage-manager'] = {
    triggers: [{
      name: "THAT'S YOUR CUE", on: 'played', when: H.self,
      run(x) { x.lookPick({ n: 4, filter: (i) => x.isChar(i) && x.cost(i) <= 2, prompt: "That's Your Cue: look at the top 4 cards. You may reveal a character card with cost 2 or less and put it into your hand; the rest go on the bottom." }); },
    }],
  };

  const calmingOk = (s, me, ev) => ev.shifted && !s.ti.challenged[owner(s, me)];
  A['pocahontas-peacekeeper'] = {
    triggers: [{
      name: 'CALMING WORDS', on: 'played', when: H.self, // CR 6.2.4
      run(x, ev) {
        if (!calmingOk(x.s, x.me, ev)) return;
        x.effect({ kind: 'noChallenge', ...x.until.myNextTurn() });
        LC.log(x.s, x.ctrl, 'buff', { iid: x.me, text: 'stops all characters from challenging until the start of your next turn' });
      },
    }],
  };

  A['meilin-lee-losing-control'] = {
    triggers: [{
      name: 'RED PANDA POWER', on: 'played', when: H.self,
      run(x) {
        x.lookPick({
          n: 4, filter: (i) => (x.isChar(i) && x.def(i).classifications.includes('Red Panda')) || x.isSong(i),
          prompt: 'Red Panda Power: look at the top 4 cards. You may reveal a Red Panda character card or a song card and put it into your hand; the rest go on the bottom.',
        });
      },
    }],
  };

  const CP = 'COMMAND PERFORMANCE';
  const cpOk = (s, me) => s.cards[me].zone === 'play' && s.cards[me].under.length > 0 && H.myTurn(s, me);
  A['ariel-ethereal-voice'] = {
    triggers: [{
      name: CP, on: 'played', when: (s, me, ev) => ev.p === owner(s, me) && ev.song && cpOk(s, me) && !onceUsed(s, me, CP),
      run(x) {
        if (!cpOk(x.s, x.me) || !x.once(CP)) return;
        if (x.may('Command Performance: you played a song and there is a card under Ariel. You may draw a card.', 'Draw 1', 'Decline')) x.draw(x.ctrl, 1);
      },
    }],
  };

  A['circle-of-life'] = {
    action(x) {
      const t = x.chooseOne(x.discardPile(x.ctrl).filter((i) => x.isChar(i)), 'Circle of Life: choose a character in your discard to play for free.', { chosen: false });
      if (t) x.playFree(t);
    },
  };

  A['mowgli-man-cub'] = {
    triggers: [{
      name: 'HAVE A BETTER LOOK', on: 'played', when: H.self,
      run(x) {
        // Two-player game: the only opponent is the chosen opponent.
        const hand = x.hand(x.opp);
        x.reveal(hand, x.opp);
        const pick = x.chooseCards({ who: x.opp, from: hand.filter((i) => !x.isChar(i)), seen: hand, min: 1, max: 1, chosen: false, prompt: 'Have a Better Look: your hand is revealed. Choose a non-character card from your hand to discard.' });
        for (const h of pick) x.discard(h);
      },
    }],
  };

  A['stitch-rock-star'] = {
    triggers: [{
      name: 'ADORING FANS', on: 'played', when: (s, me, ev) => ev.p === owner(s, me) && ev.kind === 'character' && cost(s, ev.iid) <= 2,
      run(x, ev) {
        const c = x.s.cards[ev.iid];
        if (c.zone !== 'play' || c.exerted) return; // can't exert them, so no draw (CR 6.1.4.1)
        if (!x.may(`Adoring Fans: you may exert ${x.name(ev.iid)} to draw a card.`, 'Exert and draw', 'Decline')) return;
        if (x.exert(ev.iid)) x.draw(x.ctrl, 1);
      },
    }],
  };

  A['jumba-jookiba-prolific-inventor'] = {
    audit: '1: 1 less per character = minus the character count',
    selfCost: (s, iid, p) => -LC.characters(s, p).length,
    triggers: [{
      name: 'I AM HELPING', on: 'quest', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(), 'I Am Helping: you may remove all damage from a chosen character.', { optional: true });
        if (t) x.heal(t, 'all');
      },
    }],
  };

  A['raging-storm'] = {
    action(x) { for (const t of x.characters()) x.banish(t); },
  };

  A['world-s-greatest-criminal-mind'] = {
    action(x) {
      const t = x.chooseOne(x.characters().filter((i) => x.chars(i).str >= 5), "World's Greatest Criminal Mind: choose a character with 5 or more strength to banish.");
      if (t) x.banish(t);
    },
  };

  A['look-at-this-family'] = {
    action(x) { x.lookPick({ n: 5, max: 2, filter: (i) => x.isChar(i), prompt: 'Look at This Family: look at the top 5 cards. You may reveal up to 2 character cards and put them into your hand; the rest go on the bottom.' }); },
  };

  A['safety-rope'] = {
    triggers: [
      {
        name: 'GRAB HOLD!', on: 'played', when: H.self,
        run(x) {
          const t = x.chooseOne(x.discardPile(x.ctrl).filter((i) => x.isChar(i)), 'Grab Hold!: you may put a character card from your discard on the top of your deck.', { optional: true, chosen: false });
          if (t) x.toDeck(t, 'top');
        },
      },
      {
        name: 'PACK IT UP', on: 'turnEnd', when: H.mine,
        run(x) {
          if (x.s.cards[x.me].zone !== 'play') return;
          if (!x.may('Pack It Up: you may banish Safety Rope to draw a card.', 'Banish and draw', 'Decline')) return;
          if (x.banish(x.me)) x.draw(x.ctrl, 1);
        },
      },
    ],
  };

  A['ursula-s-shell-necklace'] = {
    triggers: [{
      name: 'NOW, SING!', on: 'played', when: (s, me, ev) => ev.p === owner(s, me) && ev.song,
      run(x) {
        if (LC.readyInk(x.s, x.ctrl) < 1) return; // can't pay = declined (CR 6.1.4.1)
        if (!x.may('Now, Sing!: you may pay 1 ink to draw a card.', 'Pay 1 and draw', 'Decline')) return;
        LC.payInk(x.s, x.ctrl, 1);
        x.draw(x.ctrl, 1);
      },
    }],
  };

  A['mickey-mouse-expedition-leader'] = {
    mayEnterExerted: true,
    triggers: [{
      name: 'SECRET PATH', on: 'quest', when: (s, me, ev) => ev.p === owner(s, me) && ev.iid !== me && s.cards[me].exerted,
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), 'Secret Path: choose an opposing character to get -2 strength until the start of your next turn.');
        if (t) x.buff(t, { str: -2 }, x.until.myNextTurn(), '-2 strength until the start of your next turn');
      },
    }],
  };

  A['woody-helping-a-friend'] = {
    triggers: [{
      name: 'HANG ON!', on: 'played', when: H.self,
      run(x) {
        const both = x.characters(x.ctrl).some((i) => i !== x.me && x.hasClass(i, 'Toy'));
        const labels = ['Return a character card with cost 2 or less from your discard to your hand', 'Play a character with cost 2 or less for free'];
        const m = both ? -1 : x.mode('Hang On!: choose one.', labels);
        if (both || m === 0) {
          const t = x.chooseOne(x.discardPile(x.ctrl).filter((i) => x.isChar(i) && x.cost(i) <= 2), 'Hang On!: you may return a character card with cost 2 or less from your discard to your hand.', { optional: true, chosen: false });
          if (t) x.toHand(t);
        }
        if (both || m === 1) {
          const t = x.chooseOne(x.hand(x.ctrl).filter((i) => x.isChar(i) && x.cost(i) <= 2), 'Hang On!: you may play a character with cost 2 or less from your hand for free.', { optional: true, chosen: false });
          if (t) x.playFree(t);
        }
      },
    }],
  };
})();
