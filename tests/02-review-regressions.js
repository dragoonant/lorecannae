// Regressions from the independent card review (scratch/card-review.md, 2026-10-24).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;

  test('CR 1.8.1 banish credit: later non-challenge damage does not credit the earlier challenger (tinker-bell-giant-fairy)', () => {
    // Tinker Bell (4 str) challenges Nakoma (6 wp): Nakoma survives with 4 damage.
    let s = T.game({ p0: { play: ['tinker-bell-giant-fairy'], hand: ['piercing-attack'], ink: 2 }, p1: { play: [{ id: 'nakoma-waiting-out-the-storm', exerted: true }, 'darkwing-duck-crime-fighter'] } });
    const tb = s.players[0].play[0], nak = s.players[1].play[0];
    s = T.act(s, { type: 'challenge', iid: tb, target: nak });
    eq(s.cards[nak].damage, 4);
    // Piercing Attack deals 2: Nakoma is banished by an action, not in a challenge.
    s = T.act(s, { type: 'play', pay: 'ink' });
    s = T.answer(s, [nak]);
    eq(T.zone(s, nak), 'discard');
    ok(!s.ask, 'Puny Pirate! must not trigger (it would ask to damage the other character)');
    ok(!s.log.some((e) => e.type === 'ability' && e.name === 'PUNY PIRATE!'), 'no Puny Pirate! in the log');
  });

  test('CR 6.2.4 "At the end of your turn, if ..." checks the condition on resolution (lyle-tiberius-rourke)', () => {
    // One card already discarded this turn; Safety Rope's PACK IT UP banish (end of turn) is the second.
    let s = T.game({ p0: { play: ['lyle-tiberius-rourke-adventurer-for-hire', 'safety-rope'] }, p1: { lore: 3 } });
    s.ti.toDiscard[0] = 1;
    s = T.endTurn(s);
    eq(s.ask && s.ask.kind, 'bag', 'two end-of-turn triggers: the player orders them');
    const rope = s.ask.options.find((o) => o.name === 'PACK IT UP');
    s = T.answer(s, rope.id);
    if (s.ask && s.ask.kind === 'yesno') s = T.answer(s, true); // banish Safety Rope to draw
    eq(s.players[1].lore, 2, 'Dirty Tricks resolves after the rope reached the discard');
  });
})();
