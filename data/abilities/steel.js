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
})();
