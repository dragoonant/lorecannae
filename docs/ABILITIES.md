# Writing card abilities

Every card in `data/cards.js` whose text does more than its keywords needs an entry in
`LC.ABIL[cardId]` in one of `data/abilities/{amber,amethyst,emerald,steel}.js` (by the card's
first ink). Keywords that are pure keyword lines (Evasive, Ward, Rush, Bodyguard, Resist +N,
Challenger +N, Singer N, Shift N, Sing Together N, Boost N, Support, Alert, Reckless) are handled
by the engine from the printed text — don't script them. Read `js/engine.js` and
`js/abilities.js` before writing; the ctx helpers there are the ONLY way to change the game.

## Shape

```js
LC.ABIL['card-id'] = {
  // Triggered abilities (CR 6.2). Added to the bag when `on` happens and `when` is true at
  // trigger time; `run` resolves later (conditions in the text are checked inside run).
  triggers: [{ name: 'PRINTED NAME', on: 'played', when: (s, me, ev) => ev.iid === me, run(x, ev) { ... } }],
  // Activated abilities (CR 6.3): "[cost] — effect". cost: {exert, ink, discard, banishSelf}.
  activated: [{ name, text, cost: { exert: true, ink: 1 }, once: false, can: (s, me) => true, run(x) { ... } }],
  // Static abilities (CR 6.4) applied by chars(): called for EVERY in-play card t with the
  // characteristics-in-progress r. Modify r.str/r.wp/r.lore/r.kw/r.flags/r.activated.
  // NEVER call LC.chars inside an aura (recursion); read definitions and plain state only.
  auras: [(s, me, t, r) => { if (t === me && s.cards[me].under.length) { r.str += 2; r.lore += 1; } }],
  action(x) { ... },                 // the effect of an action/song card (CR 4.3.3.2)
  selfCost: (s, iid, p) => -1,       // self-referential payment modifier (CR 4.3.6), ink only
  costAura: (s, me, iid, p) => 0,    // modifier on OTHER cards p plays while `me` is in play
  freePlay: (s, iid) => bool,        // "you may play this for free" condition
  cantPlay: (s, iid) => bool, cantPlayWhy: (s, iid) => 'sentence',
  altShift: { can(s, iid), pay(x, iid) },   // alternate Shift cost
  mayEnterExerted: true,             // "This character may enter play exerted."
  oneChallengePerTurn: true,         // "Each turn, only one character can challenge."
};
```

## Events (`on`) and their `ev`

| on | ev | typical `when` |
|---|---|---|
| `played` | `{iid, p, kind:'character'|'item'|'action', song, singers, shifted}` | `ev.iid === me` ("When you play this character") / `ev.p === s.cards[me].owner && ev.song` ("whenever you play a song") |
| `quest` | `{iid, p}` | `ev.iid === me`; other questers: `ev.p === owner && ev.iid !== me` |
| `challenges` | `{iid, target, p}` | `ev.iid === me` |
| `banishedInChallenge` | `{iid (victim), by}` | `ev.by === me` |
| `banished` | `{iid, by, challenge}` | |
| `leavesPlay` | `{iid, to}` | `ev.iid === me` |
| `turnStart` / `turnEnd` | `{p}` | `ev.p === s.cards[me].owner` |
| `exerts` | `{iid, cause}` | `ev.iid === me && s.active === s.cards[me].owner` |
| `putUnder` | `{iid, card}` | `ev.iid === me` |
| `discarded` | `{iid, p}` | |
| `damaged` | `{iid, amount, from, challenge}` | |
| `sings` | `{iid (singer), song}` | |

"Once during your turn" on a trigger: `run(x){ if (!x.once('NAME')) return; ... }` — but check
the trigger's condition FIRST so a failed condition doesn't use it up.

## ctx (`x`) cheat sheet (js/abilities.js)

- Who: `x.me` (source iid), `x.ctrl` (its controller), `x.opp`. State: `x.s`.
- Read: `x.chars(i)` (live str/wp/lore/kw/flags), `x.def(i)`, `x.name(i)`, `x.characters(p)`,
  `x.items(p)`, `x.inPlay(p)`, `x.hand(p)`, `x.discardPile(p)`, `x.deck(p)`, `x.isChar(i)`,
  `x.isSong(i)`, `x.hasClass(i,'Hero')`, `x.cost(i)`, `x.myTurn()`, `x.hasNamed(p, 'Tod')`.
- Ask: `x.chooseOne(from, prompt, {optional})` → iid|null; `x.chooseCards({from, min, max, prompt,
  who, chosen, seen})` → iids; `x.may(prompt, yesLabel, noLabel, who)` → bool;
  `x.mode(prompt, labels, enabled)` → index. **Prompts name the effect and its numbers**
  ("Choose a character to deal 2 damage to."). "chosen" in the text = `chosen:true` (default; Ward
  applies). Choices that aren't "chosen" (discarding, your own hand) pass `chosen:false`.
  "up to N" → `min:0`. "you may [do X to chosen]" → `chooseOne(..., {optional:true})` (choosing
  nothing = declining) or `x.may` when nothing is chosen.
- Do: `x.damage(t,n,{noResist})`, `x.putDamage(t,n)`, `x.moveDamage(a,b,n)`, `x.heal(t,n|'all')`,
  `x.banish(t)`, `x.exert(t)`, `x.ready(t)`, `x.toHand(t)`, `x.toDeck(t,'bottom'|'top')`,
  `x.shuffleInto(t)`, `x.toDiscard(t)`, `x.draw(p,n)`, `x.discard(handIid)`,
  `x.chooseDiscard(p,n)`, `x.gainLore(p,n)`, `x.loseLore(p,n)`, `x.reveal(iids)`,
  `x.playFree(iid)` (from hand or discard), `x.lookPick({n, filter, max, prompt})`.
- Temporary modifiers: `x.buff(t, mod, x.until.eot()|x.until.myNextTurn()|x.until.theirNextTurn(p)|x.until.theirNextReady(p), 'log text')`
  where mod = `{str, wp, lore, kw:{Evasive:true, Challenger:2, Resist:2, Reckless:true}, flags:{cantQuest:true, cantReady:true, canChallengeReady:true}}`.
- Global: `x.effect({kind:'noChallenge', ...x.until.myNextTurn()})`; cost reductions:
  `x.costMod(p, {amount:1, type:'character'|'actionOrItem', classes:['Princess','Queen']})`
  ("you pay N less for the next X you play this turn").
- Once per turn: `x.once('KEY')` returns true the first time this turn (and marks it).

Flags the engine understands: `cantQuest`, `cantChallenge`, `cantReady`, `cantBeChallenged`,
`canChallengeReady`, `dealWithWillpower`, `noDamageFromClass` (string), `cantSing`, `singBonus`.

## Rules to keep (KB lessons)

- Never auto-pick: every "chosen"/"choose" goes through `x.chooseOne/chooseCards` even with one
  candidate. "each opponent chooses" → `who: x.opp`.
- "[A] to [B]" / "[A]. If you do, [B]" (CR 6.1.5): do B only if A fully happened.
- "may": ask (`optional:true` or `x.may`). Not "may" → do it.
- If you can't implement a card faithfully, DON'T approximate: add it to `data/defects.js` with
  the reason, and say so in your report.
- One behaviour test per card in `tests/cards-<ink>.js`, using `LC.T` (tests/harness.js): build a
  position with `T.game`, act with `T.act`/`T.answer`, assert the side effect (zone, damage,
  lore, hand size, ink exerted), not just "it resolved". Include the single-candidate case for at
  least one targeted card (it must still ask).

## Examples

See the first entries of `data/abilities/amber.js` (Tod, Gaston, Hamm, Flynn, White Rabbit,
Elinor, John Silver, Prince Charming, Broadway's Stone by Day, Mrs. Incredible, Junior Woodchuck
Guidebook, Strength of a Raging Fire) and their tests in `tests/cards-amber.js`.
