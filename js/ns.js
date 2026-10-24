// Namespace, seeded RNG and small shared utilities. Loaded first by index.html and tests.html.
(function () {
  const LC = (globalThis.LC = globalThis.LC || {});

  // mulberry32: tiny, fast, good enough for shuffles; state is one 32-bit int kept in game
  // state so every random event happens inside apply() and replays reproduce (CLAUDE.md rule 6).
  LC.rngNext = function (s) {
    let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  LC.rngInt = (s, n) => Math.floor(LC.rngNext(s) * n);
  LC.shuffleInPlace = function (s, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = LC.rngInt(s, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  // String seed -> 32-bit int (FNV-1a), so "seed=abc" in a URL reproduces a game.
  LC.hashSeed = function (str) {
    let h = 0x811c9dc5;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
    return h | 0;
  };

  LC.clone = typeof structuredClone === 'function'
    ? (o) => structuredClone(o)
    : (o) => JSON.parse(JSON.stringify(o));

  class Illegal extends Error { constructor(msg) { super(msg); this.name = 'Illegal'; } }
  LC.Illegal = Illegal;

  LC.INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
})();
