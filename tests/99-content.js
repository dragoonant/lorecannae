// Content gates: every card a deck uses either has a script for its non-keyword text or is in
// data/defects.js; every deck is legal (CR 1.10 deck building: 60+ cards, max 4 copies of a
// full name, at most 2 inks).
(function () {
  const { test, eq, ok } = LC.T;
  // A text line is "keyword only" when, after removing reminder text in parentheses, only
  // keyword tokens remain.
  const KW = /^(Alert|Bodyguard|Evasive|Reckless|Rush|Support|Vanish|Ward|Challenger \+\d+|Resist \+\d+|Singer \d+|Boost \d+(?: \{I\})?|Shift \d+(?: \{I\})?|Sing Together \d+)$/;
  LC.needsScript = function (d) {
    for (const raw of (d.text || '').split('\n')) {
      const line = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (!line) continue;
      if (!KW.test(line)) return true;
    }
    return false;
  };

  test('content: every pool card with ability text has a script or a defect entry', () => {
    const missing = [];
    for (const d of Object.values(LC.CARDS)) {
      if (!LC.needsScript(d)) continue;
      if (LC.ABIL[d.id] || LC.DEFECTS[d.id]) continue;
      missing.push(d.id);
    }
    eq(missing, [], `${missing.length} cards need scripts`);
  });

  test('content: every script key is a real card and every action card has action()', () => {
    for (const id of Object.keys(LC.ABIL)) ok(LC.CARDS[id], `unknown script ${id}`);
    for (const d of Object.values(LC.CARDS)) if (LC.isAction(d) && !LC.DEFECTS[d.id]) ok(LC.ABIL[d.id] && LC.ABIL[d.id].action, `action ${d.id} lacks action()`);
  });

  test('content: every deck is legal (60+, max 4 per full name, 1-2 inks)', () => {
    for (const deck of LC.DECKS) {
      const n = deck.cards.reduce((a, [, q]) => a + q, 0);
      ok(n >= 60, `${deck.id} has ${n}`);
      const byName = {};
      for (const [id, q] of deck.cards) { const k = LC.fullName(LC.CARDS[id]); byName[k] = (byName[k] || 0) + q; }
      for (const [k, q] of Object.entries(byName)) ok(q <= 4, `${deck.id}: ${q}x ${k}`);
      ok(deck.inks.length >= 1 && deck.inks.length <= 2, `${deck.id} inks ${deck.inks}`);
    }
  });
})();
(function () {
  const { test, ok } = LC.T;
  test('content: no pool card uses an unimplemented Shift variant (CR 8.10.8)', () => {
    for (const d of Object.values(LC.CARDS)) ok(!LC.printedKeywords(d).UnsupportedShift || LC.DEFECTS[d.id], `${d.id}: ${LC.printedKeywords(d).UnsupportedShift}`);
  });
  test('CR 5.2.6 multi-name cards have each name', () => {
    ok(LC.namesMatch(LC.CARDS['hamish-hubert-and-harris-troublemaking-triplets'], 'Hubert'));
    ok(LC.namesMatch(LC.CARDS['lilo-and-stitch-fun-loving-friends'], 'Stitch'));
  });
})();
