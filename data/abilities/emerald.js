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
    triggers: [{
      name: 'COORDINATED EFFORTS', on: 'turnEnd', when: (s, me, ev) => H.mine(s, me, ev) && threeExerted(s, s.cards[me].owner),
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
})();
