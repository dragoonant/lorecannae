# lorecannae

Disney Lorcana in the browser: an unofficial, non-commercial fan reproduction of the card game's
rules. Real card names and printed rules text; original generated art and sound.

**Play:** https://dragoonant.github.io/lorecannae/

## Run it locally

No build step and no dependencies. You need Node.

```
node tools/serve.mjs
```

Then open http://localhost:8231

Other commands are in `CLAUDE.md` (tests, simulations, the data build).

## Modes

- **Vs AI:** play one of the decks against the computer.
- **Hot-seat:** two players on one screen.
- **AI vs AI:** watch two decks play each other.
- **Deck builder:** edit a deck under the Constructed rules (60 or more cards, two inks, four copies
  of a full name).
- **Tutorial:** a guided first game.

## The decks

Twenty decks from the Disney Lorcana Challenge North American Championship (Fanfinity,
2026-08-29, Set 13 Core), picked to cover the spread of archetypes: Midrange, Detectives, Elinor,
Evasives, Retro, Songs, Stitch, Steelsong, Actions, Amethyst Steel and ETB. Between them they use
136 different cards. Sources are in `docs/sources.md`.

## Rules

The engine follows the Comprehensive Rules 2.2.0. `docs/rules.md` indexes them by section;
`DEVIATIONS.md` lists what the engine does not yet keep.

## Credits

Built by **evilgouki**.

This is an unofficial fan project, not affiliated with Disney or Ravensburger. See `NOTICE.md`.
