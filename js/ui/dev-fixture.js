// js/ui/dev-fixture.js — DEV ONLY, loaded by index.html only when the URL has ?fixture.
// Skips the title screens and starts a match straight away so layout and interaction can
// be checked quickly. Not on the default path.
//   ?fixture                vs AI, two vanilla/keyword-only test decks
//   ?fixture=champ          vs AI, two random championship decks
//   &mode=hotseat|spectate|tutorial   &seed=N   &anim=off|quick|full   &turns=N (bots play N actions first)
(function () {
  'use strict';
  const LC = globalThis.LC;
  const VANILLA = [['thomas-wide-eyed-recruit', 12], ['darkwing-duck-crime-fighter', 12], ['nakoma-waiting-out-the-storm', 12],
    ['prince-eric-noble-swordsman', 12], ['david-protective-snowboarder', 12]];
  LC.devFixture = {
    boot: function () {
      const q = new URLSearchParams(location.search);
      const kind = q.get('fixture');
      const mode = q.get('mode') || 'ai';
      if (q.get('anim')) LC.anim.setMode(q.get('anim'));
      let decks;
      if (kind === 'champ') {
        const pool = LC.DECKS.map(function (d) { return d.id; });
        decks = [pool[Math.floor(Math.random() * pool.length)], pool[Math.floor(Math.random() * pool.length)]];
      } else decks = [{ name: 'Test A', cards: VANILLA }, { name: 'Test B', cards: VANILLA }];
      document.getElementById('title-screen').className = '';
      LC.ui.start({ mode: mode, decks: decks, level: q.get('level') || 'easy', seed: q.get('seed') ? Number(q.get('seed')) : undefined });
      const turns = Number(q.get('turns') || 0);
      if (turns) {
        // Fast-forward: both seats played by the bot, no animation, then hand back.
        let s = LC.ui.state;
        for (let i = 0; i < turns && !LC.isTerminal(s); i++) s = LC.apply(s, LC.ai.choose(s, LC.whoActs(s), 'normal'));
        LC.ui.state = s;
        LC.ui.lastN = s.log.length ? s.log[s.log.length - 1].n : -1;
        LC.ui.render();
        LC.ui.schedule();
      }
    },
  };
})();
