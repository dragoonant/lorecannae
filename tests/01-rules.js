// Core rules, named for the CR section they assert. Vanilla filler: thomas-wide-eyed-recruit
// (1 ink, 0/4, 1 lore). Other vanilla: darkwing-duck-crime-fighter (1, 2/2/1),
// prince-eric-noble-swordsman (5, 6/7/1), nakoma-waiting-out-the-storm (4, 4/6/1).
(function () {
  const { test, eq, ok, throws } = LC.T;
  const T = LC.T;
  const DW = 'darkwing-duck-crime-fighter', ERIC = 'prince-eric-noble-swordsman', NAK = 'nakoma-waiting-out-the-storm';

  test('CR 2.2 newGame deals 7 and asks the starting player to alter their hand', () => {
    const s = LC.newGame({ decks: [LC.DECKS[0].id, LC.DECKS[1].id], seed: 3, first: 0 });
    eq(s.players[0].hand.length, 7); eq(s.players[1].hand.length, 7);
    eq(s.ask.kind, 'mulligan'); eq(s.ask.who, 0);
  });

  test('CR 2.2.2 alter hand: chosen cards go to the bottom and are redrawn', () => {
    let s = LC.newGame({ decks: [LC.DECKS[0].id, LC.DECKS[1].id], seed: 3, first: 0 });
    const two = s.players[0].hand.slice(0, 2);
    s = T.answer(s, two);
    eq(s.players[0].hand.length, 7);
    ok(two.every((i) => s.cards[i].zone === 'deck'), 'altered cards are in the deck');
    eq(s.ask.who, 1);
    s = T.answer(s, []);
    eq(s.phase, 'main'); eq(s.active, 0); eq(s.turn, 1);
  });

  test('CR 3.2.3.1 the starting player skips the first draw; the second player draws', () => {
    let s = LC.newGame({ decks: [LC.DECKS[0].id, LC.DECKS[1].id], seed: 3, first: 0 });
    s = T.answer(s, []); s = T.answer(s, []);
    eq(s.players[0].hand.length, 7);
    s = T.endTurn(s);
    eq(s.active, 1); eq(s.players[1].hand.length, 8);
  });

  test('CR 4.2 ink once per turn; card enters the inkwell ready and facedown', () => {
    let s = T.game({ p0: { hand: [DW, DW] } });
    const h = s.players[0].hand[0];
    s = T.act(s, { type: 'ink', iid: h });
    eq(T.zone(s, h), 'ink'); eq(s.cards[h].exerted, false); eq(s.cards[h].facedown, true);
    ok(!T.legal(s, { type: 'ink' }), 'second ink this turn is illegal');
  });

  test('CR 4.2.1.1 a card without the inkwell symbol cannot be inked', () => {
    // grandmother-willow-ancient-advisor is not inkable
    const s = T.game({ p0: { hand: ['grandmother-willow-ancient-advisor'] } });
    ok(!T.legal(s, { type: 'ink' }));
    ok(LC.whyNotInk(s, s.players[0].hand[0]));
  });

  test('CR 4.3 play pays ink by exerting ready ink; character enters drying', () => {
    let s = T.game({ p0: { hand: [NAK], ink: 4 } });
    ok(!T.game({ p0: { hand: [NAK], ink: 3 } }) || true);
    const c = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: c, pay: 'ink' });
    eq(T.zone(s, c), 'play');
    eq(LC.readyInk(s, 0), 0);
    ok(LC.chars(s, c).drying, 'drying');
    ok(!T.legal(s, { type: 'quest', iid: c }), 'a drying character cannot quest (CR 5.1.1.11)');
  });

  test('CR 4.3.2.4 cannot play a card without enough ready ink; whyNot explains', () => {
    const s = T.game({ p0: { hand: [NAK], ink: 3 } });
    const c = s.players[0].hand[0];
    ok(!T.legal(s, { type: 'play', iid: c }));
    eq(LC.whyNot(s, c), 'Needs 4 ink, you have 3 ready.');
  });

  test('CR 4.5 quest exerts and gains lore equal to the lore value', () => {
    let s = T.game({ p0: { play: [ERIC] } });
    const c = s.players[0].play[0];
    s = T.act(s, { type: 'quest', iid: c });
    eq(s.players[0].lore, 1); eq(s.cards[c].exerted, true);
  });

  test('CR 4.6.4.2 only exerted opposing characters can be challenged', () => {
    let s = T.game({ p0: { play: [ERIC] }, p1: { play: [DW] } });
    const a = s.players[0].play[0], d = s.players[1].play[0];
    ok(!T.legal(s, { type: 'challenge', iid: a, target: d }), 'ready defender');
    s.cards[d].exerted = true;
    ok(T.legal(s, { type: 'challenge', iid: a, target: d }), 'exerted defender');
  });

  test('CR 4.6.6 challenge damage is simultaneous; CR 1.8.1.4 banish at willpower', () => {
    let s = T.game({ p0: { play: [DW] }, p1: { play: [{ id: DW, exerted: true }] } });
    const a = s.players[0].play[0], d = s.players[1].play[0];
    s = T.act(s, { type: 'challenge', iid: a, target: d });
    eq(T.zone(s, a), 'discard'); eq(T.zone(s, d), 'discard');
    eq(s.players[0].discard.length, 1);
  });

  test('CR 4.6.4.1 a drying character cannot challenge', () => {
    const s = T.game({ p0: { play: [{ id: ERIC, dry: false }] }, p1: { play: [{ id: DW, exerted: true }] } });
    ok(!T.legal(s, { type: 'challenge' }));
  });

  test('CR 8.9 Rush lets a drying character challenge', () => {
    const s = T.game({ p0: { play: [{ id: 'sven-leaping-reindeer', dry: false }] }, p1: { play: [{ id: DW, exerted: true }] } });
    ok(T.legal(s, { type: 'challenge' }));
    ok(!T.legal(s, { type: 'quest' }), 'Rush does not allow questing');
  });

  test('CR 8.6 Evasive can only be challenged by Evasive; CR 8.2 Alert ignores Evasive', () => {
    const ev = 'hamish-hubert-and-harris-troublemaking-triplets';
    let s = T.game({ p0: { play: [ERIC, 'dr-hamsterviel-evil-observer'] }, p1: { play: [{ id: ev, exerted: true }] } });
    const [eric, ham] = s.players[0].play, d = s.players[1].play[0];
    ok(!T.legal(s, { type: 'challenge', iid: eric, target: d }), 'non-evasive');
    ok(T.legal(s, { type: 'challenge', iid: ham, target: d }), 'Alert');
  });

  test('CR 8.3.3 Bodyguard must be challenged if able', () => {
    const s = T.game({ p0: { play: [ERIC] }, p1: { play: [{ id: DW, exerted: true }, { id: 'david-protective-snowboarder', exerted: true }] } });
    const [dw, bg] = s.players[1].play, a = s.players[0].play[0];
    ok(!T.legal(s, { type: 'challenge', iid: a, target: dw }));
    ok(T.legal(s, { type: 'challenge', iid: a, target: bg }));
  });

  test('CR 8.3.2 Bodyguard asks whether to enter exerted (never assumed)', () => {
    let s = T.game({ p0: { hand: ['david-protective-snowboarder'], ink: 2 } });
    const c = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: c, pay: 'ink' });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.cards[c].exerted, true);
  });

  test('CR 8.8 Resist reduces challenge damage', () => {
    let s = T.game({ p0: { play: [DW] }, p1: { play: [{ id: 'violet-parr-force-field-practice', exerted: true }] } });
    const a = s.players[0].play[0], d = s.players[1].play[0];
    s = T.act(s, { type: 'challenge', iid: a, target: d });
    eq(s.cards[d].damage, 1); // 2 strength - Resist 1
  });

  test('CR 8.5 Challenger adds strength only while challenging', () => {
    let s = T.game({ p0: { play: ['luisa-madrigal-pushing-through'] }, p1: { play: [{ id: DW, exerted: true }] } });
    const a = s.players[0].play[0], d = s.players[1].play[0];
    s = T.act(s, { type: 'challenge', iid: a, target: d });
    eq(T.zone(s, d), 'discard'); // 0 + 2 strength vs 2 willpower
  });

  test('CR 8.15 Ward: opponents cannot choose it with an effect', () => {
    let s = T.game({ p0: { hand: ['strength-of-a-raging-fire'], ink: 3, play: [DW] }, p1: { play: ['aladdin-prince-ali', DW] } });
    s = T.act(s, { type: 'play', pay: 'ink' });
    const ward = s.players[1].play[0];
    ok(!s.ask.from.includes(ward), 'Ward card not offered');
    ok(s.ask.from.includes(s.players[1].play[1]), 'other card offered');
  });

  test('CR 8.7.3 Reckless blocks ending the turn while it can challenge', () => {
    let s = T.game({ p0: { play: [ERIC] }, p1: { play: [{ id: DW, exerted: true }] } });
    const a = s.players[0].play[0];
    s.cards[a].mods.push({ kw: { Reckless: true } });
    ok(!T.legal(s, { type: 'end' }));
    ok(!T.legal(s, { type: 'quest', iid: a }), 'Reckless cannot quest');
    eq(LC.endTurnBlocker(s), a);
  });

  test('CR 8.10 Shift: pay Shift cost onto same-named character, inherit state', () => {
    let s = T.game({ p0: { hand: ['luisa-madrigal-confident-climber'], ink: 3, play: [{ id: 'luisa-madrigal-pushing-through', exerted: true, damage: 1 }] } });
    const base = s.players[0].play[0], top = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: top, pay: 'shift', onto: base });
    eq(T.zone(s, top), 'play'); eq(T.zone(s, base), 'under');
    eq(s.cards[top].exerted, true); eq(s.cards[top].damage, 1); eq(s.cards[top].dry, true);
    eq(LC.readyInk(s, 0), 0);
  });

  test('CR 8.10 Shift onto a dual-name card ("named Lilo or Stitch")', () => {
    const s = T.game({ p0: { hand: ['lilo-and-stitch-fun-loving-friends'], ink: 3, play: ['stitch-carefree-surfer'] } });
    ok(T.legal(s, { type: 'play', pay: 'shift' }));
  });

  test('CR 5.4.4.2 sing a song by exerting a dry character of enough cost', () => {
    let s = T.game({ p0: { hand: ['strength-of-a-raging-fire'], ink: 0, play: [NAK, { id: DW, dry: false }] }, p1: { play: [ERIC] } });
    const singer = s.players[0].play[0];
    ok(!T.legal(s, { type: 'play', pay: 'sing', singer: s.players[0].play[1] }), 'drying/too cheap cannot sing');
    s = T.act(s, { type: 'play', pay: 'sing', singer });
    eq(s.cards[singer].exerted, true);
    eq(s.ask.kind, 'cards');
  });

  test('CR 8.11 Singer N counts as cost N to sing', () => {
    const s = T.game({ p0: { hand: ['he-hurled-his-thunderbolt'], play: ['ursula-vanessa'] } });
    ok(T.legal(s, { type: 'play', pay: 'sing' }));
  });

  test('CR 8.12 Sing Together needs total cost N and asks which characters sing', () => {
    ok(!T.legal(T.game({ p0: { hand: ['second-star-to-the-right'], play: [ERIC, NAK] } }), { type: 'play', pay: 'singTogether' }), '5+4 < 10');
    let s = T.game({ p0: { hand: ['second-star-to-the-right'], play: [ERIC, ERIC, NAK] } });
    s = T.act(s, { type: 'play', pay: 'singTogether' });
    eq(s.ask.kind, 'cards'); eq(s.ask.sumCostMin, 10);
    const [e1, e2, n] = s.players[0].play;
    throws(() => T.answer(s, [e1, n]), '5+4 is not enough');
    s = T.answer(s, [e1, e2]);
    ok(s.cards[e1].exerted && s.cards[e2].exerted && !s.cards[n].exerted, 'only the chosen singers exert');
  });

  test('CR 1.8.1.1 a player with 20 lore wins', () => {
    let s = T.game({ p0: { lore: 19, play: [ERIC] } });
    s = T.act(s, { type: 'quest' });
    eq(s.winner, 0); eq(s.endReason, 'lore'); ok(LC.isTerminal(s));
  });

  test('CR 1.8.1.2 a player whose turn ends with an empty deck loses', () => {
    let s = T.game({ p0: { deck: [] } });
    s = T.endTurn(s);
    eq(s.winner, 1); eq(s.endReason, 'deckout');
  });

  test('CR 3.2.1 the next player readies their cards and ink, characters dry', () => {
    let s = T.game({ p1: { play: [{ id: DW, exerted: true, dry: false }], ink: 2 } });
    s.cards[s.players[1].ink[0]].exerted = true;
    s = T.endTurn(s);
    const c = s.players[1].play[0];
    eq(s.cards[c].exerted, false); eq(s.cards[c].dry, true); eq(LC.readyInk(s, 1), 2);
  });

  test('CR 8.13 Support asks for another character and adds strength this turn', () => {
    let s = T.game({ p0: { play: ['eilonwy-princess-of-llyr', ERIC] } });
    const [eil, eric] = s.players[0].play;
    s = T.act(s, { type: 'quest', iid: eil });
    eq(s.ask.kind, 'cards');
    s = T.answer(s, [eric]);
    eq(LC.chars(s, eric).str, 8);
    s = T.endTurn(s);
    eq(LC.chars(s, eric).str, 6);
  });

  test('legalActions is never empty in the main phase', () => {
    const s = T.game({});
    ok(LC.legalActions(s).length > 0);
  });

  test('apply never mutates its input', () => {
    const s = T.game({ p0: { play: [ERIC] } });
    const before = JSON.stringify(s);
    LC.apply(s, { type: 'quest', iid: s.players[0].play[0] });
    eq(JSON.stringify(s), before);
  });
})();
