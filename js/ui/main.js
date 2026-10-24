// js/ui/main.js — boot. Loaded last. A missing module is a broken build and throws
// loudly (CLAUDE.md rule 5: no `if (!LC.x)` fallbacks); a missing art or audio ENTRY is
// a normal state while assets are generated and falls back per card / per sound.
(function () {
  'use strict';
  const LC = globalThis.LC;

  function fail(msg) {
    const box = document.createElement('div');
    box.id = 'boot-error';
    box.textContent = 'lorecannae could not start: ' + msg;
    document.body.appendChild(box);
    throw new Error(msg);
  }
  const NEED = ['newGame', 'legalActions', 'apply', 'whoActs', 'isTerminal', 'chars', 'costToPlay', 'whyNot',
    'whyNotInk', 'def', 'fullName', 'actionsFor', 'endTurnBlocker', 'printedKeywords', 'deckProblems', 'playableDecks', 'makeTrace'];
  NEED.forEach(function (k) { if (typeof LC[k] !== 'function') fail('engine function LC.' + k + ' is missing (check the <!-- engine --> block).'); });
  if (!LC.ai || typeof LC.ai.choose !== 'function') fail('LC.ai.choose is missing (js/ai.js).');
  if (!LC.CARDS || !LC.DECKS || !LC.DEFECTS) fail('card data (data/cards.js, data/decks.js, data/defects.js) did not load.');
  if (!LC.ART || !LC.ART.cards || !LC.ART.ui) fail('data/art-manifest.js did not define LC.ART = {cards, ui}.');
  if (!LC.AUDIO || !LC.AUDIO.sfx || !LC.AUDIO.music) fail('data/audio-manifest.js did not define LC.AUDIO = {sfx, music}.');
  if (LC.logText.missing.length) console.error('[boot] log types without a phrase: ' + LC.logText.missing.join(', '));

  // A card with no art entry renders the seeded fallback; say how many, once, so a thin
  // manifest is visible in the console rather than silently papered over.
  const noArt = Object.keys(LC.CARDS).filter(function (id) { return !LC.ART.cards[id]; });
  if (noArt.length) console.warn('[boot] ' + noArt.length + ' of ' + Object.keys(LC.CARDS).length + ' cards have no art entry yet (fallback art shown): ' + noArt.slice(0, 8).join(', ') + (noArt.length > 8 ? ', ...' : ''));

  LC.boardArt.init(document.getElementById('mat'));
  LC.hud.init();
  if (LC.devFixture) LC.devFixture.boot();
  else LC.title.init();
})();
