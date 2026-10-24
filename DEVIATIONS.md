# Deviations

Rules the engine does not yet keep. Under PLAN D1 a divergence from the printed card or the
Comprehensive Rules (version in `docs/rules.md`) is a defect, never a design choice, so each entry
here is a debt, not a decision. Each entry names its CR section, says what the engine does
instead, and says what would close it. When one is fixed, delete the entry in the same commit.
Cards that cannot play as printed at all are kept out of decks via `data/defects.js` instead.

## Open deviations

### Locations are not implemented
- **CR:** 4.6.8 (challenging locations), 4.7 (moving characters), 5.6 (location cards), 3.2.2.2
  (location lore at the Set step), 1.8.1.4 (location banish).
- **Engine does:** nothing for locations. No location card is in the card pool (PLAN D14), so no
  deck can contain one. Effects that mention locations find no targets.
- **Closes when:** a location enters the pool; then add the card type, `move` action, challenge
  target, Set-step lore and tests.

### "Put the rest on the bottom of your deck in any order" uses the order shown
- **CR:** 7.2.3 (cards added to the top or bottom "in any order"). The rules have no 6.1.x
  section for this wording; the closest are 6.1.14 (looking at and revealing cards from a group)
  and the 1.2.3 example of a card that puts looked-at cards back "in any order". Card text
  governs.
- **Engine does:** puts the remaining cards on the bottom in the order they were shown. The
  player is not asked to arrange them.
- **Why it matters:** the player loses control of the order of their next draws after the deck
  cycles. It is a real, if small, loss of agency.
- **Closes when:** an ordering prompt exists (the `ask` door with an ordered-pick type) and the
  cards that say "in any order" use it, both for looked-at cards (private order) and revealed
  ones (public order, 7.2.3).

### Last-known information for characters that left play
- **CR:** 6.7.7 (use the values from just before a card left play).
- **Engine does:** a trigger whose source left play before it resolves reads the card's printed
  values (e.g. Support adds printed strength; a banished character's own damage trigger credits
  nobody). No card in the pool hits this in normal play.
- **Closes when:** `leavePlay` snapshots `chars()` onto the bag entry and triggers read it.

### Rulings we made without an official answer (check against Ravensburger Q&A)
- **angel-experiment-624 GOOD AIM** ("Once during your turn, you may choose and discard a card to
  deal 2 damage…") is offered like an activated ability with the discard as its cost, the way
  Boost's identical "Once during your turn, you may pay…" wording works (CR 8.4).
- **mike-wazowski-heroic-climber FIND A FRIEND:** a revealed character card the player declines
  to take stays on top of their deck ("Otherwise" covers only non-character cards).
- **ariel-ethereal-voice COMMAND PERFORMANCE:** the "if there's a card under this character"
  check is applied when the trigger would be added as well as on resolution, so a trigger that
  would do nothing doesn't use up "once during your turn".

<!-- Add more entries above this line, same fields: CR, Engine does, Closes when. -->

## Not deviations, recorded so they are not mistaken for one

- **Two players only.** Multiplayer (CR section 9) and the casual Pack Rush variant (section 10)
  are out of scope, not broken. The game is advertised as two-player.
- **Constructed only.** Limited formats (CR 1.10.1.2) are not offered. The deck builder enforces
  the Constructed rules (CR 1.10.1.1).
- **No physical-play rules.** Shuffling offers, cutting the opponent's deck, verifying the inkwell
  symbol aloud, lore trackers and counters (CR 1.10.2, 1.10.3, 2.2.1.2, 4.2.1.2) have no digital
  equivalent. Shuffles use a seeded RNG inside `apply`.
- **No illegal actions can be attempted.** CR 1.7.6 describes undoing an illegal action; the UI
  only offers `legalActions`, so the situation never arises.
- **Random starting player is seeded.** CR 2.2.1.1 asks players to agree a random method; the
  engine uses the game seed. Play/draw choice between games (2.1.3.2) is the UI's decision.
- **No tournament rules.** Timing, slow play and judge calls are outside the Comprehensive Rules.
- **Mode flexibility.** Hot-seat and AI-vs-AI hide or show hands by UI convention; the rules'
  private zones (CR 7.1.3) are still held private from the engine's player view.
