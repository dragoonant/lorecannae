// Behaviour tests for emerald cards (one per card, asserting side effects).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;
  const DW = 'darkwing-duck-crime-fighter', ERIC = 'prince-eric-noble-swordsman', NAK = 'nakoma-waiting-out-the-storm', F = T.FILLER;
  const STRIKE = 'strike-a-good-match', PIERCE = 'piercing-attack', RAM = 'battering-ram', MAP = 'inscrutable-map', BOOK = 'my-adventure-book';
  const play = (s, id, p = 0) => T.act(s, { type: 'play', iid: T.find(s, p, id, 'hand'), pay: 'ink' });
  const activate = (s, id, idx = 0) => T.act(s, { type: 'activate', iid: T.find(s, 0, id, 'play'), idx });
  const P = (s, p) => s.players[p];

  test('tod-clever-fox: draw 2 then choose and discard 1', () => {
    let s = T.game({ p0: { hand: ['tod-clever-fox'], ink: 3 } });
    s = play(s, 'tod-clever-fox');
    eq(P(s, 0).hand.length, 2); eq(s.ask.kind, 'cards'); eq(s.ask.min, 1);
    s = T.answer(s, [P(s, 0).hand[0]]);
    eq(P(s, 0).hand.length, 1); eq(P(s, 0).discard.length, 1);
  });

  test('flynn-rider-spectral-scoundrel: +2 str and +1 lore while a card is under it', () => {
    let s = T.game({ p0: { play: ['flynn-rider-spectral-scoundrel'], ink: 2 } });
    const f = P(s, 0).play[0];
    eq(LC.chars(s, f).str, 1); eq(LC.chars(s, f).lore, 1);
    s = T.act(s, { type: 'boost', iid: f });
    eq(s.cards[f].under.length, 1); eq(LC.chars(s, f).str, 3); eq(LC.chars(s, f).lore, 2); eq(LC.readyInk(s, 0), 0);
  });

  test('white-rabbit-late-again: costs 1 less on the second player\'s first turn only', () => {
    const s = T.game({ active: 1, turn: 2, p1: { hand: ['white-rabbit-late-again'], ink: 1 } });
    ok(T.legal(s, { type: 'play', pay: 'ink' }), 'turn 2, second player: 1 ink');
    const s2 = T.game({ active: 1, turn: 4, p1: { hand: ['white-rabbit-late-again'], ink: 1 } });
    ok(!T.legal(s2, { type: 'play', pay: 'ink' }), 'later turn: full cost');
  });

  test('elinor-renowned-diplomat: end of turn with 3 exerted: 1 damage (single target still asks), 1 lore, draw', () => {
    let s = T.game({ p0: { play: ['elinor-renowned-diplomat', { id: F, exerted: true }, { id: F, exerted: true }, { id: F, exerted: true }] }, p1: { play: [DW] } });
    const dw = P(s, 1).play[0];
    s = T.endTurn(s);
    eq(s.ask.kind, 'cards'); eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(s.cards[dw].damage, 1); eq(P(s, 0).lore, 1); eq(P(s, 0).hand.length, 1);
    // Only 2 exerted: nothing.
    let s2 = T.game({ p0: { play: ['elinor-renowned-diplomat', { id: F, exerted: true }, { id: F, exerted: true }] }, p1: { play: [DW] } });
    s2 = T.endTurn(s2);
    eq(s2.ask, null); eq(P(s2, 0).lore, 0);
  });

  test('john-silver-alien-pirate: chosen opposing character has Reckless during their next turn', () => {
    let s = T.game({ p0: { hand: ['john-silver-alien-pirate'], ink: 6 }, p1: { play: [DW] } });
    const dw = P(s, 1).play[0];
    s = play(s, 'john-silver-alien-pirate');
    s = T.answer(s, [dw]);
    ok(!LC.chars(s, dw).kw.Reckless, 'not yet during my turn');
    s = T.endTurn(s);
    ok(LC.chars(s, dw).kw.Reckless, 'Reckless during their turn');
    ok(!T.legal(s, { type: 'quest', iid: dw }));
  });

  test('ursula-deceiver: opponent reveals hand; you choose a song for them to discard', () => {
    let s = T.game({ p0: { hand: ['ursula-deceiver'], ink: 2 }, p1: { hand: [STRIKE, DW] } });
    const [song, dw] = P(s, 1).hand;
    s = play(s, 'ursula-deceiver');
    eq(s.ask.who, 0); eq(s.ask.from, [song]); eq(s.ask.seen, [song, dw]);
    s = T.answer(s, [song]);
    eq(T.zone(s, song), 'discard'); eq(T.zone(s, dw), 'hand');
  });

  test('mushu-stealthy-dragon: on quest, may draw only if an opponent has more cards', () => {
    let s = T.game({ p0: { play: ['mushu-stealthy-dragon'] }, p1: { hand: [DW] } });
    s = T.act(s, { type: 'quest' });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(P(s, 0).hand.length, 1);
    let s2 = T.game({ p0: { play: ['mushu-stealthy-dragon'], hand: [DW] }, p1: { hand: [DW] } });
    s2 = T.act(s2, { type: 'quest' });
    eq(s2.ask, null); eq(P(s2, 0).hand.length, 1);
  });

  test('vixey-forest-friend: costs 1 less with a Tod in play', () => {
    ok(T.legal(T.game({ p0: { hand: ['vixey-forest-friend'], ink: 2, play: ['tod-all-alone'] } }), { type: 'play', pay: 'ink' }));
    ok(!T.legal(T.game({ p0: { hand: ['vixey-forest-friend'], ink: 2, play: [DW] } }), { type: 'play', pay: 'ink' }));
  });

  test('the-queen-devious-disguise: may draw, then opponent gains 2; +2 lore while behind', () => {
    let s = T.game({ p0: { hand: ['the-queen-devious-disguise'], ink: 4 } });
    s = play(s, 'the-queen-devious-disguise');
    s = T.answer(s, true);
    const q = T.find(s, 0, 'the-queen-devious-disguise', 'play');
    eq(P(s, 0).hand.length, 1); eq(P(s, 1).lore, 2); eq(LC.chars(s, q).lore, 3);
    let s2 = T.game({ p0: { hand: ['the-queen-devious-disguise'], ink: 4 } });
    s2 = T.answer(play(s2, 'the-queen-devious-disguise'), false);
    eq(P(s2, 1).lore, 0); eq(P(s2, 0).hand.length, 0);
  });

  test('aladdin-doing-his-part: may pay 1 to banish chosen item (single item still asks)', () => {
    let s = T.game({ p0: { hand: ['aladdin-doing-his-part'], ink: 3 }, p1: { play: [RAM] } });
    const ram = P(s, 1).play[0];
    s = play(s, 'aladdin-doing-his-part');
    eq(s.ask.from, [ram]); eq(s.ask.min, 0);
    s = T.answer(s, [ram]);
    eq(T.zone(s, ram), 'discard'); eq(LC.readyInk(s, 0), 0);
    let s2 = T.game({ p0: { hand: ['aladdin-doing-his-part'], ink: 3 }, p1: { play: [RAM] } });
    s2 = T.answer(play(s2, 'aladdin-doing-his-part'), []);
    eq(T.zone(s2, P(s2, 1).play[0]), 'play'); eq(LC.readyInk(s2, 0), 1);
  });

  test('max-goof-rebellious-teen: may pay 1 to return a song costing 3 or less from discard', () => {
    let s = T.game({ p0: { hand: ['max-goof-rebellious-teen'], ink: 4, discard: [STRIKE, 'under-the-sea'] } });
    const song = T.find(s, 0, STRIKE, 'discard');
    s = play(s, 'max-goof-rebellious-teen');
    eq(s.ask.from, [song]);
    s = T.answer(s, [song]);
    eq(T.zone(s, song), 'hand'); eq(LC.readyInk(s, 0), 0);
  });

  test('bobby-zimuruski-spray-cheese-kid: may draw then discard', () => {
    let s = T.game({ p0: { hand: ['bobby-zimuruski-spray-cheese-kid', DW], ink: 1 } });
    const dw = T.find(s, 0, DW, 'hand');
    s = T.answer(play(s, 'bobby-zimuruski-spray-cheese-kid'), true);
    eq(P(s, 0).hand.length, 2);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'discard'); eq(P(s, 0).hand.length, 1);
  });

  test('rapunzel-tower-defender: discard a card to return chosen character', () => {
    let s = T.game({ p0: { hand: ['rapunzel-tower-defender', DW], ink: 4 }, p1: { play: [ERIC] } });
    const dw = T.find(s, 0, DW, 'hand'), eric = P(s, 1).play[0];
    s = play(s, 'rapunzel-tower-defender');
    s = T.answer(s, [dw]);
    s = T.answer(s, [eric]);
    eq(T.zone(s, dw), 'discard'); eq(T.zone(s, eric), 'hand');
    let s2 = T.game({ p0: { hand: ['rapunzel-tower-defender', DW], ink: 4 }, p1: { play: [ERIC] } });
    s2 = T.answer(play(s2, 'rapunzel-tower-defender'), []);
    eq(s2.ask, null); eq(T.zone(s2, P(s2, 1).play[0]), 'play');
  });

  test('lyle-tiberius-rourke-adventurer-for-hire: loot, and 2+ cards to discard makes opponent lose 1 lore', () => {
    let s = T.game({ p0: { hand: ['lyle-tiberius-rourke-adventurer-for-hire', PIERCE], ink: 4 }, p1: { lore: 3, play: [ERIC] } });
    s = T.answer(play(s, 'lyle-tiberius-rourke-adventurer-for-hire'), true);
    s = T.answer(s, [P(s, 0).hand.find((i) => s.cards[i].id === F)]);
    eq(s.ti.toDiscard[0], 1);
    s = play(s, PIERCE);
    s = T.answer(s, [P(s, 1).play[0]]);
    s = T.endTurn(s);
    eq(P(s, 1).lore, 2);
    let s2 = T.game({ p0: { play: ['lyle-tiberius-rourke-adventurer-for-hire'] }, p1: { lore: 3 } });
    s2 = T.endTurn(s2);
    eq(P(s2, 1).lore, 3);
  });

  test('lenny-toy-binoculars: discard an action of your choice; once per turn ready on playing an action', () => {
    let s = T.game({ p0: { hand: ['lenny-toy-binoculars'], ink: 3 }, p1: { hand: [PIERCE, DW] } });
    const pa = P(s, 1).hand[0];
    s = play(s, 'lenny-toy-binoculars');
    eq(s.ask.from, [pa]);
    s = T.answer(s, [pa]);
    eq(T.zone(s, pa), 'discard');
    let s2 = T.game({ p0: { play: [{ id: 'lenny-toy-binoculars', exerted: true }], hand: [STRIKE, STRIKE], ink: 4 } });
    const len = P(s2, 0).play[0];
    s2 = play(s2, STRIKE);
    s2 = T.answer(s2, [T.find(s2, 0, F, 'hand')]); // Strike's discard
    eq(s2.ask.kind, 'yesno');
    s2 = T.answer(s2, true);
    eq(s2.cards[len].exerted, false);
    s2.cards[len].exerted = true;
    s2 = play(s2, STRIKE);
    s2 = T.answer(s2, [T.find(s2, 0, F, 'hand')]);
    eq(s2.ask, null); eq(s2.cards[len].exerted, true);
  });

  test('milo-thatch-getting-his-hands-dirty: discard to bounce; draw at end of turn after 2+ discards', () => {
    let s = T.game({ p0: { hand: ['milo-thatch-getting-his-hands-dirty', DW, PIERCE], ink: 9 }, p1: { play: [ERIC, DW] } });
    const [eric, odw] = P(s, 1).play;
    s = play(s, 'milo-thatch-getting-his-hands-dirty');
    s = T.answer(s, [T.find(s, 0, DW, 'hand')]);
    s = T.answer(s, [eric]);
    eq(T.zone(s, eric), 'hand');
    s = play(s, PIERCE);
    s = T.answer(s, [odw]);
    eq(P(s, 0).hand.length, 0);
    s = T.endTurn(s);
    eq(P(s, 0).hand.length, 1);
  });

  test('prince-phillip-vanquisher-of-foes: banish all opposing damaged characters', () => {
    let s = T.game({ p0: { hand: ['prince-phillip-vanquisher-of-foes'], ink: 9, play: [{ id: DW, damage: 1 }] }, p1: { play: [{ id: DW, damage: 1 }, ERIC] } });
    const [odw, eric] = P(s, 1).play;
    s = play(s, 'prince-phillip-vanquisher-of-foes');
    eq(T.zone(s, odw), 'discard'); eq(T.zone(s, eric), 'play'); eq(T.zone(s, P(s, 0).play[0]), 'play');
  });

  test('retro-evolution-device: banish own character, play one costing up to 2 more for free', () => {
    let s = T.game({ p0: { play: ['retro-evolution-device', DW], hand: ['hamish-hubert-and-harris-troublemaking-triplets', NAK], ink: 1 } });
    const dw = P(s, 0).play[1], ham = P(s, 0).hand[0];
    s = activate(s, 'retro-evolution-device');
    eq(s.ask.from, [dw]); // single candidate still asks
    s = T.answer(s, [dw]);
    eq(s.ask.from, [ham]);
    s = T.answer(s, [ham]);
    eq(T.zone(s, dw), 'discard'); eq(T.zone(s, ham), 'play'); eq(LC.readyInk(s, 0), 0);
    ok(!T.legal(T.game({ p0: { play: ['retro-evolution-device'], ink: 1 } }), { type: 'activate' }), 'needs a character to banish');
  });

  test('malicious-mean-and-scary: 1 damage counter on each opposing character', () => {
    let s = T.game({ p0: { hand: ['malicious-mean-and-scary'], ink: 3, play: [ERIC] }, p1: { play: [DW, ERIC] } });
    s = play(s, 'malicious-mean-and-scary');
    eq(P(s, 1).play.map((i) => s.cards[i].damage), [1, 1]); eq(s.cards[P(s, 0).play[0]].damage, 0);
  });

  test('under-the-sea: opposing characters with 2 str or less go to the bottom of their deck', () => {
    let s = T.game({ p0: { hand: ['under-the-sea'], ink: 8 }, p1: { play: [DW, ERIC] } });
    const [dw, eric] = P(s, 1).play;
    s = play(s, 'under-the-sea');
    eq(T.zone(s, dw), 'deck'); eq(P(s, 1).deck[P(s, 1).deck.length - 1], dw); eq(T.zone(s, eric), 'play');
  });

  test('chernabog-unnatural-force: shuffle chosen opposing character; that player may play one from discard', () => {
    let s = T.game({ p0: { hand: ['chernabog-unnatural-force'], ink: 5 }, p1: { play: [ERIC], discard: [DW] } });
    const eric = P(s, 1).play[0], dw = P(s, 1).discard[0];
    s = play(s, 'chernabog-unnatural-force');
    s = T.answer(s, [eric]);
    eq(T.zone(s, eric), 'deck');
    eq(s.ask.who, 1); eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'play');
  });

  test('max-goof-chart-topper: on quest play a song from discard for free, then it goes to the deck bottom', () => {
    let s = T.game({ p0: { play: ['max-goof-chart-topper'], discard: [STRIKE] } });
    const song = P(s, 0).discard[0];
    s = T.act(s, { type: 'quest' });
    s = T.answer(s, [song]);
    eq(P(s, 0).hand.length, 2);
    s = T.answer(s, [P(s, 0).hand[0]]);
    eq(T.zone(s, song), 'deck'); eq(P(s, 0).deck[P(s, 0).deck.length - 1], song);
    eq(s.ti.toDiscard[0], 1); eq(P(s, 0).lore, 2);
  });

  test('strike-a-good-match: draw 2, discard 1', () => {
    let s = T.game({ p0: { hand: [STRIKE, DW], ink: 2 } });
    const dw = T.find(s, 0, DW, 'hand');
    s = play(s, STRIKE);
    s = T.answer(s, [dw]);
    eq(P(s, 0).hand.length, 2); eq(T.zone(s, dw), 'discard');
  });

  test('put-that-thing-back: return chosen character or item to hand', () => {
    let s = T.game({ p0: { hand: ['put-that-thing-back'], ink: 4 }, p1: { play: [RAM, DW] } });
    const [ram] = P(s, 1).play;
    s = play(s, 'put-that-thing-back');
    s = T.answer(s, [ram]);
    eq(T.zone(s, ram), 'hand');
  });

  test('to-wither-a-flower: 2 damage to each opposing damaged character', () => {
    let s = T.game({ p0: { hand: ['to-wither-a-flower'], ink: 4 }, p1: { play: [{ id: DW, damage: 1 }, ERIC, { id: NAK, damage: 1 }] } });
    const [dw, eric, nak] = P(s, 1).play;
    s = play(s, 'to-wither-a-flower');
    eq(T.zone(s, dw), 'discard'); eq(s.cards[eric].damage, 0); eq(s.cards[nak].damage, 3);
  });

  test('gaetan-moliere-clever-burrower: on quest may draw 2 then discard 2', () => {
    let s = T.game({ p0: { play: ['gaetan-moliere-clever-burrower'], hand: [DW] } });
    s = T.answer(T.act(s, { type: 'quest' }), true);
    eq(s.ask.min, 2);
    s = T.answer(s, P(s, 0).hand.slice(0, 2));
    eq(P(s, 0).hand.length, 1); eq(P(s, 0).discard.length, 2);
  });

  test('mickey-mouse-snowboard-ace: opponent discards when played and when he leaves play', () => {
    let s = T.game({ p0: { hand: ['mickey-mouse-snowboard-ace', 'put-that-thing-back'], ink: 10 }, p1: { hand: [DW, F] } });
    const [dw, f] = P(s, 1).hand;
    s = play(s, 'mickey-mouse-snowboard-ace');
    eq(s.ask.who, 1);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'discard');
    const m = T.find(s, 0, 'mickey-mouse-snowboard-ace', 'play');
    s = play(s, 'put-that-thing-back');
    s = T.answer(s, [m]);
    eq(T.zone(s, m), 'hand'); eq(s.ask.who, 1);
    s = T.answer(s, [f]);
    eq(T.zone(s, f), 'discard');
  });

  test('stegmutt-clumsy-dinosaur: 1 less per item in discard; may put 3 items on bottom to deal 3', () => {
    let s = T.game({ p0: { hand: ['stegmutt-clumsy-dinosaur'], ink: 5, discard: [RAM, MAP, BOOK] }, p1: { play: [ERIC] } });
    const items = P(s, 0).discard.slice(), eric = P(s, 1).play[0];
    s = play(s, 'stegmutt-clumsy-dinosaur');
    eq(LC.readyInk(s, 0), 0);
    s = T.answer(s, true);
    s = T.answer(s, items);
    s = T.answer(s, [eric]);
    ok(items.every((i) => T.zone(s, i) === 'deck'), 'items on deck bottom');
    eq(s.cards[eric].damage, 3);
    ok(!T.legal(T.game({ p0: { hand: ['stegmutt-clumsy-dinosaur'], ink: 5, discard: [RAM] } }), { type: 'play', pay: 'ink' }), '8-1=7 > 5');
  });

  test("buzz-s-arm: free if a Buzz Lightyear was banished this turn; exert for 1 less on next action/item", () => {
    const s0 = T.game({ p0: { hand: ['buzz-s-arm'] } });
    ok(!T.legal(s0, { type: 'play', pay: 'free' }));
    s0.ti.banishedNames.push('Buzz Lightyear'); // no Buzz Lightyear character is in the pool
    ok(T.legal(s0, { type: 'play', pay: 'free' }));
    let s = T.game({ p0: { play: ['buzz-s-arm'], hand: [PIERCE], ink: 1 }, p1: { play: [DW] } });
    ok(!T.legal(s, { type: 'play', pay: 'ink' }));
    s = activate(s, 'buzz-s-arm');
    ok(T.legal(s, { type: 'play', pay: 'ink' }), 'Piercing Attack now costs 1');
  });

  test("enigmatic-inkcaster: gain 1 lore only if you've played 2+ cards this turn", () => {
    let s = T.game({ p0: { play: ['enigmatic-inkcaster'], hand: [DW, DW], ink: 2 } });
    s = play(s, DW);
    s = play(s, DW);
    s = activate(s, 'enigmatic-inkcaster');
    eq(P(s, 0).lore, 1);
    let s2 = T.game({ p0: { play: ['enigmatic-inkcaster'], hand: [DW], ink: 1 } });
    s2 = activate(play(s2, DW), 'enigmatic-inkcaster');
    eq(P(s2, 0).lore, 0);
  });

  test('inscrutable-map: chosen opposing character gets -1 lore until the start of your next turn', () => {
    let s = T.game({ p0: { play: [MAP], ink: 1 }, p1: { play: [ERIC] } });
    const eric = P(s, 1).play[0];
    s = activate(s, MAP);
    eq(s.ask.from, [eric]);
    s = T.answer(s, [eric]);
    s = T.endTurn(s);
    s = T.act(s, { type: 'quest', iid: eric });
    eq(P(s, 1).lore, 0);
  });

  test('my-adventure-book: non-character to hand, character to deck bottom', () => {
    let s = T.game({ p0: { play: [BOOK], ink: 1, deck: [PIERCE, F] } });
    const pa = P(s, 0).deck[0];
    s = activate(s, BOOK);
    eq(T.zone(s, pa), 'hand');
    let s2 = T.game({ p0: { play: [BOOK], ink: 1, deck: [DW, F] } });
    const dw = P(s2, 0).deck[0];
    s2 = activate(s2, BOOK);
    eq(T.zone(s2, dw), 'deck'); eq(P(s2, 0).deck[1], dw); eq(P(s2, 0).hand.length, 0);
  });

  test('potion-of-malice: 1 damage counter; banish to give opposing damaged characters Reckless', () => {
    let s = T.game({ p0: { play: ['potion-of-malice'], ink: 1 }, p1: { play: [ERIC] } });
    const eric = P(s, 1).play[0];
    s = activate(s, 'potion-of-malice', 0);
    s = T.answer(s, [eric]);
    eq(s.cards[eric].damage, 1); eq(LC.readyInk(s, 0), 0);
    let s2 = T.game({ p0: { play: ['potion-of-malice'] }, p1: { play: [{ id: DW, damage: 1 }, ERIC] } });
    const [dw, e2] = P(s2, 1).play;
    s2 = activate(s2, 'potion-of-malice', 1);
    eq(P(s2, 0).discard.length, 1);
    s2 = T.endTurn(s2);
    ok(LC.chars(s2, dw).kw.Reckless, 'damaged gains Reckless'); ok(!LC.chars(s2, e2).kw.Reckless, 'undamaged does not');
  });

  test('battering-ram: 1 damage to chosen damaged character; banish-self with no location does nothing else', () => {
    let s = T.game({ p0: { play: [RAM] }, p1: { play: [{ id: DW, damage: 1 }, ERIC] } });
    const dw = P(s, 1).play[0];
    s = activate(s, RAM, 0);
    eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'discard');
    let s2 = T.game({ p0: { play: [RAM] } });
    s2 = activate(s2, RAM, 1);
    eq(s2.ask, null); eq(T.zone(s2, P(s2, 0).discard[0]), 'discard');
  });

  test('piercing-attack: 2 damage that Resist cannot reduce', () => {
    let s = T.game({ p0: { hand: [PIERCE], ink: 2 }, p1: { play: ['violet-parr-force-field-practice'] } });
    const v = P(s, 1).play[0];
    s = play(s, PIERCE);
    s = T.answer(s, [v]);
    eq(T.zone(s, v), 'discard'); // 2 willpower, Resist +1 ignored
  });

  test('sabotage: banish chosen item and all others with the same name', () => {
    let s = T.game({ p0: { hand: ['sabotage'], ink: 3, play: [RAM] }, p1: { play: [RAM, MAP] } });
    const mine = P(s, 0).play[0], [theirs, map] = P(s, 1).play;
    s = play(s, 'sabotage');
    s = T.answer(s, [theirs]);
    eq(T.zone(s, theirs), 'discard'); eq(T.zone(s, mine), 'discard'); eq(T.zone(s, map), 'play');
  });

  test('freeze-the-vine: draw 2 then discard 1', () => {
    let s = T.game({ p0: { hand: ['freeze-the-vine'], ink: 4 } });
    s = play(s, 'freeze-the-vine');
    s = T.answer(s, [P(s, 0).hand[0]]);
    eq(P(s, 0).hand.length, 1); eq(P(s, 0).discard.length, 2);
  });

  test('education-or-elimination: mode 1 draws and buffs own character; mode 2 banishes a damaged one', () => {
    let s = T.game({ p0: { hand: ['education-or-elimination'], ink: 4, play: [DW] }, p1: { play: [{ id: ERIC, damage: 1 }] } });
    const dw = P(s, 0).play[0], eric = P(s, 1).play[0];
    s = play(s, 'education-or-elimination');
    eq(s.ask.kind, 'mode');
    s = T.answer(s, 0);
    eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(P(s, 0).hand.length, 1); eq(LC.chars(s, dw).lore, 2); ok(LC.chars(s, dw).kw.Evasive);
    s = T.endTurn(s);
    ok(LC.chars(s, dw).kw.Evasive, 'lasts through their turn');
    let s2 = T.game({ p0: { hand: ['education-or-elimination'], ink: 4 }, p1: { play: [{ id: ERIC, damage: 1 }] } });
    s2 = T.answer(play(s2, 'education-or-elimination'), 1);
    const e2 = P(s2, 1).play[0];
    s2 = T.answer(s2, [e2]);
    eq(T.zone(s2, e2), 'discard'); eq(P(s2, 0).hand.length, 0);
  });

  test("strange-things: up to 2 chosen characters can't quest until your next turn; draw", () => {
    let s = T.game({ p0: { hand: ['strange-things'], ink: 4 }, p1: { play: [ERIC, DW, NAK] } });
    const [eric, dw, nak] = P(s, 1).play;
    s = play(s, 'strange-things');
    eq(s.ask.min, 0); eq(s.ask.max, 2);
    s = T.answer(s, [eric, dw]);
    eq(P(s, 0).hand.length, 1);
    s = T.endTurn(s);
    ok(!T.legal(s, { type: 'quest', iid: eric })); ok(!T.legal(s, { type: 'quest', iid: dw })); ok(T.legal(s, { type: 'quest', iid: nak }));
  });

  test('finnick-tiny-terror: may pay 2 to return chosen opposing character with 2 str or less', () => {
    let s = T.game({ p0: { hand: ['finnick-tiny-terror'], ink: 3 }, p1: { play: [DW, ERIC] } });
    const [dw] = P(s, 1).play;
    s = play(s, 'finnick-tiny-terror');
    eq(s.ask.from, [dw]); eq(s.ask.min, 0);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'hand'); eq(LC.readyInk(s, 0), 0);
  });
})();
