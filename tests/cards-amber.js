// Behaviour tests for amber cards (one per card, asserting side effects).
(function () {
  const { test, eq, ok } = LC.T;
  const T = LC.T;
  const DW = 'darkwing-duck-crime-fighter', ERIC = 'prince-eric-noble-swordsman', NAK = 'nakoma-waiting-out-the-storm', TH = 'thomas-wide-eyed-recruit';
  const ROPE = 'safety-rope', AKOOD = 'akood-et-emuti';
  const hand = (s, p) => s.players[p].hand.length;
  const ids = (s, iids) => iids.map((i) => s.cards[i].id);
  const putUnder = (s, top, n) => { for (let k = 0; k < n; k++) LC.move(s, s.players[s.cards[top].owner].deck[0], 'under', { under: top, facedown: true }); };

  test('grandmother-willow-ancient-advisor: first character each of your turns costs 1 less', () => {
    let s = T.game({ p0: { play: ['grandmother-willow-ancient-advisor'], hand: [NAK, NAK], ink: 8 }, p1: { hand: [NAK] } });
    const [a, b] = s.players[0].hand;
    eq(LC.costToPlay(s, a), 3);
    s = T.act(s, { type: 'play', iid: a, pay: 'ink' });
    eq(LC.readyInk(s, 0), 5, 'paid 3');
    eq(LC.costToPlay(s, b), 4, 'only once per turn');
    s = T.endTurn(s);
    eq(LC.costToPlay(s, s.players[1].hand[0]), 4, "opponent's character not reduced");
    s = T.endTurn(s);
    eq(LC.costToPlay(s, b), 3, 'resets on your next turn');
  });

  test('stitch-carefree-surfer: OHANA draws 2 only with 2+ other characters, and asks', () => {
    let s = T.game({ p0: { play: [TH, TH], hand: ['stitch-carefree-surfer'], ink: 7 } });
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(hand(s, 0), 2);
    let s2 = T.game({ p0: { play: [TH], hand: ['stitch-carefree-surfer'], ink: 7 } });
    s2 = T.act(s2, { type: 'play', pay: 'ink' });
    eq(s2.ask, null); eq(hand(s2, 0), 0);
  });

  test('besties-assemble: top 4, may take a character, rest to the bottom', () => {
    let s = T.game({ p0: { hand: ['besties-assemble'], ink: 1, deck: [ROPE, DW, ROPE, ROPE, TH, TH] } });
    const dw = s.players[0].deck[1];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [dw], 'only the character is offered');
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'hand');
    eq(ids(s, s.players[0].deck), [TH, TH, ROPE, ROPE, ROPE]);
  });

  test('ohana-means-family: removes all damage, draws one per damage (single candidate still asks)', () => {
    let s = T.game({ p0: { hand: ['ohana-means-family'], ink: 3, play: [{ id: ERIC, damage: 3 }] }, p1: { play: [{ id: DW, damage: 1 }] } });
    const e = s.players[0].play[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.kind, 'cards'); eq(s.ask.from, [e]);
    s = T.answer(s, [e]);
    eq(s.cards[e].damage, 0); eq(hand(s, 0), 3);
  });

  test('the-horseman-strikes: draw, then may banish a chosen Evasive character', () => {
    const EV = 'hamish-hubert-and-harris-troublemaking-triplets';
    let s = T.game({ p0: { hand: ['the-horseman-strikes'], ink: 3 }, p1: { play: [EV, DW] } });
    const [ev] = s.players[1].play;
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [ev]); eq(s.ask.min, 0);
    s = T.answer(s, [ev]);
    eq(T.zone(s, ev), 'discard'); eq(hand(s, 0), 1);
  });

  test('angel-siren-singer: UNDERDOG costs 1 less on the second player first turn only', () => {
    const s = T.game({ active: 1, turn: 2, p1: { hand: ['angel-siren-singer'] } });
    eq(LC.costToPlay(s, s.players[1].hand[0]), 1);
    const s2 = T.game({ active: 1, turn: 4, p1: { hand: ['angel-siren-singer'] } });
    eq(LC.costToPlay(s2, s2.players[1].hand[0]), 2);
  });

  test('bambi-ethereal-fawn: COME SEE! reveals cards equal to cards under, characters to hand', () => {
    let s = T.game({ p0: { play: ['bambi-ethereal-fawn'], deck: [TH, TH, DW, ROPE, NAK, TH] } });
    const b = s.players[0].play[0];
    putUnder(s, b, 2);
    const [dw, rope] = s.players[0].deck;
    s = T.act(s, { type: 'quest', iid: b });
    eq(T.zone(s, dw), 'hand'); eq(T.zone(s, rope), 'deck');
    eq(s.players[0].deck[s.players[0].deck.length - 1], rope, 'non-character to the bottom');
    eq(hand(s, 0), 1);
  });

  test('dale-ready-for-his-shot: your characters deal challenge damage with willpower', () => {
    let s = T.game({ p0: { play: ['dale-ready-for-his-shot', TH] }, p1: { play: [{ id: ERIC, exerted: true }] } });
    const th = s.players[0].play[1], e = s.players[1].play[0];
    s = T.act(s, { type: 'challenge', iid: th, target: e });
    eq(s.cards[e].damage, 4, 'Thomas deals his 4 willpower');
    eq(T.zone(s, th), 'discard', 'Eric still deals his strength');
    let s2 = T.game({ p0: { play: ['dale-ready-for-his-shot', 'luisa-madrigal-pushing-through'] }, p1: { play: [{ id: ERIC, exerted: true }] } });
    s2 = T.act(s2, { type: 'challenge', iid: s2.players[0].play[1] });
    eq(s2.cards[s2.players[1].play[0]].damage, 3, 'Challenger +2 does not add to willpower damage');
    let s3 = T.game({ active: 1, p0: { play: ['dale-ready-for-his-shot', { id: TH, exerted: true }] }, p1: { play: [DW] } });
    const dw = s3.players[1].play[0];
    s3 = T.act(s3, { type: 'challenge', iid: dw });
    eq(T.zone(s3, dw), 'discard', 'defending Thomas deals 4 (his willpower)');
  });

  test('tinker-bell-generous-fairy: MAKE A NEW FRIEND takes a character from the top 4', () => {
    let s = T.game({ p0: { hand: ['tinker-bell-generous-fairy'], ink: 4, deck: [ROPE, NAK, ROPE, ROPE, DW] } });
    const nak = s.players[0].deck[1];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [nak]);
    s = T.answer(s, [nak]);
    eq(T.zone(s, nak), 'hand'); eq(s.cards[s.players[0].deck[0]].id, DW);
  });

  test('stitch-carefree-snowboarder: BRING YOUR FRIENDS may draw when questing with 2+ others', () => {
    let s = T.game({ p0: { play: ['stitch-carefree-snowboarder', TH, TH] } });
    s = T.act(s, { type: 'quest', iid: s.players[0].play[0] });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(hand(s, 0), 1); eq(s.players[0].lore, 2);
  });

  test('akood-et-emuti: next character costs 2 less; draw a card', () => {
    let s = T.game({ p0: { hand: [AKOOD, NAK], play: [NAK], ink: 4 } });
    const nak = s.players[0].hand[1];
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0], pay: 'sing' });
    eq(hand(s, 0), 2, 'drew one');
    eq(LC.costToPlay(s, nak), 2);
    s = T.act(s, { type: 'play', iid: nak, pay: 'ink' });
    eq(LC.readyInk(s, 0), 2, 'paid 2');
    eq(s.players[0].costMods.length, 0, 'used up');
  });

  test('aurora-holding-court: ROYAL WELCOME reduces only the next Princess or Queen', () => {
    let s = T.game({ p0: { play: ['aurora-holding-court'], hand: [DW, 'eilonwy-princess-of-llyr'] } });
    const [dw, eil] = s.players[0].hand;
    s = T.act(s, { type: 'quest', iid: s.players[0].play[0] });
    eq(LC.costToPlay(s, dw), 1); eq(LC.costToPlay(s, eil), 0);
    s = T.act(s, { type: 'play', iid: eil, pay: 'ink' });
    eq(T.zone(s, eil), 'play');
  });

  test('pluto-friendly-pooch: GOOD DOG exerts for 1 less on the next character', () => {
    let s = T.game({ p0: { play: ['pluto-friendly-pooch'], hand: [NAK] } });
    const p = s.players[0].play[0];
    s = T.act(s, { type: 'activate', iid: p, idx: 0 });
    eq(s.cards[p].exerted, true);
    eq(LC.costToPlay(s, s.players[0].hand[0]), 3);
  });

  test('mike-wazowski-heroic-climber: FIND A FRIEND, each player reveals; characters may go to hand', () => {
    let s = T.game({ p0: { hand: ['mike-wazowski-heroic-climber'], ink: 2, deck: [DW, TH] }, p1: { deck: [ROPE, TH] } });
    const dw = s.players[0].deck[0], rope = s.players[1].deck[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.kind, 'yesno'); eq(s.ask.who, 0);
    s = T.answer(s, true);
    eq(T.zone(s, dw), 'hand');
    eq(s.players[1].deck[1], rope, 'non-character to the bottom');
  });

  test('pocahontas-guiding-the-tribe: STAY CLOSE plays a cost-1 character free (single candidate asks)', () => {
    let s = T.game({ p0: { hand: ['pocahontas-guiding-the-tribe', DW, NAK], ink: 2 } });
    const dw = s.players[0].hand[1];
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0], pay: 'ink' });
    eq(s.ask.kind, 'cards'); eq(s.ask.from, [dw]); eq(s.ask.min, 0);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'play'); eq(LC.readyInk(s, 0), 0);
  });

  test('nani-stage-manager: THAT\'S YOUR CUE takes a character with cost 2 or less', () => {
    let s = T.game({ p0: { hand: ['nani-stage-manager'], ink: 3, deck: [NAK, DW, ROPE, TH, TH] } });
    const [nak, dw, , th] = s.players[0].deck;
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [dw, th], 'cost 4 Nakoma and the item are not offered');
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'hand'); eq(T.zone(s, nak), 'deck'); eq(T.zone(s, th), 'deck');
  });

  test('pocahontas-peacekeeper: CALMING WORDS when shifted stops challenges until your next turn', () => {
    let s = T.game({ p0: { hand: ['pocahontas-peacekeeper'], ink: 3, play: ['pocahontas-guiding-the-tribe', ERIC] }, p1: { play: [{ id: DW, exerted: true }, ERIC] } });
    s = T.act(s, { type: 'play', pay: 'shift' });
    ok(!T.legal(s, { type: 'challenge' }), 'you cannot challenge');
    s.cards[s.players[0].play[1]].exerted = true;
    s = T.endTurn(s);
    ok(!T.legal(s, { type: 'challenge' }), 'opponent cannot challenge');
    s = T.endTurn(s);
    s.cards[s.players[1].play[0]].exerted = true;
    ok(T.legal(s, { type: 'challenge' }), 'ends at the start of your next turn');
    let s2 = T.game({ p0: { hand: ['pocahontas-peacekeeper'], ink: 5 }, p1: { play: [{ id: DW, exerted: true }] } });
    s2 = T.act(s2, { type: 'play', pay: 'ink' });
    eq(s2.effects.length, 0, 'not shifted: no effect');
  });

  test('meilin-lee-losing-control: RED PANDA POWER takes a Red Panda character or a song', () => {
    let s = T.game({ p0: { hand: ['meilin-lee-losing-control'], ink: 3, deck: [DW, AKOOD, ROPE, TH, TH] } });
    const ak = s.players[0].deck[1];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [ak]);
    s = T.answer(s, [ak]);
    eq(T.zone(s, ak), 'hand');
  });

  test('ariel-ethereal-voice: COMMAND PERFORMANCE may draw on a song once per turn, needs a card under', () => {
    let s = T.game({ p0: { play: ['ariel-ethereal-voice', NAK, NAK], hand: [AKOOD, AKOOD] } });
    putUnder(s, s.players[0].play[0], 1);
    const [n1, n2] = s.players[0].play.slice(1);
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0], pay: 'sing', singer: n1 });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(hand(s, 0), 3, 'akood draw + Ariel draw');
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0], pay: 'sing', singer: n2 });
    eq(s.ask, null, 'once per turn'); eq(hand(s, 0), 3);
  });

  test('circle-of-life: play a character from your discard for free', () => {
    let s = T.game({ p0: { hand: ['circle-of-life'], play: [ERIC, NAK], discard: [DW, ROPE] } });
    const [e, n] = s.players[0].play, dw = T.find(s, 0, DW, 'discard');
    s = T.act(s, { type: 'play', pay: 'singTogether' });
    s = T.answer(s, [e, n]);
    eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'play');
  });

  test('mowgli-man-cub: HAVE A BETTER LOOK, opponent discards a non-character card of their choice', () => {
    let s = T.game({ p0: { hand: ['mowgli-man-cub'], ink: 2 }, p1: { hand: [DW, ROPE, AKOOD] } });
    const [dw, rope, ak] = s.players[1].hand;
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.who, 1); eq(s.ask.from, [rope, ak]);
    s = T.answer(s, [ak]);
    eq(T.zone(s, ak), 'discard'); eq(T.zone(s, rope), 'hand'); eq(T.zone(s, dw), 'hand');
  });

  test('stitch-rock-star: ADORING FANS may exert a played cost-2-or-less character to draw', () => {
    let s = T.game({ p0: { play: ['stitch-rock-star'], hand: [DW, NAK], ink: 5 } });
    const dw = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: dw, pay: 'ink' });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.cards[dw].exerted, true); eq(hand(s, 0), 2);
    s = T.act(s, { type: 'play', iid: T.find(s, 0, NAK, 'hand'), pay: 'ink' });
    eq(s.ask, null, 'cost 4 does not trigger');
  });

  test('jumba-jookiba-prolific-inventor: 1 less per character; I AM HELPING heals all', () => {
    let s = T.game({ p0: { play: [TH, TH, TH], hand: ['jumba-jookiba-prolific-inventor'] } });
    eq(LC.costToPlay(s, s.players[0].hand[0]), 5);
    s = T.game({ p0: { play: ['jumba-jookiba-prolific-inventor'] }, p1: { play: [{ id: ERIC, damage: 5 }] } });
    const e = s.players[1].play[0];
    s = T.act(s, { type: 'quest' });
    eq(s.ask.min, 0);
    s = T.answer(s, [e]);
    eq(s.cards[e].damage, 0);
  });

  test('raging-storm: banish all characters', () => {
    let s = T.game({ p0: { hand: ['raging-storm'], ink: 8, play: [ERIC, ROPE] }, p1: { play: [DW, NAK] } });
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.players[1].play.length, 0);
    eq(ids(s, s.players[0].play), [ROPE], 'items stay');
  });

  test("world-s-greatest-criminal-mind: banish chosen character with 5 strength or more", () => {
    let s = T.game({ p0: { hand: ['world-s-greatest-criminal-mind'], ink: 3 }, p1: { play: [ERIC, DW] } });
    const e = s.players[1].play[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [e]); eq(s.ask.min, 1);
    s = T.answer(s, [e]);
    eq(T.zone(s, e), 'discard');
  });

  test('look-at-this-family: top 5, up to 2 characters to hand', () => {
    let s = T.game({ p0: { hand: ['look-at-this-family'], play: [ERIC, NAK], deck: [DW, ROPE, NAK, TH, ROPE, TH] } });
    const [dw, , nak, th] = s.players[0].deck;
    const [e, n] = s.players[0].play;
    s = T.act(s, { type: 'play', pay: 'singTogether' });
    s = T.answer(s, [e, n]);
    eq(s.ask.max, 2); eq(s.ask.from, [dw, nak, th]);
    s = T.answer(s, [dw, th]);
    eq(T.zone(s, dw), 'hand'); eq(T.zone(s, th), 'hand'); eq(T.zone(s, nak), 'deck');
    eq(s.cards[s.players[0].deck[0]].id, TH, 'the 6th card is now on top');
  });

  test('safety-rope: GRAB HOLD! puts a character on top; PACK IT UP banishes to draw', () => {
    let s = T.game({ p0: { hand: [ROPE], ink: 2, discard: [DW] } });
    const dw = s.players[0].discard[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.from, [dw]);
    s = T.answer(s, [dw]);
    eq(s.players[0].deck[0], dw);
    s = T.endTurn(s);
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(T.zone(s, dw), 'hand');
    eq(T.zone(s, T.find(s, 0, ROPE)), 'discard');
  });

  test("ursula-s-shell-necklace: NOW, SING! may pay 1 ink to draw on a song", () => {
    let s = T.game({ p0: { play: ['ursula-s-shell-necklace', NAK], hand: [AKOOD], ink: 1 } });
    s = T.act(s, { type: 'play', pay: 'sing' });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(LC.readyInk(s, 0), 0); eq(hand(s, 0), 2);
    let s2 = T.game({ p0: { play: ['ursula-s-shell-necklace', NAK], hand: [AKOOD], ink: 0 } });
    s2 = T.act(s2, { type: 'play', pay: 'sing' });
    eq(s2.ask, null, 'cannot pay: no question'); eq(hand(s2, 0), 1);
  });

  test('mickey-mouse-expedition-leader: may enter exerted; SECRET PATH gives -2 strength', () => {
    let s = T.game({ p0: { hand: ['mickey-mouse-expedition-leader'], ink: 4 } });
    const m = s.players[0].hand[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.kind, 'yesno'); s = T.answer(s, true);
    eq(s.cards[m].exerted, true);
    s = T.game({ p0: { play: [{ id: 'mickey-mouse-expedition-leader', exerted: true }, TH] }, p1: { play: [ERIC] } });
    const e = s.players[1].play[0];
    s = T.act(s, { type: 'quest', iid: s.players[0].play[1] });
    eq(s.ask.from, [e]); eq(s.ask.min, 1);
    s = T.answer(s, [e]);
    eq(LC.chars(s, e).str, 4);
    s = T.endTurn(s);
    eq(LC.chars(s, e).str, 4, 'lasts through their turn');
    s = T.endTurn(s);
    eq(LC.chars(s, e).str, 6);
    let s3 = T.game({ p0: { play: ['mickey-mouse-expedition-leader', TH] }, p1: { play: [ERIC] } });
    s3 = T.act(s3, { type: 'quest', iid: s3.players[0].play[1] });
    eq(s3.ask, null, 'ready Mickey: no trigger');
  });

  test('woody-helping-a-friend: HANG ON! choose one; with another Toy, both', () => {
    let s = T.game({ p0: { hand: ['woody-helping-a-friend', DW], ink: 4, discard: [TH] } });
    const dw = s.players[0].hand[1];
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0], pay: 'ink' });
    eq(s.ask.kind, 'mode');
    s = T.answer(s, 1);
    s = T.answer(s, [dw]);
    eq(T.zone(s, dw), 'play'); eq(s.players[0].discard.length, 1, 'only one chosen: Thomas stays in the discard');
    s = T.game({ p0: { hand: ['woody-helping-a-friend'], ink: 4, play: ['woody-waiting-for-a-friend'], discard: [TH] } });
    const th = s.players[0].discard[0];
    s = T.act(s, { type: 'play', pay: 'ink' });
    eq(s.ask.kind, 'cards'); eq(s.ask.from, [th]);
    s = T.answer(s, [th]);
    eq(s.ask.from, [th], 'the returned card can be played for free');
    s = T.answer(s, [th]);
    eq(T.zone(s, th), 'play');
  });
})();
