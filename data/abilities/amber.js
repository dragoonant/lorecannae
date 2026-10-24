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
})();
