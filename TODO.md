# TODO

Improvements to things that already work. Missing rules go in `DEVIATIONS.md`; cards that don't
play as printed go in `data/defects.js`. Each entry has three parts:

- **What exists:** today's behaviour.
- **Constraints:** what the change must not break.
- **Done when:** a check anyone can run.

## Open

### Ravensburger fan-content policy text not read (terms dialog) — owner to read and record in docs/rights.md
- **What exists:** `docs/rights.md` records that the policy page is behind a terms-acceptance
  dialog that was not accepted, so its text is unread.
- **Constraints:** an agent must not accept terms for the owner. The owner reads it; Claude may
  then edit `docs/rights.md` from what the owner reports or pastes.
- **Done when:** `docs/rights.md` quotes or summarises the policy with the read date, states
  whether it covers a rules-enforcing client, and `NOTICE.md` carries any disclaimer wording the
  policy prescribes.

### `--strip-text` flag for `tools/build-cards.mjs`
- **What exists:** `docs/takedown.md` Level 2 describes the flag; `tools/build-cards.mjs` only
  accepts `--fetch`.
- **Constraints:** the game must still load and every id must stay stable so saved decks and
  tests keep working. Placeholders must not be official names.
- **Done when:** `node tools/build-cards.mjs --strip-text` writes a `data/cards.js` with no
  `name`, `version`, `text` or `flavor` from the source, and `node tools/test.mjs --quiet` still
  passes or fails only on tests that assert printed text.
