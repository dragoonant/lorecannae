# AI notes

`js/ai.js`: one machine for every level. Each legal action is applied, our own follow-up
questions are settled greedily, and the result is scored by `evaluate()`; the AI ends its turn
when no action beats the current position (the do-nothing baseline at the same horizon). The
arena is a behaviour check and AI tuner, never a reason to change a card (PLAN D1).

## Weights (levels: easy / normal / hard)

| Weight | Value | Reason |
|---|---|---|
| `loreValue(L)` | `10L + 1.6·max(0, L−12)²` | lore is the race; superlinear near 20 because the last points end the game |
| character body | `lore·loreBody + 1.4·str + 1.1·(wp−damage) + 0.6·cost` + keyword bonuses | a character is future lore plus board presence |
| `loreBody` | 6 | swept 2026-10-24, see below; plateau, not a peak |
| `threat` | easy 0.25, normal 0.7, hard 0.85 | share of an exerted character's value lost when the opponent can banish it on their turn (the quest-vs-challenge question) |
| ink | `4.2·min(ink,7) + 0.8·(ink−7)` | ink matters up to ~7, little after |
| hand | 3.2 per card | |

## Measurements

- 2026-10-24, 100 AI-vs-AI games (normal, 20 NACC decks, seed 7): 0 errors, 0 capped,
  first-player wins 62% (±10), mean 17.1 turns, empty turns 0.1%, quests 1.53 / challenges
  0.18 / plays 1.16 / inks 0.75 per turn.
- Head-to-head sweeps (60 games, alternating seats, seeds 5000+; holdout seeds 9100+):

| Change (A vs normal B) | A wins | Verdict |
|---|---|---|
| loreBody 10 vs 6 | 45.0% | worse |
| loreBody 4 vs 6 | 56.7%, holdout 45.0% (80 games) | noise; **do not re-run** |
| threat 0.95 vs 0.7 | 40.0% | worse |
| threat 0.5 vs 0.7 | 50.0% | no difference |

## Hard: one opponent ply (2026-10-24)

Hard plays its top 3 candidates and "end the turn" through the rest of its turn and the
opponent's whole reply (normal policy, 10-14 candidates per decision) on a determinized copy
(opponent hand+deck and our own deck reshuffled: the AI never reads hidden cards), and picks the
best position at the start of its next turn.

- Hard vs Normal: 21/30 (70.0%, seeds 7700+), holdout 41/60 (68.3%, seeds 12345+); 131-145 ms
  per decision.
- 40 Hard-vs-Hard games: 0 errors, first-player wins 52.5% (Normal: 62%), challenges 0.28 per
  turn (Normal 0.18), empty turns 3.7% (Normal 0.1%) — **watch**: the owner has complained about
  AI turns where nothing happens; check whether these are deliberate holds or empty-hand turns.
