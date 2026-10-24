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
})();
