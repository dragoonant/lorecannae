// Behaviour tests for steel cards (one per card, asserting side effects).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;
  const TH = 'thomas-wide-eyed-recruit', DW = 'darkwing-duck-crime-fighter', ERIC = 'prince-eric-noble-swordsman', NAK = 'nakoma-waiting-out-the-storm';
  const play = (s, id, p = 0) => T.act(s, { type: 'play', iid: T.find(s, p, id, 'hand'), pay: 'ink' });

  // STONE BY DAY: with 3+ cards in hand the Gargoyle stays exerted through its ready step;
  // with 2 it readies; Angela - Night Warrior's ETERNAL NIGHT removes it.
  function stoneByDay(id) {
    let s = T.game({ p1: { play: [{ id, exerted: true }], hand: [TH, TH, TH] } });
    const g = s.players[1].play[0];
    s = T.endTurn(s);
    eq(s.active, 1); eq(s.cards[g].exerted, true, "3 cards in hand: can't ready");
    s = T.game({ p1: { play: [{ id, exerted: true }], hand: [TH, TH] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].play[0]].exerted, false, '2 cards in hand: readies');
    s = T.game({ p1: { play: [{ id, exerted: true }, 'angela-night-warrior'], hand: [TH, TH, TH] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].play[0]].exerted, false, 'Angela - Night Warrior removes Stone by Day');
    s = T.game({ p0: { play: ['angela-night-warrior'] }, p1: { play: [{ id, exerted: true }], hand: [TH, TH, TH] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].play[0]].exerted, true, "an opponent's Angela does not help");
  }

  test('launchpad-trusty-sidekick: draw, then discard unless you have Darkwing Duck', () => {
    let s = T.game({ p0: { play: ['launchpad-trusty-sidekick'], hand: [NAK] } });
    s = T.act(s, { type: 'activate', iid: s.players[0].play[0], idx: 0 });
    eq(s.ask.kind, 'cards'); eq(s.ask.from.length, 2);
    s = T.answer(s, [s.ask.from[0]]);
    eq(s.players[0].hand.length, 1); eq(s.players[0].discard.length, 1);
    s = T.game({ p0: { play: ['launchpad-trusty-sidekick', DW], hand: [NAK] } });
    s = T.act(s, { type: 'activate', iid: s.players[0].play[0], idx: 0 });
    eq(s.ask, null); eq(s.players[0].hand.length, 2); eq(s.players[0].discard.length, 0);
  });

  test('angela-night-warrior: may give chosen character Challenger +2 and Resist +2 until your next turn; Eternal Night', () => {
    let s = T.game({ p0: { hand: ['angela-night-warrior'], ink: 3, play: [TH] } });
    const th = s.players[0].play[0];
    s = play(s, 'angela-night-warrior');
    eq(s.ask.min, 0);
    s = T.answer(s, [th]);
    eq(LC.chars(s, th).kw.Challenger, 2); eq(LC.chars(s, th).kw.Resist, 2);
    s = T.endTurn(s);
    eq(LC.chars(s, th).kw.Resist, 2, "lasts through the opponent's turn");
    s = T.endTurn(s);
    eq(LC.chars(s, th).kw.Resist, undefined, 'ends at the start of your next turn');
    stoneByDay('lexington-small-in-stature');
  });

  test('darkwing-duck-shadowy-superhero: may deal 1 damage to chosen character', () => {
    let s = T.game({ p0: { hand: ['darkwing-duck-shadowy-superhero'], ink: 3 }, p1: { play: [NAK] } });
    const nak = s.players[1].play[0];
    s = play(s, 'darkwing-duck-shadowy-superhero');
    eq(s.ask.min, 0);
    s = T.answer(s, [nak]);
    eq(s.cards[nak].damage, 1);
  });

  test('angel-experiment-624: Resist +2 with an empty hand; Good Aim once per turn discards to deal 2', () => {
    let s = T.game({ p0: { play: ['angel-experiment-624'], hand: [TH, TH] }, p1: { play: [NAK] } });
    const angel = s.players[0].play[0], nak = s.players[1].play[0];
    eq(LC.chars(s, angel).kw.Resist, undefined);
    s = T.act(s, { type: 'activate', iid: angel, idx: 0 });
    eq(s.ask.kind, 'cards'); // discard cost
    s = T.answer(s, [s.players[0].hand[0]]);
    s = T.answer(s, [nak]);
    eq(s.cards[nak].damage, 2); eq(s.players[0].hand.length, 1); eq(s.players[0].discard.length, 1);
    ok(!T.legal(s, { type: 'activate', iid: angel }), 'once during your turn');
    s = T.game({ p0: { play: ['angel-experiment-624'] } });
    eq(LC.chars(s, s.players[0].play[0]).kw.Resist, 2);
  });

  test('broadway-sturdy-and-strong: Bodyguard asks; Stone by Day', () => {
    let s = T.game({ p0: { hand: ['broadway-sturdy-and-strong'], ink: 5 } });
    s = play(s, 'broadway-sturdy-and-strong');
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.cards[T.find(s, 0, 'broadway-sturdy-and-strong')].exerted, true);
    stoneByDay('broadway-sturdy-and-strong');
  });

  test('you-broke-my-smolder: discard your hand, draw 2', () => {
    let s = T.game({ p0: { hand: ['you-broke-my-smolder', NAK, ERIC, DW], ink: 1 } });
    s = play(s, 'you-broke-my-smolder');
    eq(s.players[0].hand.length, 2); eq(s.players[0].discard.length, 4);
    ok(s.players[0].hand.every((i) => s.cards[i].id === TH), 'the 2 drawn cards');
  });

  test('strength-of-a-raging-fire: damage equal to your characters in play', () => {
    let s = T.game({ p0: { hand: ['strength-of-a-raging-fire'], ink: 3, play: [TH, TH] }, p1: { play: [NAK] } });
    const nak = s.players[1].play[0];
    s = play(s, 'strength-of-a-raging-fire');
    s = T.answer(s, [nak]);
    eq(s.cards[nak].damage, 2);
  });

  test('he-hurled-his-thunderbolt: 4 damage; your Deity characters gain Challenger +2 this turn', () => {
    let s = T.game({ p0: { hand: ['he-hurled-his-thunderbolt'], ink: 4, play: ['hades-looking-for-a-deal', TH] }, p1: { play: [NAK] } });
    const [hades, th] = s.players[0].play, nak = s.players[1].play[0];
    s = play(s, 'he-hurled-his-thunderbolt');
    s = T.answer(s, [nak]);
    eq(s.cards[nak].damage, 4);
    eq(LC.chars(s, hades).kw.Challenger, 2); eq(LC.chars(s, th).kw.Challenger, undefined);
    s = T.endTurn(s);
    eq(LC.chars(s, hades).kw.Challenger, undefined);
  });

  test('the-terror-that-flaps-in-the-night: 2 damage, 3 with Darkwing Duck (single candidate asks)', () => {
    let s = T.game({ p0: { hand: ['the-terror-that-flaps-in-the-night'], ink: 2 }, p1: { play: [NAK] } });
    const nak = s.players[1].play[0];
    s = play(s, 'the-terror-that-flaps-in-the-night');
    eq(s.ask.from, [nak]);
    eq(T.answer(s, [nak]).cards[nak].damage, 2);
    s = T.game({ p0: { hand: ['the-terror-that-flaps-in-the-night'], ink: 2, play: [DW] }, p1: { play: [NAK] } });
    const nak2 = s.players[1].play[0];
    s = play(s, 'the-terror-that-flaps-in-the-night');
    eq(T.answer(s, [nak2]).cards[nak2].damage, 3);
  });

  test('lexington-small-in-stature: Stone by Day', () => { stoneByDay('lexington-small-in-stature'); });

  test('benja-guardian-of-the-dragon-gem: may banish chosen item', () => {
    let s = T.game({ p0: { hand: ['benja-guardian-of-the-dragon-gem'], ink: 3 }, p1: { play: ['junior-woodchuck-guidebook', NAK] } });
    const book = s.players[1].play[0];
    s = play(s, 'benja-guardian-of-the-dragon-gem');
    eq(s.ask.from, [book]); eq(s.ask.min, 0);
    s = T.answer(s, [book]);
    eq(T.zone(s, book), 'discard');
  });

  test('lilo-best-explorer-ever: others gain Challenger +2; questing gives an Alien Challenger +2 and challenge-ready', () => {
    let s = T.game({ p0: { hand: ['lilo-best-explorer-ever'], ink: 3, play: [TH] } });
    const th = s.players[0].play[0];
    s = play(s, 'lilo-best-explorer-ever');
    eq(LC.chars(s, th).kw.Challenger, 2);
    eq(LC.chars(s, T.find(s, 0, 'lilo-best-explorer-ever')).kw.Challenger, undefined, 'not Lilo herself');
    s = T.game({ p0: { play: ['lilo-best-explorer-ever', 'angel-experiment-624'] }, p1: { play: [DW] } });
    const [lilo, angel] = s.players[0].play, dw = s.players[1].play[0];
    ok(!T.legal(s, { type: 'challenge', iid: angel, target: dw }));
    s = T.act(s, { type: 'quest', iid: lilo });
    eq(s.ask.from, [angel]);
    s = T.answer(s, [angel]);
    eq(LC.chars(s, angel).kw.Challenger, 2);
    s = T.act(s, { type: 'challenge', iid: angel, target: dw });
    eq(T.zone(s, dw), 'discard', 'challenged a ready character');
  });

  test('jasmine-fearless-princess: Evasive during your turn; discard for Challenger +3', () => {
    let s = T.game({ p0: { play: ['jasmine-fearless-princess'], hand: [TH] } });
    const j = s.players[0].play[0];
    ok(LC.chars(s, j).kw.Evasive, 'your turn');
    s = T.act(s, { type: 'activate', iid: j, idx: 0 });
    s = T.answer(s, [s.players[0].hand[0]]);
    eq(LC.chars(s, j).kw.Challenger, 3); eq(s.players[0].hand.length, 0);
    s = T.endTurn(s);
    ok(!LC.chars(s, j).kw.Evasive, "not during the opponent's turn");
    eq(LC.chars(s, j).kw.Challenger, undefined);
  });

  test('tinker-bell-giant-fairy: 1 damage to each opposing character; Puny Pirate! after a challenge banish', () => {
    let s = T.game({ p0: { hand: ['tinker-bell-giant-fairy'], ink: 6 }, p1: { play: [NAK, ERIC] } });
    s = play(s, 'tinker-bell-giant-fairy');
    ok(s.players[1].play.every((i) => s.cards[i].damage === 1));
    s = T.game({ p0: { play: ['tinker-bell-giant-fairy'] }, p1: { play: [{ id: DW, exerted: true }, NAK] } });
    const [dw, nak] = s.players[1].play;
    s = T.act(s, { type: 'challenge', iid: s.players[0].play[0], target: dw });
    eq(T.zone(s, dw), 'discard');
    eq(s.ask.min, 0);
    s = T.answer(s, [nak]);
    eq(s.cards[nak].damage, 2);
  });

  test('prince-charming-protector-of-the-realm: only one character can challenge each turn', () => {
    let s = T.game({ p0: { play: [ERIC, ERIC] }, p1: { play: ['prince-charming-protector-of-the-realm', { id: TH, exerted: true }, { id: DW, exerted: true }] } });
    const [e1, e2] = s.players[0].play;
    const [, th, dw] = s.players[1].play;
    s = T.act(s, { type: 'challenge', iid: e1, target: th });
    eq(T.zone(s, th), 'discard');
    ok(!T.legal(s, { type: 'challenge', iid: e2, target: dw }), 'second challenge blocked');
  });

  test('diablo-stone-servant: +2 str +1 lore with a Villain; exerted, your Villains cannot be challenged', () => {
    let s = T.game({ p0: { play: ['diablo-stone-servant', { id: 'hades-looking-for-a-deal', exerted: true }] }, p1: { play: [ERIC] } });
    const [d, h] = s.players[0].play;
    eq(LC.chars(s, d).str, 3); eq(LC.chars(s, d).lore, 2);
    s.active = 1;
    ok(T.legal(s, { type: 'challenge', target: h }), 'Diablo ready: Hades can be challenged');
    s.cards[d].exerted = true;
    ok(!T.legal(s, { type: 'challenge', target: h }), 'Diablo exerted: Hades cannot be challenged');
  });

  test('violet-parr-super-resilient: playing a Hero lets you draw then discard', () => {
    let s = T.game({ p0: { hand: ['violet-parr-super-resilient', DW, TH], ink: 7 } });
    s = play(s, 'violet-parr-super-resilient');
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.ask.kind, 'cards'); eq(s.ask.from.length, 3);
    s = T.answer(s, [T.find(s, 0, TH, 'hand')]);
    eq(s.players[0].hand.length, 2); eq(s.players[0].discard.length, 1);
    s = play(s, DW); // another Hero
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, false);
    eq(s.players[0].hand.length, 1);
    s = play(s, TH); // not a Hero (the drawn filler)
    eq(s.ask, null);
  });

  test("i-find-em-i-flatten-em: banish all items, both players'", () => {
    let s = T.game({ p0: { hand: ['i-find-em-i-flatten-em'], ink: 4, play: ['junior-woodchuck-guidebook', TH] }, p1: { play: ['junior-woodchuck-guidebook'] } });
    s = play(s, 'i-find-em-i-flatten-em');
    eq(s.players[0].play.length, 1); eq(s.players[1].play.length, 0);
    eq(s.players[0].discard.length, 2); eq(s.players[1].discard.length, 1);
  });
})();
