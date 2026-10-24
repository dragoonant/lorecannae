// Behaviour tests for amethyst cards (one per card, asserting side effects).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;
  const TH = 'thomas-wide-eyed-recruit', DW = 'darkwing-duck-crime-fighter', ERIC = 'prince-eric-noble-swordsman', NAK = 'nakoma-waiting-out-the-storm';
  const play = (s, id, p = 0) => T.act(s, { type: 'play', iid: T.find(s, p, id, 'hand'), pay: 'ink' });

  // STONE BY DAY: with 3+ cards in hand the Gargoyle stays exerted through its ready step;
  // with 2 it readies.
  function stoneByDay(id) {
    let s = T.game({ p1: { play: [{ id, exerted: true }], hand: [TH, TH, TH] } });
    const g = s.players[1].play[0];
    s = T.endTurn(s);
    eq(s.active, 1); eq(s.cards[g].exerted, true, '3 cards in hand: can\'t ready');
    s = T.game({ p1: { play: [{ id, exerted: true }], hand: [TH, TH] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].play[0]].exerted, false, '2 cards in hand: readies');
    s = T.game({ p1: { play: [{ id, exerted: true }, 'angela-night-warrior'], hand: [TH, TH, TH] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].play[0]].exerted, false, 'Angela - Night Warrior removes Stone by Day');
  }

  test('rafiki-mystical-fighter: takes no damage challenging a Hyena, normal damage otherwise', () => {
    LC.CARDS['test-hyena'] = { ...LC.CARDS[NAK], id: 'test-hyena', classifications: ['Storyborn', 'Hyena'] };
    try {
      let s = T.game({ p0: { play: ['rafiki-mystical-fighter'] }, p1: { play: [{ id: 'test-hyena', exerted: true }] } });
      const r = s.players[0].play[0], h = s.players[1].play[0];
      s = T.act(s, { type: 'challenge', iid: r, target: h });
      eq(s.cards[r].damage, 0, 'no damage from the Hyena'); eq(T.zone(s, r), 'play');
      eq(s.cards[h].damage, 3, 'Challenger +3');
      s = T.game({ p0: { play: ['rafiki-mystical-fighter'] }, p1: { play: [{ id: NAK, exerted: true }] } });
      s = T.act(s, { type: 'challenge', iid: s.players[0].play[0], target: s.players[1].play[0] });
      eq(T.zone(s, T.find(s, 0, 'rafiki-mystical-fighter')), 'discard', 'non-Hyena deals damage');
    } finally { delete LC.CARDS['test-hyena']; }
  });

  test('cheshire-cat-inexplicable: Boost moves up to 2 damage to a chosen opposing character', () => {
    let s = T.game({ p0: { play: ['cheshire-cat-inexplicable', { id: TH, damage: 3 }], ink: 2 }, p1: { play: [NAK] } });
    const [cat, th] = s.players[0].play, nak = s.players[1].play[0];
    s = T.act(s, { type: 'boost', iid: cat });
    eq(s.cards[cat].under.length, 1);
    eq(s.ask.kind, 'cards'); eq(s.ask.min, 0);
    s = T.answer(s, [th]);
    eq(s.ask.from, [nak], 'single opposing candidate still asks');
    s = T.answer(s, [nak]);
    eq(s.ask.kind, 'mode');
    s = T.answer(s, 0); // Move 2 damage
    eq(s.cards[th].damage, 1); eq(s.cards[nak].damage, 2);
  });

  test('dumbo-the-flying-elephant: chosen character gains Evasive until the start of your next turn', () => {
    let s = T.game({ p0: { hand: ['dumbo-the-flying-elephant'], ink: 3, play: [TH] } });
    const th = s.players[0].play[0];
    s = play(s, 'dumbo-the-flying-elephant');
    s = T.answer(s, [th]);
    ok(LC.chars(s, th).kw.Evasive, 'Evasive now');
    s = T.endTurn(s);
    ok(LC.chars(s, th).kw.Evasive, "Evasive during the opponent's turn");
    s = T.endTurn(s);
    ok(!LC.chars(s, th).kw.Evasive, 'gone at the start of your next turn');
  });

  test('isis-vanderchill-ice-queen-of-st-canard: exerts the chosen opposing character (single candidate asks)', () => {
    let s = T.game({ p0: { hand: ['isis-vanderchill-ice-queen-of-st-canard'], ink: 4 }, p1: { play: [NAK] } });
    const nak = s.players[1].play[0];
    s = play(s, 'isis-vanderchill-ice-queen-of-st-canard');
    eq(s.ask.from, [nak]);
    s = T.answer(s, [nak]);
    eq(s.cards[nak].exerted, true);
  });

  test('tigger-bouncing-all-the-way: may return a cost-2-or-less card to its player\'s hand', () => {
    let s = T.game({ p0: { hand: ['tigger-bouncing-all-the-way'], ink: 4 }, p1: { play: [DW, ERIC, 'junior-woodchuck-guidebook'] } });
    const [dw, eric, book] = s.players[1].play;
    s = play(s, 'tigger-bouncing-all-the-way');
    ok(s.ask.from.includes(dw) && s.ask.from.includes(book) && !s.ask.from.includes(eric), 'cost filter');
    eq(s.ask.min, 0);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'hand'); ok(s.players[1].hand.includes(dw));
  });

  test('luisa-madrigal-confident-climber: moves 1 damage in, then all 3+ out to an opposing character', () => {
    let s = T.game({ p0: { play: [{ id: 'luisa-madrigal-confident-climber', damage: 2 }, { id: TH, damage: 1 }], ink: 1 }, p1: { play: [NAK] } });
    const [lu, th] = s.players[0].play, nak = s.players[1].play[0];
    s = T.act(s, { type: 'activate', iid: lu, idx: 0 });
    eq(LC.readyInk(s, 0), 0, 'paid 1 ink');
    s = T.answer(s, [th]);
    s = T.answer(s, true);
    eq(s.ask.from, [nak]);
    s = T.answer(s, [nak]);
    eq(s.cards[th].damage, 0); eq(s.cards[lu].damage, 0); eq(s.cards[nak].damage, 3);
  });

  test('demona-scourge-of-the-wyvern-clan: exerts all opposing characters, players draw up to 3; Stone by Day', () => {
    let s = T.game({ p0: { hand: ['demona-scourge-of-the-wyvern-clan', TH], ink: 6 }, p1: { hand: [TH], play: [NAK, DW] } });
    s = play(s, 'demona-scourge-of-the-wyvern-clan');
    ok(s.players[1].play.every((i) => s.cards[i].exerted), 'opposing characters exerted');
    eq(s.players[0].hand.length, 3); eq(s.players[1].hand.length, 3);
    s = T.game({ p0: { hand: ['demona-scourge-of-the-wyvern-clan'], ink: 6 }, p1: { hand: [TH, TH, TH, TH] } });
    s = play(s, 'demona-scourge-of-the-wyvern-clan');
    eq(s.players[1].hand.length, 4, 'a player with 3+ does not draw');
    stoneByDay('demona-scourge-of-the-wyvern-clan');
  });

  test('christopher-robin-joining-the-fun: costs 1 less on the second player\'s first turn only', () => {
    let s = T.game({ active: 1, turn: 2, first: 0, p1: { hand: ['christopher-robin-joining-the-fun'], ink: 1 } });
    ok(T.legal(s, { type: 'play', pay: 'ink' }), 'pays 1');
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(T.zone(s, T.find(s, 1, 'christopher-robin-joining-the-fun')), 'play');
    s = T.game({ active: 1, turn: 4, first: 0, p1: { hand: ['christopher-robin-joining-the-fun'], ink: 1 } });
    ok(!T.legal(s, { type: 'play', pay: 'ink' }), 'full cost later');
  });

  test('violet-parr-learning-new-powers: may move 1 damage to a chosen opposing character', () => {
    let s = T.game({ p0: { hand: ['violet-parr-learning-new-powers'], ink: 3, play: [{ id: TH, damage: 2 }] }, p1: { play: [NAK] } });
    const th = s.players[0].play[0], nak = s.players[1].play[0];
    s = play(s, 'violet-parr-learning-new-powers');
    eq(s.ask.min, 0);
    s = T.answer(s, [th]);
    s = T.answer(s, [nak]);
    eq(s.cards[th].damage, 1); eq(s.cards[nak].damage, 1);
  });

  test('hades-looking-for-a-deal: opponent bottoms the character or you draw 2', () => {
    let s = T.game({ p0: { hand: ['hades-looking-for-a-deal'], ink: 5 }, p1: { play: [NAK] } });
    const nak = s.players[1].play[0];
    s = play(s, 'hades-looking-for-a-deal');
    s = T.answer(s, [nak]);
    eq(s.ask.who, 1, 'the opponent decides');
    const s2 = T.answer(s, false);
    eq(s2.players[0].hand.length, 2); eq(T.zone(s2, nak), 'play');
    const s3 = T.answer(s, true);
    eq(s3.players[0].hand.length, 0); eq(T.zone(s3, nak), 'deck');
    eq(s3.players[1].deck[s3.players[1].deck.length - 1], nak, 'bottom of deck');
  });

  test('maleficent-and-diablo-evil-incarnate: Fools! shifts for 5 discard characters; Raven\'s Call draws on exert', () => {
    let s = T.game({ p0: { hand: ['maleficent-and-diablo-evil-incarnate'], ink: 0, play: ['diablo-stone-servant'], discard: [TH, TH, TH, TH, TH, 'junior-woodchuck-guidebook'] } });
    const base = s.players[0].play[0], md = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: md, pay: 'shiftAlt', onto: base });
    eq(s.ask.min, 5); eq(s.ask.from.length, 5, 'only character cards');
    s = T.answer(s, s.ask.from.slice());
    eq(T.zone(s, md), 'play'); eq(T.zone(s, base), 'under');
    eq(s.players[0].discard.length, 1); eq(s.players[0].deck.length, 15);
    s = T.act(s, { type: 'quest', iid: md });
    eq(s.players[0].hand.length, 1, 'drew on exert during your turn');
    ok(!T.legal(T.game({ p0: { hand: ['maleficent-and-diablo-evil-incarnate'], play: ['diablo-stone-servant'], discard: [TH, TH, TH, TH] } }), { type: 'play', pay: 'shiftAlt' }), 'needs 5');
  });

  test('elsa-exploring-the-unknown: may draw a card', () => {
    let s = T.game({ p0: { hand: ['elsa-exploring-the-unknown'], ink: 3 } });
    s = play(s, 'elsa-exploring-the-unknown');
    eq(s.ask.kind, 'yesno');
    eq(T.answer(s, true).players[0].hand.length, 1);
    eq(T.answer(s, false).players[0].hand.length, 0);
  });

  test('aladdin-and-genie-mischievous-pals: bottom N cards from hand, draw N+1', () => {
    let s = T.game({ p0: { hand: ['aladdin-and-genie-mischievous-pals', DW, NAK, ERIC], ink: 5 } });
    const [, dw, nak] = s.players[0].hand;
    s = play(s, 'aladdin-and-genie-mischievous-pals');
    eq(s.ask.min, 0); eq(s.ask.max, 3);
    s = T.answer(s, [dw, nak]);
    eq(s.players[0].hand.length, 4, '1 kept + 3 drawn');
    eq(s.players[0].deck.slice(-2), [dw, nak]);
    eq(s.players[0].deck.length, 9);
  });

  test('taran-magically-armed: up to 2 cards from chosen player\'s discard to the bottom of their deck', () => {
    let s = T.game({ p0: { hand: ['taran-magically-armed'], ink: 5 }, p1: { discard: [TH, DW, NAK] } });
    const [, dw, nak] = s.players[1].discard;
    s = play(s, 'taran-magically-armed');
    eq(s.ask.kind, 'mode');
    s = T.answer(s, 1);
    eq(s.ask.max, 2); eq(s.ask.min, 0);
    s = T.answer(s, [dw, nak]);
    eq(s.players[1].discard.length, 1); eq(s.players[1].deck.slice(-2), [dw, nak]);
  });

  test('second-star-to-the-right: chosen player draws 5', () => {
    let s = T.game({ p0: { hand: ['second-star-to-the-right'], ink: 10 } });
    s = play(s, 'second-star-to-the-right');
    s = T.answer(s, 1);
    eq(s.players[1].hand.length, 5); eq(s.players[0].hand.length, 0);
  });

  test('demona-betrayer-of-the-clan: Stone by Day', () => { stoneByDay('demona-betrayer-of-the-clan'); });

  test('ursula-whisper-of-vanessa: with a card under her, +1 lore and Evasive', () => {
    let s = T.game({ p0: { play: ['ursula-whisper-of-vanessa'], ink: 1 } });
    const u = s.players[0].play[0];
    ok(!LC.chars(s, u).kw.Evasive); eq(LC.chars(s, u).lore, 2);
    s = T.act(s, { type: 'boost', iid: u });
    ok(LC.chars(s, u).kw.Evasive); eq(LC.chars(s, u).lore, 3);
    s = T.act(s, { type: 'quest', iid: u });
    eq(s.players[0].lore, 3);
  });

  test('elsa-spirit-of-winter: exerts up to 2 chosen characters; they skip their next ready', () => {
    let s = T.game({ p0: { hand: ['elsa-spirit-of-winter'], ink: 8, play: [TH] }, p1: { play: [NAK] } });
    const th = s.players[0].play[0], nak = s.players[1].play[0];
    s = play(s, 'elsa-spirit-of-winter');
    eq(s.ask.min, 0); eq(s.ask.max, 2);
    s = T.answer(s, [th, nak]);
    ok(s.cards[th].exerted && s.cards[nak].exerted, 'both exerted');
    s = T.endTurn(s);
    eq(s.cards[nak].exerted, true, 'opponent character did not ready');
    s = T.endTurn(s);
    eq(s.cards[th].exerted, true, 'own character did not ready at its next turn');
    s = T.endTurn(s);
    eq(s.cards[nak].exerted, false, 'readies the turn after');
  });

  test('camilo-madrigal-prankster: at turn start choose +1 lore or Challenger +2', () => {
    let s = T.game({ p1: { play: ['camilo-madrigal-prankster'] } });
    const c = s.players[1].play[0];
    s = T.endTurn(s);
    eq(s.ask.kind, 'mode'); eq(s.ask.who, 1);
    let a = T.answer(s, 0);
    a = T.act(a, { type: 'quest', iid: c });
    eq(a.players[1].lore, 2);
    const b = T.answer(s, 1);
    eq(LC.chars(b, c).kw.Challenger, 2);
  });

  test('mrs-incredible-super-stretchy: at turn start may gain Evasive or +1 lore', () => {
    let s = T.game({ p1: { play: ['mrs-incredible-super-stretchy'] } });
    const c = s.players[1].play[0];
    s = T.endTurn(s);
    eq(s.ask.who, 1);
    const a = T.answer(s, 0);
    ok(LC.chars(a, c).kw.Evasive);
    const b = T.act(T.answer(s, 1), { type: 'quest', iid: c });
    eq(b.players[1].lore, 2);
    const n = T.answer(s, 2);
    ok(!LC.chars(n, c).kw.Evasive); eq(LC.chars(n, c).lore, 1);
  });

  test('junior-woodchuck-guidebook: exert, 1 ink, banish it to draw 2', () => {
    let s = T.game({ p0: { play: ['junior-woodchuck-guidebook'], ink: 1 } });
    const b = s.players[0].play[0];
    s = T.act(s, { type: 'activate', iid: b, idx: 0 });
    eq(s.players[0].hand.length, 2); eq(T.zone(s, b), 'discard'); eq(LC.readyInk(s, 0), 0);
  });

  test('dumbo-ninth-wonder-of-the-universe: your other Evasive characters gain Breaking Records', () => {
    let s = T.game({ p0: { play: ['dumbo-ninth-wonder-of-the-universe', 'dumbo-the-flying-elephant', TH], ink: 1 } });
    const [, fly, th] = s.players[0].play;
    eq(LC.chars(s, th).activated.length, 0, 'non-Evasive gets nothing');
    const idx = LC.chars(s, fly).activated.findIndex((a) => a.name === 'BREAKING RECORDS');
    ok(idx >= 0);
    s = T.act(s, { type: 'activate', iid: fly, idx });
    eq(s.players[0].hand.length, 1); eq(s.players[0].lore, 1); eq(s.cards[fly].exerted, true);
  });
})();
