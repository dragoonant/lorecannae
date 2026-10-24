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

// Regressions from the engine review (scratch/engine-review.md, 2026-10-24).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;
  test('CR 8.10.7 a shifted character returned to hand takes its whole stack to hand (put-that-thing-back)', () => {
    let s = T.game({ p0: { hand: ['put-that-thing-back'], ink: 4 }, p1: { play: ['stitch-carefree-surfer'], hand: ['stitch-rock-star'], ink: 4 } });
    // Build the shifted stack directly: Rock Star on top of Carefree Surfer.
    const base = s.players[1].play[0], top = s.players[1].hand[0];
    s = LC.clone(s);
    s.players[1].hand = []; s.players[1].play = [top];
    Object.assign(s.cards[top], { zone: 'play', under: [base], dry: true, facedown: false });
    Object.assign(s.cards[base], { zone: 'under' });
    s = T.act(s, { type: 'play', pay: 'ink' });
    s = T.answer(s, [top]);
    eq(T.zone(s, top), 'hand'); eq(T.zone(s, base), 'hand');
  });
  test('CR 8.10.5 a shifted character keeps effects on the character it was put on (strange-things)', () => {
    let s = T.game({ p0: { hand: ['luisa-madrigal-confident-climber'], ink: 3, play: ['luisa-madrigal-pushing-through'] } });
    const base = s.players[0].play[0], top = s.players[0].hand[0];
    s.cards[base].mods.push({ flags: { cantQuest: true }, end: { at: 'startOf', p: 1 } });
    s = T.act(s, { type: 'play', iid: top, pay: 'shift', onto: base });
    ok(!T.legal(s, { type: 'quest', iid: top }), "the can't-quest effect stays on the shifted character");
  });
  test('CR 7.4.3 cards banished together leave play together (raging-storm)', () => {
    let s = T.game({ p0: { hand: ['raging-storm'], ink: 8, play: ['mickey-mouse-snowboard-ace'] }, p1: { play: ['darkwing-duck-crime-fighter'], hand: ['darkwing-duck-crime-fighter'] } });
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.players[0].play.length + s.players[1].play.length, 0);
    ok(s.ask && s.ask.who === 1, 'Slippery Slope (leaves play) makes the opponent discard');
  });
})();
