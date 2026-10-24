// Emerald card abilities (first ink Emerald). Authoring guide: docs/ABILITIES.md.
(function () {
  const LC = globalThis.LC;
  const H = LC.H;
  const A = LC.ABIL;

  // EXAMPLE — draw then choose-and-discard.
  A['tod-clever-fox'] = {
    triggers: [{
      name: 'PROBLEM SOLVING', on: 'played', when: H.self,
      run(x) { x.draw(x.ctrl, 2); x.chooseDiscard(x.ctrl, 1, 'Problem Solving: choose a card to discard.'); },
    }],
  };

  // EXAMPLE — static ability on itself that reads plain state (cards under it).
  A['flynn-rider-spectral-scoundrel'] = {
    auras: [(s, me, t, r) => { if (t === me && s.cards[me].under.length) { r.str += 2; r.lore += 1; } }],
  };

  // EXAMPLE — self-referential payment modifier.
  A['white-rabbit-late-again'] = { selfCost: H.underdog };

  // EXAMPLE — end-of-turn trigger with an "if" condition checked at trigger and resolution.
  const threeExerted = (s, p) => LC.characters(s, p).filter((i) => s.cards[i].exerted).length >= 3;
  A['elinor-renowned-diplomat'] = {
    audit: '3: threeExerted() counts 3 or more exerted characters',
    triggers: [{
      name: 'COORDINATED EFFORTS', on: 'turnEnd', when: H.mine, // CR 6.2.4: the 'if' is checked on resolution
      run(x) {
        if (!threeExerted(x.s, x.ctrl)) return;
        const t = x.chooseOne(x.characters(x.opp), 'Coordinated Efforts: choose an opposing character to deal 1 damage to.');
        if (t) x.damage(t, 1);
        x.gainLore(x.ctrl, 1);
        x.draw(x.ctrl, 1);
      },
    }],
  };

  // EXAMPLE — two trigger events on one ability; a buff active only during their next turn.
  A['john-silver-alien-pirate'] = {
    triggers: [{
      name: 'PICK YOUR FIGHTS', on: ['played', 'quest'], when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), 'Pick Your Fights: choose an opposing character to gain Reckless during their next turn.');
        if (t) x.buff(t, { kw: { Reckless: true } }, x.until.theirNextTurn(x.opp), 'gains Reckless during their next turn');
      },
    }],
  };

  // ---- remaining Emerald cards below ----

  // Shared shapes.
  const songIn = (x, p, maxCost) => x.discardPile(p).filter((i) => x.isSong(i) && x.cost(i) <= maxCost);
  const playable = (x, i) => { const a = LC.ABIL[x.def(i).id]; return !(a && a.cantPlay && a.cantPlay(x.s, i)); };
  const locations = (x, p) => x.inPlay(p).filter((i) => LC.isLocation(x.def(i)));
  const payIfAble = (x, n) => { if (LC.readyInk(x.s, x.ctrl) < n) return false; LC.payInk(x.s, x.ctrl, n); return true; };
  // "chosen opponent reveals their hand and discards a [type] card of your choice." Two
  // players: the only opponent is the chosen one. You choose, seeing the whole hand.
  const revealAndDiscard = (x, label, filter, kindText) => {
    const hand = x.hand(x.opp);
    x.reveal(hand, x.opp);
    const pick = x.chooseCards({ from: hand.filter(filter), seen: hand, min: 1, max: 1, chosen: false, prompt: `${label}: choose ${kindText} from your opponent's hand for them to discard.` });
    for (const h of pick) x.discard(h);
  };
  // "you may draw N, then choose and discard N" (the "may" covers both parts).
  const mayLoot = (x, label, n = 1) => {
    const k = n === 1 ? 'a card' : `${n} cards`;
    if (!x.may(`${label}: draw ${k}, then choose and discard ${k}?`, 'Draw and discard', 'Decline')) return;
    x.draw(x.ctrl, n);
    x.chooseDiscard(x.ctrl, n, `${label}: choose ${k} to discard.`);
  };
  const twoToDiscard = (s, p) => s.ti.toDiscard[p] >= 2;

  A['ursula-deceiver'] = {
    triggers: [{
      name: "YOU'LL NEVER EVEN MISS IT", on: 'played', when: H.self,
      run(x) { revealAndDiscard(x, "You'll Never Even Miss It", (i) => x.isSong(i), 'a song card'); },
    }],
  };

  const oppMoreCards = (s, p) => s.players[1 - p].hand.length > s.players[p].hand.length;
  A['mushu-stealthy-dragon'] = {
    triggers: [{
      name: 'TIP THE SCALES', on: 'quest', when: H.self, // CR 6.2.4
      run(x) {
        if (!oppMoreCards(x.s, x.ctrl)) return;
        if (x.may('Tip the Scales: draw a card?', 'Draw', 'Decline')) x.draw(x.ctrl, 1);
      },
    }],
  };

  A['vixey-forest-friend'] = { selfCost: (s, iid, p) => (LC.hasNamed(s, p, 'Tod') ? -1 : 0) };

  A['the-queen-devious-disguise'] = {
    triggers: [{
      name: 'EVIL SCHEME', on: 'played', when: H.self,
      run(x) {
        if (!x.may('Evil Scheme: draw a card? If you do, each opponent gains 2 lore.', 'Draw', 'Decline')) return;
        if (x.draw(x.ctrl, 1)) x.gainLore(x.opp, 2);
      },
    }],
    auras: [(s, me, t, r) => {
      if (t !== me) return;
      const p = s.cards[me].owner;
      if (s.players[1 - p].lore > s.players[p].lore) r.lore += 2;
    }],
  };

  // "you may pay N {I} to [effect on chosen X]": choosing a target is accepting; pay, then do.
  A['aladdin-doing-his-part'] = {
    triggers: [{
      name: 'CLEAR IT OUT', on: 'played', when: H.self,
      run(x) {
        if (LC.readyInk(x.s, x.ctrl) < 1) return;
        const t = x.chooseOne(x.items(), 'Clear It Out: you may pay 1 ink to banish a chosen item.', { optional: true });
        if (t && payIfAble(x, 1)) x.banish(t);
      },
    }],
  };

  A['max-goof-rebellious-teen'] = {
    triggers: [{
      name: 'PERSONAL SOUNDTRACK', on: 'played', when: H.self,
      run(x) {
        if (LC.readyInk(x.s, x.ctrl) < 1) return;
        const t = x.chooseOne(songIn(x, x.ctrl, 3), 'Personal Soundtrack: you may pay 1 ink to return a song card with cost 3 or less from your discard to your hand.', { optional: true, chosen: false });
        if (t && payIfAble(x, 1)) x.toHand(t);
      },
    }],
  };

  A['bobby-zimuruski-spray-cheese-kid'] = {
    triggers: [{ name: 'SO CHEESY', on: 'played', when: H.self, run(x) { mayLoot(x, 'So Cheesy'); } }],
  };

  // "you may choose and discard a card. If you do / to return chosen character to their
  // player's hand." The discard is [A]; the return happens only after a discard (CR 6.1.5.1).
  const discardToBounce = (label) => (x) => {
    const d = x.chooseCards({ from: x.hand(x.ctrl), min: 0, max: 1, chosen: false, prompt: `${label}: you may choose and discard a card to return a chosen character to their player's hand.` });
    if (!d.length) return;
    x.discard(d[0]);
    const t = x.chooseOne(x.characters(), `${label}: choose a character to return to their player's hand.`);
    if (t) x.toHand(t);
  };
  A['rapunzel-tower-defender'] = {
    triggers: [{ name: "THE FATES' DESIGN", on: 'played', when: H.self, run: discardToBounce("The Fates' Design") }],
  };

  A['lyle-tiberius-rourke-adventurer-for-hire'] = {
    audit: '2: twoToDiscard() checks 2 or more cards put into the discard',
    triggers: [
      { name: 'EYE FOR VALUE', on: 'played', when: H.self, run(x) { mayLoot(x, 'Eye for Value'); } },
      {
        name: 'DIRTY TRICKS', on: 'turnEnd', when: H.mine, // CR 6.2.4
        run(x) { if (twoToDiscard(x.s, x.ctrl)) x.loseLore(x.opp, 1); },
      },
    ],
  };

  const COMIN = 'COMIN UP FAST';
  A['lenny-toy-binoculars'] = {
    triggers: [
      {
        name: 'TAKE A GOOD LOOK', on: 'played', when: H.self,
        run(x) { revealAndDiscard(x, 'Take a Good Look', (i) => x.isAction(i), 'an action card'); },
      },
      {
        name: "COMIN' UP FAST", on: 'played',
        when: (s, me, ev) => ev.kind === 'action' && H.mine(s, me, ev) && H.myTurn(s, me) && !s.ti.once[`once:${me}:${COMIN}`],
        run(x) {
          if (!x.myTurn() || !x.once(COMIN)) return;
          if (x.may("Comin' Up Fast: ready this character?", 'Ready', 'Decline')) x.ready(x.me);
        },
      },
    ],
  };

  A['milo-thatch-getting-his-hands-dirty'] = {
    audit: '2: twoToDiscard() checks 2 or more cards put into the discard',
    triggers: [
      { name: "SCHOLAR'S GAMBIT", on: 'played', when: H.self, run: discardToBounce("Scholar's Gambit") },
      {
        name: 'PRACTICAL KNOWLEDGE', on: 'turnEnd', when: H.mine, // CR 6.2.4
        run(x) { if (twoToDiscard(x.s, x.ctrl)) x.draw(x.ctrl, 1); },
      },
    ],
  };

  A['prince-phillip-vanquisher-of-foes'] = {
    triggers: [{
      name: 'SWIFT AND SURE', on: 'played', when: H.self,
      run(x) { for (const t of x.characters(x.opp).filter((i) => x.s.cards[i].damage > 0)) x.banish(t); },
    }],
  };

  // "{E}, 1 {I}, Banish chosen character of yours — Play a character with cost up to 2 more
  // than the banished character for free." The banish is part of the cost, so the ability
  // needs a character of yours to activate; the character played comes from your hand.
  A['retro-evolution-device'] = {
    activated: [{
      name: 'TURN INTO DINOSAUR', text: 'Banish chosen character of yours — play a character with cost up to 2 more than the banished character for free.',
      cost: { exert: true, ink: 1 },
      can: (s, me) => LC.characters(s, s.cards[me].owner).length > 0,
      whyNot: () => 'You have no character to banish.',
      run(x) {
        const b = x.chooseOne(x.characters(x.ctrl), 'Turn Into Dinosaur: choose a character of yours to banish (cost).');
        if (!b) return;
        const max = x.cost(b) + 2;
        x.banish(b);
        const c = x.chooseOne(x.hand(x.ctrl).filter((i) => x.isChar(i) && x.cost(i) <= max && playable(x, i)), `Turn Into Dinosaur: choose a character with cost ${max} or less to play for free.`, { chosen: false });
        if (c) x.playFree(c);
      },
    }],
  };

  A['malicious-mean-and-scary'] = {
    action(x) { for (const t of x.characters(x.opp)) x.putDamage(t, 1); },
  };

  // "in any order": the order shown (DEVIATIONS.md).
  A['under-the-sea'] = {
    action(x) { for (const t of x.characters(x.opp).filter((i) => x.chars(i).str <= 2)) x.toDeck(t, 'bottom'); },
  };

  A['chernabog-unnatural-force'] = {
    triggers: [{
      name: 'DARK DANCE', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), "Dark Dance: you may shuffle a chosen opposing character into their player's deck.", { optional: true });
        if (!t) return;
        const p = x.s.cards[t].owner;
        x.shuffleInto(t);
        const c = x.chooseCards({ who: p, from: x.discardPile(p).filter((i) => x.isChar(i) && playable(x, i)), min: 0, max: 1, chosen: false, prompt: 'Dark Dance: you may play a character from your discard for free.' })[0];
        if (c) x.playFree(c);
      },
    }],
  };

  A['max-goof-chart-topper'] = {
    triggers: [{
      name: 'NUMBER ONE HIT', on: 'quest', when: H.self,
      run(x) {
        const t = x.chooseOne(songIn(x, x.ctrl, 4).filter((i) => playable(x, i)), 'Number One Hit: you may play a song card with cost 4 or less from your discard for free (it then goes on the bottom of your deck).', { optional: true, chosen: false });
        if (!t) return;
        // "then put it on the bottom of your deck instead of into your discard"
        x.playFree(t, { actionTo: 'deckBottom' });
      },
    }],
  };

  A['strike-a-good-match'] = {
    action(x) { x.draw(x.ctrl, 2); x.chooseDiscard(x.ctrl, 1, 'Strike a Good Match: choose a card to discard.'); },
  };

  A['put-that-thing-back'] = {
    action(x) {
      const t = x.chooseOne([...x.characters(), ...x.items()], "Put That Thing Back: choose a character or item to return to their player's hand.");
      if (t) x.toHand(t);
    },
  };

  A['to-wither-a-flower'] = {
    action(x) { for (const t of x.characters(x.opp).filter((i) => x.s.cards[i].damage > 0)) x.damage(t, 2); },
  };

  A['gaetan-moliere-clever-burrower'] = {
    triggers: [{ name: 'UNEARTH', on: 'quest', when: H.self, run(x) { mayLoot(x, 'Unearth', 2); } }],
  };

  A['mickey-mouse-snowboard-ace'] = {
    triggers: [{
      name: 'SLIPPERY SLOPE', on: ['played', 'leavesPlay'], when: H.self,
      run(x) { x.chooseDiscard(x.opp, 1, 'Slippery Slope: choose a card to discard.'); },
    }],
  };

  const itemsInDiscard = (s, p) => s.players[p].discard.filter((i) => LC.isItem(LC.CARDS[s.cards[i].id]));
  A['stegmutt-clumsy-dinosaur'] = {
    audit: '1: 1 less per item card in discard = minus the item count',
    selfCost: (s, iid, p) => -itemsInDiscard(s, p).length,
    triggers: [{
      name: 'COLLATERAL DAMAGE', on: 'played', when: H.self,
      run(x) {
        const pool = itemsInDiscard(x.s, x.ctrl);
        if (pool.length < 3) return;
        if (!x.may('Collateral Damage: put 3 item cards from your discard on the bottom of your deck? If you do, deal 3 damage to a chosen character.', 'Put 3 items', 'Decline')) return;
        const pick = x.chooseCards({ from: pool, min: 3, max: 3, chosen: false, prompt: 'Collateral Damage: choose 3 item cards to put on the bottom of your deck (in the order chosen).' });
        for (const i of pick) x.toDeck(i, 'bottom');
        const t = x.chooseOne(x.characters(), 'Collateral Damage: choose a character to deal 3 damage to.');
        if (t) x.damage(t, 3);
      },
    }],
  };

  A['buzz-s-arm'] = {
    freePlay: (s) => s.ti.banishedNames.includes('Buzz Lightyear'),
    activated: [{
      name: 'SOME ASSEMBLY REQUIRED', text: 'You pay 1 less for the next action or item you play this turn.', cost: { exert: true },
      run(x) { x.costMod(x.ctrl, { amount: 1, type: 'actionOrItem' }); },
    }],
  };

  A['enigmatic-inkcaster'] = {
    activated: [{
      name: 'ITS OWN REWARD', text: "If you've played 2 or more cards this turn, gain 1 lore.", cost: { exert: true },
      run(x) { if (x.s.ti.played[x.ctrl] >= 2) x.gainLore(x.ctrl, 1); },
    }],
  };

  A['inscrutable-map'] = {
    activated: [{
      name: 'BACKTRACK', text: 'Chosen opposing character gets -1 lore until the start of your next turn.', cost: { exert: true, ink: 1 },
      run(x) {
        const t = x.chooseOne(x.characters(x.opp), 'Backtrack: choose an opposing character to get -1 lore until the start of your next turn.');
        if (t) x.buff(t, { lore: -1 }, x.until.myNextTurn(), '-1 lore until the start of your next turn');
      },
    }],
  };

  A['my-adventure-book'] = {
    activated: [{
      name: 'NEW MEMORIES', text: "Reveal the top card of your deck. If it's a non-character card or a character card named Kevin, put it into your hand. Otherwise, put it on the bottom of your deck.",
      cost: { exert: true, ink: 1 },
      run(x) {
        const top = x.deck(x.ctrl)[0];
        if (!top) return;
        x.reveal([top]);
        if (!x.isChar(top) || x.def(top).name === 'Kevin') x.toHand(top);
        else x.toDeck(top, 'bottom');
      },
    }],
  };

  A['potion-of-malice'] = {
    activated: [
      {
        name: 'SUPPRESSED ANGER', text: 'Put 1 damage counter on chosen character.', cost: { exert: true, ink: 1 },
        run(x) {
          const t = x.chooseOne(x.characters(), 'Suppressed Anger: choose a character to put 1 damage counter on.');
          if (t) x.putDamage(t, 1);
        },
      },
      {
        name: 'MINDLESS RAGE', text: 'Each opposing damaged character gains Reckless until the start of your next turn.', cost: { exert: true, banishSelf: true },
        run(x) {
          for (const t of x.characters(x.opp).filter((i) => x.s.cards[i].damage > 0)) x.buff(t, { kw: { Reckless: true } }, x.until.myNextTurn(), 'gains Reckless until the start of your next turn');
        },
      },
    ],
  };

  A['battering-ram'] = {
    activated: [
      {
        name: 'FULL FORCE', text: 'Deal 1 damage to chosen damaged character.', cost: { exert: true },
        run(x) {
          const t = x.chooseOne(x.characters().filter((i) => x.s.cards[i].damage > 0), 'Full Force: choose a damaged character to deal 1 damage to.');
          if (t) x.damage(t, 1);
        },
      },
      {
        name: 'BREAK THROUGH', text: 'Banish chosen location.', cost: { exert: true, banishSelf: true },
        run(x) {
          const t = x.chooseOne(locations(x), 'Break Through: choose a location to banish.');
          if (t) x.banish(t);
        },
      },
    ],
  };

  A['piercing-attack'] = {
    action(x) {
      const t = x.chooseOne(x.characters(), "Piercing Attack: choose a character to deal 2 damage to (Resist can't reduce it).");
      if (t) x.damage(t, 2, { noResist: true });
    },
  };

  A['sabotage'] = {
    action(x) {
      const pool = [...x.items(), ...locations(x)];
      const t = x.chooseOne(pool, 'Sabotage: choose an item or location to banish, along with all other items or locations with the same name.');
      if (!t) return;
      const name = x.def(t).name;
      for (const i of [t, ...pool.filter((i) => i !== t && x.def(i).name === name)]) x.banish(i);
    },
  };

  A['freeze-the-vine'] = {
    action(x) {
      for (const t of locations(x)) x.banish(t);
      x.draw(x.ctrl, 2);
      x.chooseDiscard(x.ctrl, 1, 'Freeze the Vine: choose a card to discard.');
    },
  };

  A['education-or-elimination'] = {
    action(x) {
      const m = x.mode('Education or Elimination: choose one.', ['Draw a card; a chosen character of yours gets +1 lore and Evasive until the start of your next turn', 'Banish a chosen damaged character']);
      if (m === 0) {
        x.draw(x.ctrl, 1);
        const t = x.chooseOne(x.characters(x.ctrl), 'Education: choose a character of yours to get +1 lore and gain Evasive until the start of your next turn.');
        if (t) x.buff(t, { lore: 1, kw: { Evasive: true } }, x.until.myNextTurn(), '+1 lore and Evasive until the start of your next turn');
      } else {
        const t = x.chooseOne(x.characters().filter((i) => x.s.cards[i].damage > 0), 'Elimination: choose a damaged character to banish.');
        if (t) x.banish(t);
      }
    },
  };

  A['strange-things'] = {
    action(x) {
      const pick = x.chooseCards({ from: x.characters(), min: 0, max: 2, prompt: "Strange Things: choose up to 2 characters that can't quest until the start of your next turn." });
      for (const t of pick) x.buff(t, { flags: { cantQuest: true } }, x.until.myNextTurn(), "can't quest until the start of your next turn");
      x.draw(x.ctrl, 1);
    },
  };

  A['finnick-tiny-terror'] = {
    triggers: [{
      name: 'YOU BETTER RUN', on: 'played', when: H.self,
      run(x) {
        if (LC.readyInk(x.s, x.ctrl) < 2) return;
        const t = x.chooseOne(x.characters(x.opp).filter((i) => x.chars(i).str <= 2), "You Better Run: you may pay 2 ink to return a chosen opposing character with 2 strength or less to their player's hand.", { optional: true });
        if (t && payIfAble(x, 2)) x.toHand(t);
      },
    }],
  };
})();
