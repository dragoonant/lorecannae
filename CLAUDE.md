# lorecannae — Disney Lorcana in the browser

Unofficial, non-commercial fan reproduction of the Disney Lorcana TCG rules, played vs AI,
hot-seat or AI-vs-AI in the browser. Decisions live in `PLAN.md` (read it first). Knowledge base
from earlier projects: `kb/README.md`.

## Hard rules

1. Plain browser JS, no build step, no dependencies. Every file is an IIFE on `globalThis.LC`.
   `index.html`'s script list is the load order; `tests.html` loads the same engine files in
   the same order (checked by `tools/check-pages.mjs`).
2. Engine surface: `LC.legalActions` / `LC.apply` (never mutates) / `LC.isTerminal` /
   `LC.whoActs` — contract in `docs/ENGINE-API.md`. Every UI affordance derives from
   `legalActions`; every number the UI shows comes from an engine function (`LC.chars`,
   `LC.costToPlay`, `LC.whyNot`).
3. One door per rule: damage (`dealDamage`), choices (`ask`), costs (`pay`), zone moves (`move`),
   characteristics (`chars`), lore (`gainLore`). Never write to a card's damage/zone directly
   outside the door.
4. Never assume a choice. No auto-pick for a single candidate.
5. No silent fallbacks: no `if (!LC.x)` and no `LC.x || {}` in UI code; a missing module throws.
6. Seeded RNG; every shuffle happens inside `apply`.
7. A card that doesn't play as printed goes in `data/defects.js`, never quietly into a deck.
8. Cite the Comprehensive Rules section (`CR 4.6.4`) in engine comments; tests named for the
   rule or card they assert.
9. Art prompts never contain card names, character names, franchise/studio/film/artist names,
   or text-magnet words (`tools/build-art-prompts.mjs` lints them).
10. Commit messages describe the mechanism by card id or CR section. UI commits say what was
    checked in the real page.
11. Never put the owner's real name or home path in any file; credit **evilgouki**.
12. Before committing a document, `ls` every path it claims exists.

## Commands

```
node tools/serve.mjs            # http://localhost:8231 (no-store cache)
node tools/test.mjs --quiet     # headless tests (runs tests.html's script list under node:vm)
node tools/sim.mjs --games 50   # AI-vs-AI / random games with invariants after every step
node tools/build-cards.mjs      # regenerate data/cards.js + data/decks.js from scratch/ dumps
node tools/gate.mjs             # every gate, one line each
node tools/stamp-assets.mjs     # re-stamp index.html ?v= hashes before every deploy commit
```

## Layout

```
index.html / tests.html   entry points
js/                       engine (ns, rng, state, engine, doors, abilities runtime, ai), then UI
data/cards.js             GENERATED card data (names + printed text) — never hand-edit
data/decks.js             GENERATED championship decks
data/abilities/*.js       per-card ability scripts
data/defects.js           cards that don't play as printed (kept out of decks)
tools/*.mjs               serve, test, sim, build-cards, gate, art/audio pipelines
tests/*.js                behaviour tests (loaded by tests.html)
docs/                     rules.md (CR citation index), ENGINE-API.md, sources.md, rights.md, takedown.md
kb/                       knowledge base distilled from earlier projects
scratch/                  gitignored: CR PDF/text, Lorcast dumps
```
