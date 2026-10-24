# Takedown

These are commands, not intentions. If Disney, Ravensburger or anyone acting for them asks, run
the first level at once and the others as asked, without argument. Deployment status itself is
recorded in `PLAN.md` (D6); this file holds the commands that match it. If D6 changes, rewrite
this file in the same commit.

Current deployment (per PLAN D6): public GitHub Pages for `dragoonant/lorecannae`, served from
`main` at the repo root.

## Level 1: end the hosted copy

Stop serving the site:

```
gh api -X DELETE repos/dragoonant/lorecannae/pages
```

Make the repository private so the source is no longer public:

```
gh repo edit dragoonant/lorecannae --visibility private --accept-visibility-change-consequences
```

Or delete the repository outright (this cannot be undone; it needs the `delete_repo` scope, which
you add with `gh auth refresh -h github.com -s delete_repo`):

```
gh repo delete dragoonant/lorecannae --yes
```

Without `gh`: GitHub, repository Settings, Pages, "Unpublish site"; then Settings, General,
Danger Zone, "Change visibility" or "Delete this repository".

Making a repo private does not remove forks or cached copies. Ask GitHub support for those if a
holder requires it.

## Level 2: withdraw the names and text

All published card names and rules text sit in one generated file, `data/cards.js`; the
championship deck lists, which carry tournament players' handles and card ids, are in
`data/decks.js` and `data/raw/nacc-decks.txt`.

**Planned flag (not built yet): `node tools/build-cards.mjs --strip-text`.** It would regenerate
`data/cards.js` with the `name`, `version`, `text` and `flavor` fields replaced by generic
placeholders, leaving numbers and ids so the game still loads. **TODO: this flag does not exist.**
`tools/build-cards.mjs` currently understands only `--fetch`. Until it is written, use Level 3 or
write the flag first (tracked in `TODO.md`).

## Level 3: make the game unplayable from the repository

Remove the data files; load-time validation throws on the first frame:

```
git rm data/cards.js data/decks.js data/raw/nacc-decks.txt
git commit -m "Withdraw card data on request"
git push
```

## Level 4: remove everything derived

When the project holds generated art and audio folders, remove them too:

```
git rm -r data art audio
git commit -m "Withdraw derived material on request"
git push
```

Removing files from the tip of `main` leaves them in git history. If a holder requires history to
be cleared, rewrite history or delete the repository (Level 1) and recreate it empty.

## After any level

Check that the deployed URL returns 404, then reply to the requester in the issue or message
that raised it.
