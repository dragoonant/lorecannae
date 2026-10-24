# PLAN — lorecannae (Disney Lorcana in the browser)

This file owns every decision. Other files point here; none restates a decision.

## Decisions

| # | Date | Decision | By |
|---|---|---|---|
| D1 | 2026-10-24 | **Regime: reproduction.** Rules fidelity is the product; printed rules text is shown verbatim; a divergence from the printed card or the Comprehensive Rules is a defect, never a design choice. No BALANCE.md. | owner (kickoff) |
| D2 | 2026-10-24 | **Names and text:** real Lorcana card names and rules text, from one generated file (`data/cards.js`), the withdrawal lever. | owner |
| D3 | 2026-10-24 | ~~**Art:**~~ SUPERSEDED by D17. 100% original, painterly storybook style. Never Disney character designs, logos, frames or trade dress; no franchise, studio, film or artist names in any prompt; characters are drawn as original archetypes that fit the card. | owner |
| D4 | 2026-10-24 | **Card pool:** every card in 20 decklists from the Disney Lorcana Challenge North American Championship (Fanfinity, 2026-08-29, Set 13 Core, 136 players), picked for archetype spread. 136 unique cards. Source and picks: `kb/README.md`, `data/raw/nacc-decks.txt`. | owner + default |
| D5 | 2026-10-24 | **Modes:** vs AI, deck builder, hot-seat 2-player, AI-vs-AI spectate, tutorial. | owner |
| D6 | 2026-10-24 | **Deploy:** public GitHub Pages, `dragoonant/lorecannae`, served from `main` root, no build step. | owner |
| D7 | 2026-10-24 | **Presentation:** emulate Starbound Legions (`kb/PRESENTATION-REFERENCE.md`) where it fits. | owner |
| D8 | 2026-10-24 | **Rules source:** Comprehensive Rules 2.2.0 (effective 2026-07-09), cited by section number in `docs/rules.md` and engine comments. | default |
| D9 | 2026-10-24 | **Abilities are authored per card as small JS functions over engine doors** (`data/abilities/*.js`), not compiled from text. 136 heterogeneous texts do not justify a grammar; each card gets a behaviour test asserting side effects, and the auditor checks every printed keyword/number appears in the authored data. A card that can't be implemented faithfully is listed in `data/defects.js` and kept out of decks. | default |
| D10 | 2026-10-24 | **Choices use the replay model:** a job that needs a decision throws `Ask`; the partly-resolved state stays on screen (costs paid, card played) with a snapshot of the pre-job state, and the answer re-runs the job from that snapshot with every answer so far. No auto-pick: one option or fifty, the player is asked (except "this card", "all", and zero-option windows). | default (KB) |
| D11 | 2026-10-24 | **Exerted cards turn 90° on the board** (the iconic Lorcana read), inside a slot that widens; the hover preview is always upright. Ink cards use the small tilt. | default |
| D12 | 2026-10-24 | **Assets generated locally** on this PC: Flux Studio (FLUX.2 klein 4B) for art; Audio Studio (Stable Audio Open SFX, ACE-Step music); a procedural Web Audio kit as the floor. Cloud keys are dead (401). | default |
| D13 | 2026-10-24 | **Dev server port 8231** (`node tools/serve.mjs`). | default |
| D14 | 2026-10-24 | **Locations are not implemented:** no location card is in the pool. Effects that mention locations find no targets. | default |
| D15 | 2026-10-24 | **AI levels:** easy = one ply with noise; normal = one opponent ply (top 2, 1 world); hard = one opponent ply (top 4, 3 worlds). Measurements in docs/ai.md. | default |
| D17 | 2026-10-24 | **Art (owner, after the first batch):** every card shows its ACTUAL character, recognisable ("Darkwing Duck not being a duck is really bad"), in **MGSD proportions** (about 2.5 heads tall, big head, short stubby limbs, detailed) with a **Disney-animation art direction**. Concern stated once to the owner (Disney enforcement; Pixelborn precedent); owner's call. Still never: official card images, frames, logos, or tracing/img2img of an official illustration. Style picked from an audition. | owner |
| D16 | 2026-10-24 | **No castles in screen art** (Disney castle-logo trade dress); the UI prompt lint refuses castle words. | default |

## Cut order if time runs short

Deck count and polish go first, never correctness: tutorial depth → AI-vs-AI controls →
deck-builder polish → animation beyond spotlight/lunge/banish → music tiers.
**Never cut:** per-card behaviour tests, the defects gate, open-information viewers, the log,
prompts that say what they are about.

## Status

**2026-10-24 04:00 HST (end of the overnight run).** Playable and deployed:
https://dragoonant.github.io/lorecannae/. All 136 pool cards scripted with behaviour tests (150
tests, auditor 0 FAIL); modes vs AI / hot-seat / spectate / tutorial / deck builder; original art
(136 cards + 8 plates) and generated audio (30 SFX + 6 tracks, not verified by ear); AI levels
easy / normal / hard (one opponent ply, docs/ai.md). Owner questions and open items:
HANDOFF.md.
