# Engine API contract (frozen shape; additions allowed, renames not)

Everything lives on one global namespace `LC` (`globalThis.LC`). Plain browser JS, no build
step; every file is an IIFE. The engine never touches the DOM and never writes prose: it emits
structured log entries and the UI phrases them. CR = Disney Lorcana Comprehensive Rules 2.2.0
(effective 2026-07-09); see `docs/rules.md`.

## Surface

| Function | Returns |
|---|---|
| `LC.newGame({decks:[deckA, deckB], seed, first})` | a fresh state in the mulligan phase. A deck is a deck id from `LC.DECKS` or `{name, cards:[[cardId, qty], ...]}`. `first`: 0, 1 or `'random'` (default; seeded). |
| `LC.legalActions(s)` | array of actions for `LC.whoActs(s)`. Never empty while the game is not over. |
| `LC.apply(s, action)` | a NEW state (deep copy; `s` is never mutated). Throws `LC.Illegal` on an illegal action. |
| `LC.whoActs(s)` | `0`, `1`, or `null` when the game is over. |
| `LC.isTerminal(s)` | true when `s.winner !== null`. |
| `LC.chars(s, iid)` | live characteristics of a card instance (see below). Every number the UI shows comes from here. |
| `LC.costToPlay(s, iid)` | ink the player would pay right now to play the hand card normally (after payment modifiers). |
| `LC.whyNot(s, iid)` | `null`, or a short sentence why the hand card can't be played/inked now ("Needs 4 ink, you have 3 ready."). |
| `LC.def(iidOrCardId, s?)` | the card definition (`LC.CARDS[id]`). |
| `LC.fullName(def)` | `"Name - Version"` or `"Name"`. |
| `LC.actionsFor(s, iid)` | the legal actions that concern this card (as source, target, singer or shift base). |

## State (read-only for the UI)

```js
s = {
  turn: 1,                 // increments when the active player changes
  active: 0, first: 0,     // seat indices
  phase: 'mulligan' | 'main' | 'over',
  winner: null | 0 | 1, endReason: null | 'lore' | 'deckout' | 'concede',
  players: [{
    name, deckName,
    deck: [iid, ...],      // index 0 is the TOP. Hidden: UI shows the count only.
    hand: [iid, ...],      // hidden from the other seat
    ink:  [iid, ...],      // facedown; exerted state on the card instance
    discard: [iid, ...],   // public; index 0 is the most recent
    play: [iid, ...],      // characters and items in play, in arrival order
    lore: 0,
    inkedThisTurn: false,
  }, {...}],
  cards: { [iid]: {
    iid, id,               // id = card definition id (LC.CARDS key)
    owner: 0 | 1,
    zone: 'deck' | 'hand' | 'ink' | 'play' | 'discard' | 'under',
    exerted: false,
    damage: 0,
    under: [iid, ...],     // cards stacked under this one (Shift base cards faceup, Boost cards facedown)
    facedown: false,       // true for Boost cards under a card and for ink
    enteredTurn: null,     // turn number the card entered play
    dry: false,            // false while drying; set at the owner's Set step (CR 3.2.2.1). Prefer LC.chars().drying
  }},
  ask: null | Ask,         // a pending decision; when set, only answers are legal
  log: [ LogEntry, ... ],  // append-only, oldest first
  revealed: { 0: [iid...], 1: [iid...] }  // cards currently revealed to the OTHER player (e.g. "reveals their hand")
}
```

## Actions

```js
{type:'answer', value}                 // answers s.ask (see Ask)
{type:'ink', iid}                      // put an inkable hand card into the inkwell (once per turn)
{type:'play', iid, pay:'ink'}          // play a hand card paying ink
{type:'play', iid, pay:'shift', onto}  // play via Shift onto your character `onto`
{type:'play', iid, pay:'sing', singer} // sing a song by exerting `singer`
{type:'play', iid, pay:'singTogether'} // Sing Together; the singers are asked next
{type:'quest', iid}
{type:'challenge', iid, target}
{type:'activate', iid, idx}            // idx into LC.chars(s, iid).activated
{type:'boost', iid}
{type:'end'}                           // end the turn
{type:'concede', who}                  // either seat, any time (CR 2.3.3); not in legalActions
```

## Ask (pending decision)

```js
{
  kind: 'cards' | 'yesno' | 'mode' | 'bag' | 'mulligan' | 'order',
  who: 0 | 1,              // the seat that must answer
  src: iid | null,         // the card whose effect is asking (show it!)
  prompt: 'Choose a character to deal 2 damage to.',
  // kind 'cards' and 'mulligan':
  from: [iid, ...],        // candidates; may be in play, hand, discard, or revealed deck cards
  seen: [iid, ...],        // every card the asker is looking at (e.g. all 4 looked-at cards);
                           // `from` is a subset. The UI must show all of `seen`, dimming non-`from`.
  min: 0, max: 1,          // answer value = array of iids, length in [min, max]
  // kind 'yesno': value = true | false; `yes`/`no` are button labels
  yes: 'Draw 2 cards', no: "Don't",
  // kind 'mode': value = option index; options = [{label, enabled}]
  options: [...],
  // kind 'bag': value = bag entry id; options = [{id, src, name}]  (order your triggered abilities)
}
```

Legal answers for multi-pick asks are validated by `apply`; `legalActions` returns a
representative sample of them (the AI uses it), so the UI must build its own picker from
`from/min/max`, not from `legalActions`.

## LC.chars(s, iid)

```js
{
  str, wp, lore, cost,             // live values (cost = printed ink cost)
  damage, exerted, drying, dry,
  kw: { Evasive:true, Ward:true, Bodyguard:true, Rush:true, Reckless:true, Support:true,
        Alert:true, Resist:2, Challenger:3, Singer:4, Shift:3, Boost:2, SingTogether:8 },
  classifications: ['Storyborn','Hero',...],
  canQuest, canChallenge,          // booleans for this card right now (its own restrictions)
  activated: [{name, text, costText, usable, why}],  // why = reason when !usable
  type: 'character' | 'item' | 'action' | 'location', song: bool,
}
```

## Log entries

`{n, turn, who, type, ...data, sound?, notice?, via?}` where `via` is the iid of the card whose
ability produced the entry (indent it under that card). Types:

| type | data |
|---|---|
| `start` | `{first}` game begins |
| `mulligan` | `{count}` |
| `turn` | `{}` turn begins for `who` |
| `draw` | `{iid}` (UI shows the face only to its owner) |
| `ink` | `{iid}` (the card is REVEALED as it is inked, CR 4.2.1.1: show its face to both players in the log; in the inkwell it is facedown) |
| `play` | `{iid, pay, singer?, singers?, onto?, cost}` |
| `ability` | `{iid, name}` an activated/triggered ability starts resolving |
| `quest` | `{iid, lore}` |
| `challenge` | `{iid, target}` |
| `damage` | `{iid, amount, from, challenge:bool, put:bool}` |
| `heal` | `{iid, amount}` damage removed |
| `banish` | `{iid, by?}` |
| `lore` | `{amount, total}` (negative amount = lost lore) |
| `exert` / `ready` | `{iid}` (only when caused by an effect) |
| `toHand` / `toDeck` / `toDiscard` / `toInk` / `under` | `{iid, from}` zone changes caused by effects |
| `discard` | `{iid}` discarded from hand |
| `reveal` | `{iids}` |
| `boost` | `{iid}` |
| `buff` | `{iid, text}` a temporary modifier ("+2 strength this turn") |
| `shuffle` | `{}` |
| `fizzle` | `{iid, text}` paid-for effect that did nothing (`notice:true`) |
| `win` | `{reason}` |
