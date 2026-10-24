// Steel card abilities (first ink Steel). Authoring guide: docs/ABILITIES.md.
(function () {
  const LC = globalThis.LC;
  const H = LC.H;
  const A = LC.ABIL;

  // EXAMPLE — a global static restriction the engine reads.
  A['prince-charming-protector-of-the-realm'] = { oneChallengePerTurn: true };

  // EXAMPLE — shared Gargoyle static (STONE BY DAY).
  A['broadway-sturdy-and-strong'] = { auras: [H.stoneByDay] };

  // EXAMPLE — song: an action whose effect reads the board.
  A['strength-of-a-raging-fire'] = {
    action(x) {
      const n = x.characters(x.ctrl).length;
      const t = x.chooseOne(x.characters(), `Strength of a Raging Fire: choose a character to deal ${n} damage to.`);
      if (t) x.damage(t, n);
    },
  };

  // EXAMPLE — statics on itself and on others, conditioned on plain state.
  A['diablo-stone-servant'] = {
    auras: [(s, me, t, r) => {
      const p = s.cards[me].owner;
      if (t === me && H.hasClassInPlay(s, p, 'Villain', me)) { r.str += 2; r.lore += 1; }
      if (s.cards[me].exerted && s.cards[t].owner === p && LC.CARDS[s.cards[t].id].classifications.includes('Villain')) r.flags.cantBeChallenged = true;
    }],
  };

  // EXAMPLE — "each opposing" effect plus a challenge-banish trigger limited to your turn.
  A['tinker-bell-giant-fairy'] = {
    triggers: [
      { name: 'ROCK THE BOAT', on: 'played', when: H.self, run(x) { for (const t of x.characters(x.opp)) x.damage(t, 1); } },
      {
        name: 'PUNY PIRATE!', on: 'banishedInChallenge', when: (s, me, ev) => ev.by === me && H.myTurn(s, me),
        run(x) {
          const t = x.chooseOne(x.characters(x.opp), 'Puny Pirate!: you may deal 2 damage to a chosen opposing character.', { optional: true });
          if (t) x.damage(t, 2);
        },
      },
    ],
  };

  // ---- remaining Steel cards below ----

  A['launchpad-trusty-sidekick'] = {
    activated: [{
      name: 'WHAT DID YOU NEED?', cost: { exert: true },
      text: 'Draw a card. Then, choose and discard a card unless you have a character named Darkwing Duck in play.',
      run(x) {
        x.draw(x.ctrl, 1);
        if (!x.hasNamed(x.ctrl, 'Darkwing Duck')) x.chooseDiscard(x.ctrl, 1, 'What Did You Need?: choose a card to discard (you have no Darkwing Duck in play).');
      },
    }],
  };

  A['angela-night-warrior'] = {
    // ETERNAL NIGHT ("Your Gargoyle characters lose the Stone by Day ability") is read by
    // LC.H.stoneByDay, which every Gargoyle's STONE BY DAY uses.
    triggers: [{
      name: 'SHADOW POWER', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(), 'Shadow Power: you may give a chosen character Challenger +2 and Resist +2 until the start of your next turn.', { optional: true });
        if (t) x.buff(t, { kw: { Challenger: 2, Resist: 2 } }, x.until.myNextTurn(), 'gains Challenger +2 and Resist +2 until the start of your next turn');
      },
    }],
  };

  A['darkwing-duck-shadowy-superhero'] = {
    triggers: [{
      name: 'PREEMPTIVE STRIKE', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.characters(), 'Preemptive Strike: you may deal 1 damage to a chosen character.', { optional: true });
        if (t) x.damage(t, 1);
      },
    }],
  };

  A['angel-experiment-624'] = {
    // UNTOUCHABLE: "While you have no cards in your hand, this character gains Resist +2."
    auras: [(s, me, t, r) => { if (t === me && s.players[s.cards[me].owner].hand.length === 0) r.kw.Resist = (r.kw.Resist || 0) + 2; }],
    // GOOD AIM: "Once during your turn, you may choose and discard a card to deal 2 damage to
    // chosen character." No trigger word, so it is used like an activated ability (as Boost's
    // identical "Once during your turn, you may pay ..." is, CR 8.4); the discard is its cost.
    activated: [{
      name: 'GOOD AIM', cost: { discard: 1 }, once: true,
      text: 'Once during your turn: deal 2 damage to chosen character.',
      run(x) {
        const t = x.chooseOne(x.characters(), 'Good Aim: choose a character to deal 2 damage to.');
        if (t) x.damage(t, 2);
      },
    }],
  };

  A['you-broke-my-smolder'] = {
    action(x) {
      for (const h of x.hand(x.ctrl)) x.discard(h);
      x.draw(x.ctrl, 2);
    },
  };

  A['he-hurled-his-thunderbolt'] = {
    action(x) {
      const t = x.chooseOne(x.characters(), 'He Hurled His Thunderbolt: choose a character to deal 4 damage to.');
      if (t) x.damage(t, 4);
      // CR 6.4.2.2: applies to the Deity characters in play now.
      for (const c of x.characters(x.ctrl)) if (x.hasClass(c, 'Deity')) x.buff(c, { kw: { Challenger: 2 } }, x.until.eot(), 'gains Challenger +2 this turn');
    },
  };

  A['the-terror-that-flaps-in-the-night'] = {
    action(x) {
      const n = x.hasNamed(x.ctrl, 'Darkwing Duck') ? 3 : 2;
      const t = x.chooseOne(x.characters(x.opp), `The Terror That Flaps in the Night: choose an opposing character to deal ${n} damage to.`);
      if (t) x.damage(t, n);
    },
  };

  A['lexington-small-in-stature'] = { auras: [H.stoneByDay] };

  A['benja-guardian-of-the-dragon-gem'] = {
    triggers: [{
      name: 'WE HAVE A CHOICE', on: 'played', when: H.self,
      run(x) {
        const t = x.chooseOne(x.items(), 'We Have a Choice: you may banish a chosen item.', { optional: true });
        if (t) x.banish(t);
      },
    }],
  };

  A['lilo-best-explorer-ever'] = {
    triggers: [
      {
        name: "COME ON, PEOPLE, LET'S MOVE", on: 'played', when: H.self,
        run(x) {
          for (const c of x.characters(x.ctrl)) if (c !== x.me) x.buff(c, { kw: { Challenger: 2 } }, x.until.eot(), 'gains Challenger +2 this turn');
        },
      },
      {
        name: "GO GET 'EM", on: 'quest', when: H.self,
        run(x) {
          const t = x.chooseOne(x.characters().filter((i) => x.hasClass(i, 'Alien')), "Go Get 'Em: choose an Alien character to gain Challenger +2 and \"This character can challenge ready characters\" this turn.");
          if (t) x.buff(t, { kw: { Challenger: 2 }, flags: { canChallengeReady: true } }, x.until.eot(), 'gains Challenger +2 and can challenge ready characters this turn');
        },
      },
    ],
  };

  A['jasmine-fearless-princess'] = {
    // TAKE THE LEAP: "During your turn, this character gains Evasive."
    auras: [(s, me, t, r) => { if (t === me && s.active === s.cards[me].owner && r.kw.Evasive === undefined) r.kw.Evasive = true; }],
    activated: [{
      name: "NOW'S MY CHANCE", cost: { discard: 1 }, text: 'This character gains Challenger +3 this turn.',
      run(x) { x.buff(x.me, { kw: { Challenger: 3 } }, x.until.eot(), 'gains Challenger +3 this turn'); },
    }],
  };

  A['violet-parr-super-resilient'] = {
    triggers: [{
      name: 'HEROIC SYNERGY', on: 'played',
      when: (s, me, ev) => ev.p === s.cards[me].owner && ev.kind === 'character' && LC.chars(s, ev.iid).classifications.includes('Hero'),
      run(x) {
        if (!x.may('Heroic Synergy: draw a card, then choose and discard a card?', 'Draw, then discard', 'No')) return;
        x.draw(x.ctrl, 1);
        x.chooseDiscard(x.ctrl, 1, 'Heroic Synergy: choose a card to discard.');
      },
    }],
  };

  A['i-find-em-i-flatten-em'] = {
    action(x) { x.banishAll(x.items()); },
  };
})();
