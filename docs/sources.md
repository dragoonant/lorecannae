# Sources

Where each input to this project came from, when, and how to get it again. Raw dumps live in
the gitignored `scratch/`; only generated files and the decklist text are committed.

## Card data

- **Source:** Lorcast API, `https://api.lorcast.com/v0/sets` and `/v0/sets/{n}/cards`. No key needed.
- **Fetched:** 2026-10-24, sets 1 to 13 (`scratch/s1.json` to `scratch/s13.json`).
- **Used for:** card names, versions, cost, Strength, Willpower, Lore, ink, inkwell flag,
  classifications, keywords, printed rules text, flavor text, rarity and format legality.
- **Pipeline:** `node tools/build-cards.mjs` reads the dumps and writes `data/cards.js` and
  `data/decks.js`. `node tools/build-cards.mjs --fetch` re-downloads the dumps first.
- **What it carries:** names and printed text are Disney Lorcana game data owned by the rights
  holders (see `docs/rights.md`). `data/cards.js` is the one file that carries them, which is
  why it is the withdrawal lever (`docs/takedown.md`).
- **Licence of the dataset:** not recorded. Lorcast's terms were not read for this note; owner to
  check before relying on any claim about them.
- **Known inkdecks code mapping:** `kb/README.md` lists which inkdecks set codes were verified
  against Lorcast by name (sets 1 to 4 and 9 to 13). Codes SSK, AZS, ARI and ROJ (sets 5 to 8)
  are in the build script but unconfirmed and unused by the current 20 decks.

## Decklists

- **Source:** inkdecks.com, Disney Lorcana Challenge North American Championship (DLC-NACC),
  Fanfinity, 2026-08-29, Set 13 Core, 136 players. Tournament page 364088 on inkdecks.com.
- **Picked:** 20 decks for archetype spread: Midrange, Detectives, Elinor, Evasives, Retro,
  Songs, Stitch, Steelsong, Actions, Amethyst Steel, ETB (PLAN D4).
- **Raw file:** `data/raw/nacc-decks.txt`, one deck per line: placement, deck name, archetype,
  player handle, inkdecks deck id, then `qty x <inkdecks set code><collector number>` tokens.
  Player handles are the public tournament names from the source page.
- **Access:** inkdecks.com sits behind Cloudflare; plain `curl` and WebFetch got 403, so the lists
  were not fetched by script (see `kb/README.md`).
- **Known data defects:** inkdecks showed one list as 50 cards and another as 61; see
  `kb/README.md`. Re-check or swap those lists; the build reports each deck's total.

## Rules

- **Source:** Disney Lorcana TCG Comprehensive Rules 2.2.0, effective July 9, 2026,
  https://files.disneylorcana.com/Comprehensive-Rules_2.2.0-EN.pdf
- **Fetched:** 2026-10-24. PDF and text extractions in `scratch/` (not committed).
- **Used for:** behaviour of every rule; indexed by section number in `docs/rules.md`.
  Rulings the document leaves open are listed there and in `DEVIATIONS.md`.

## Asset tools (generated locally, 2026-10-24)

All art and sound is made on the owner's machine; no cloud service is called (D12).

| Use | Tool | Licence of the model |
|---|---|---|
| Card and board art | FLUX.2 klein 4B, run locally through Flux Studio | Apache-2.0 |
| MGSD style audition (D17) | FLUX.1 dev (fp8) and FLUX.1 schnell (fp8), run locally through Flux Studio | dev: FLUX.1 [dev] **Non-Commercial** Licence, used only because this is a free, non-commercial fan project (owner's call, D17); schnell: Apache-2.0 |
| Sound effects | Stable Audio Open, run locally through Audio Studio | Stability AI community licence |
| Music | ACE-Step, run locally through Audio Studio | Apache-2.0 |
| Floor sound kit | Procedural Web Audio, written in this repo | this repo |

- Prompts are linted by `tools/build-art-prompts.mjs`: no text-magnet words, negations or counts
  above two. Under D17 (which supersedes D3) character names may appear in prompts; studio and film
  titles stay out. Official card images (Lorcast `image_uris`) were viewed only to describe each
  character; they are never used as image inputs and never committed.
- If FLUX.1 dev is picked for the batch, its output is bound by the non-commercial licence: the
  project must stay free and non-commercial.
- Stable Audio Open's community licence has conditions on commercial use and on attribution of
  the model. This project is non-commercial; the owner should re-read the licence text before
  shipping generated audio and record anything it requires here.
- The model licences cover the model weights. They do not by themselves settle who owns a
  generated output; no claim about that is made here.

## Reference material (not shipped)

- The `kb/` folder is notes distilled from the owner's earlier projects on the same machine.
  It is written for the builder, not the player, and quotes no official text.
