# Comprehensive Rules citation index

- **Source:** Disney Lorcana TCG Comprehensive Rules, https://files.disneylorcana.com/Comprehensive-Rules_2.2.0-EN.pdf
- **Version:** 2.2.0, effective July 9, 2026 (adds Attack of the Vine!; PLAN D8)
- **Fetched:** 2026-10-24. The PDF and its text extraction live in the gitignored `scratch/`
  (`cr.txt` plain, `cr-2.2.0.txt` layout). Neither is committed or published.

This is an index, not a copy. Each entry gives the section number, what the section says in
our own words, and an **Engine** note: what the code has to do about it. Short quoted phrases are
the rules' own terms where the exact wording matters. Read the PDF for the authoritative text.
Engine comments cite sections as `CR 4.6.4`.

Notation in the PDF's text layer: the exert, ink, Strength, Willpower and Lore icons come out as
odd characters, so this index spells them out. Engine terms follow `CLAUDE.md`: one door per
rule (`dealDamage`, `ask`, `pay`, `move`, `chars`, `gainLore`).

---

## 1. Concepts

### 1.1 General
- **1.1.4, 1.1.5** English text and the current errata are official. *Engine:* card text is
  whatever Lorcast serves on the fetch date in `data/cards.js`; a later errata means a rebuild.
- **1.1.7** Reminder text (italic, in parentheses) is a memory aid, not rules. *Engine:* never
  derive behaviour from reminder text; behaviour comes from the keyword section (8) and the
  authored ability.

### 1.2 Golden rules
- **1.2.1** A card's text beats a general rule. *Engine:* general rules are defaults that
  per-card scripts (D9) may override through named hooks (e.g. playing an action outside your
  own turn, as a banish trigger may allow).
- **1.2.2** "Can't" beats "can". *Engine:* when a permission effect and a prohibition both
  apply, the prohibition wins. Implement prohibitions as checks that run after permissions.
- **1.2.3** Do as much as you can of an effect that is partly impossible. *Engine:* effect
  helpers must return a partial result instead of throwing when targets or cards run short
  (draw 3 from a 2-card deck draws 2). Exception: a sequential effect whose first part cannot
  be done stops there (6.1.5.1).

### 1.3 Players
- **1.3.3, 1.4.3.1** "You" is the player who played the card or generated the effect.
  *Engine:* every effect context carries `controller`, set when the card is played or the
  ability is created, not the card's current owner.
- **1.3.4** Only the player whose turn it is counts as the active player. *Engine:* the
  active-player seat is `s.active`; it is not referenced by card text.
- **1.3.5** "Opponent" means anyone not on your side. *Engine:* two-player only (multiplayer,
  section 9, is out of scope); opponent is the other seat.
- **1.4.3** The owner of a card makes decisions about it and physically handles it, even when
  an opposing player's effect moves it. *Engine:* when an effect shuffles or discards an
  opposing card, the decision about that card (e.g. which discard) is asked of its owner via
  `ask`, and the shuffle happens inside `apply` with the seeded RNG.

### 1.5 Costs
- **1.5.1** A card's cost is the ink number in its corner. *Engine:* `LC.chars` exposes cost;
  `costToPlay` applies modifiers.
- **1.5.3** A cost is paid in full or the thing cannot happen. *Engine:* `pay` is
  all-or-nothing; an unpayable cost makes the action absent from `legalActions`.
- **1.5.4** Modifiers change what is paid, not the printed cost. *Engine:* keep two numbers:
  printed cost (for Singer comparisons, "cost N or less" filters) and amount paid.
- **1.5.5 and children** Alternate costs replace the ink cost: singing, shifting, and playing
  "for free". *Engine:* playing a card enumerates one legal action per available payment
  route; the player picks the route.
- **1.5.5.3 / 6.1.7** "For free" means no ink and no other alternate cost may be chosen.
  *Engine:* a free play from an effect never offers Shift or Sing; it skips the cost step.
- **1.5.5.4 / 6.1.7.1** Using an ability "for free" waives costs except exerting.

### 1.6 Abilities
- **1.6.1 and children** Four kinds (triggered, activated, static, replacement) plus keywords.
  Abilities normally work only while their source is in play. *Engine:* an ability script
  declares its kind and the zone it functions in (6.1.12 for the exceptions).

### 1.7 Game actions, timing, illegal actions
- **1.7.2** Each effect or turn action finishes before the next begins. *Engine:* no
  interleaving; triggers wait in the bag (7.7).
- **1.7.3** Choices happen as the effect resolves. *Engine:* choices are raised with `ask`
  at resolution time under the replay model (D10), not when the card is played.
- **1.7.4** Triggered abilities wait in the bag. See 7.7.
- **1.7.5** Drying: a character cannot quest, challenge or use exert costs until it has
  been in play since the start of its player's turn. See 5.1.1.11.
- **1.7.6, 1.7.7** An illegal action is undone. *Engine:* `LC.apply` is pure and throws
  `LC.Illegal`; the UI only offers `legalActions`, so undo never has to be modelled. An
  illegal choice inside an effect means choose again; with no legal choice the effect does
  nothing.

### 1.8 Game state check
- **1.8.1** The game checks a fixed list of conditions after each Start-of-Turn step, after the
  Challenge Declaration and Challenge Damage steps, after each turn action, after all effects
  of an action or ability resolve, and when the turn ends.
  - **1.8.1.1** 20 or more lore wins.
  - **1.8.1.2** A player whose turn ends with no cards in deck loses.
  - **1.8.1.4** A character or location with damage at or above Willpower is banished. A
    banish from challenge damage or ability damage since the last check counts as banished
    "by" the character that dealt it.
  *Engine:* one function, `stateCheck`, called at exactly those points. See Rulings below on
  1.8.1.5, which the text refers to but does not list.
- **1.8.2, 1.8.3** Triggers caused by a check go into the bag but resolve only after the check
  loop settles; the check repeats until nothing changes, then the bag resolves, then it checks
  again. *Engine:* loop `stateCheck` to fixpoint before each bag pick.
- **1.8.4** Several conditions found in one check apply simultaneously, in turn order across
  players. *Engine:* collect all banishes first, then move them together.
- **1.8.5** Conditions are tested only when the check runs. A character that was over its
  limit mid-effect but is fine at check time survives. *Engine:* never banish eagerly inside an
  effect; always defer to `stateCheck`.

### 1.9 Damage
- **1.9.2** Damage reaches a card by being dealt, put, or moved; it leaves by being removed
  or moved away. Moving is remove plus put, and cannot return damage to the card it left
  within the same effect.
- **1.9.3** A card "takes" damage whenever any counters arrive, by any route.
- **1.9.4** Total damage: base (effect text, or Strength in a challenge), then modifiers, then
  the result is final. All damage from one challenge or one effect lands at the same time.
  *Engine:* `dealDamage(source, targets, base)` computes base, runs damage modifiers (Resist
  and card replacement effects), then places counters for all targets together.
- **1.9.5** Damage reduced to zero was still "dealt", so "deals damage" triggers fire, but the
  target "takes" none, so "takes damage" triggers do not. *Engine:* two separate event kinds,
  `dealt` (pre-modifier intent) and `took` (counters actually placed).
- **1.9.6** Counters vanish when the card leaves play. *Engine:* zeroing damage is part of
  `move` out of play.

### 1.10 Materials
- **1.10.1.1** Constructed deck: at least 60 cards, at most two ink types, at most 4 copies of
  any one full name (name plus version), nothing banned. *Engine/deck builder:* validate
  against these four; the banned list comes from the format legalities in the card data.
- **1.10.1.3** Some cards change deck-building limits for other cards but only if the card itself
  fits. *Engine:* deck validator needs a per-card hook; none is needed unless a pool card does
  this (audit).

### 1.11 Lore
- **1.11.1** Lore starts at 0 and cannot go below 0. *Engine:* `gainLore` clamps at 0 on loss.
- **1.11.2** A questing character gives its Lore value; a location gives its value at the start
  of its player's turn (Set step). A Lore value of 0 or less gives nothing.
- **1.11.3** Reaching 20 wins (see 1.8.1.1).

### 1.12 Drawing
- **1.12.1, 1.12.2** Draw only from your own deck, one at a time. *Engine:* `draw n` loops
  `move` of the top card; triggers such as "whenever you draw" see each draw separately.
- **1.12.3** "Put into hand" is not drawing. *Engine:* separate door call with no draw event.

---

## 2. Gameplay

### 2.1 General
- **2.1.2, 2.1.3** Starting player is picked by a random method; order alternates.
  *Engine:* `newGame({first})`: 0, 1, or seeded random.
- **2.1.3.1, 2.1.3.2** Series: loser of the previous game picks to start (play/draw).
  *Engine:* optional rematch flow; UI may default to the loser starting.

### 2.2 Setup stage
- **2.2.1.2** Each deck is shuffled. *Engine:* seeded shuffle inside `newGame`.
- **2.2.1.3, 2.2.1.4** Everyone starts at 0 lore and draws 7.
- **2.2.2** Alter hand (mulligan), once per player, starting player first. A player sets aside
  any number of hand cards to the bottom of the deck, unseen, then draws back up to 7.
  Afterwards each player who changed at least one card shuffles their deck.
  *Engine:* a `mulligan` phase with one action per player carrying the set of hand cards to
  put back (possibly empty). Order of operations matters: bottom first, draw replacements from
  the top, and only then shuffle, so replacements cannot be the cards just put back unless the
  deck was tiny.
- **2.2.3** Setup ends and the starting player's Start-of-Turn Phase opens.

### 2.3 In-game stage
- **2.3.3** The game ends when someone has 20 lore, ends a turn with an empty deck, or concedes.
  *Engine:* `endReason` values `lore`, `deckout`, `concede` (`docs/ENGINE-API.md`).

---

## 3. Turn structure

- **3.1** Three phases in order: Start-of-Turn, Main, End-of-Turn.
- **3.2.1 Ready**
  - **3.2.1.1** Ready everything the active player has in play and in the inkwell.
  - **3.2.1.2** "During your turn" effects begin to apply.
  - **3.2.1.3** "Until the start of your (next) turn" effects end.
  - **3.2.1.4** "At the start of your turn" triggers (and any Ready-step triggers) enter the bag
    but do not resolve yet.
  *Engine:* durations are stored with an expiry event (`turnStart(seat)`, `turnEnd`).
- **3.2.2 Set**
  - **3.2.2.1** The active player's characters stop drying.
  - **3.2.2.2** Lore is gained from locations in play. Not a trigger; skips the bag.
  - **3.2.2.3** Then the bag resolves.
  *Engine:* order is fixed: dry, location lore, resolve bag. A game state check follows each
  step (1.8.1).
- **3.2.3 Draw**
  - **3.2.3.1** The active player draws one. The starting player skips this on turn one.
  - **3.2.3.2** The Main Phase begins when the bag is empty.
  *Engine:* skip-draw is a game-wide flag for the first turn, plus a card-level "skip your Draw
  step" static effect (6.4.3).
- **3.3.2** The active player may declare end of turn at any time in the Main Phase, except
  while a turn action is mid-process or the bag is non-empty (3.3.2.1). Reckless adds another
  restriction (8.7.3). *Engine:* `endTurn` appears in `legalActions` only when those checks pass.
- **3.4.1.1** First, "at the end of the turn" and "at the end of your turn" triggers go in the
  bag and resolve.
- **3.4.1.2** Then "this turn" effects end (Support's bonus included), and triggers from that
  also resolve.
- **3.4.2** After the bag empties, the turn ends with a final game state check, and the next
  player becomes active. (The text's cross-reference says 1.9.1; it means 1.8.)

---

## 4. Turn actions

- **4.1.1 to 4.1.5** Six turn actions, any number of times in any order, except inking, which is
  limited. Each one finishes completely, and its triggers resolve, before the next begins.
  A trigger created mid-action waits until the action's process is complete.
  *Engine:* every `apply` is one whole turn action followed by bag resolution and state
  checks. If a part is impossible, the action is simply not offered (4.1.4).

### 4.2 Ink a card
- **4.2.1** Choose a card with the inkwell symbol, reveal it, others verify, put it into the
  inkwell facedown and ready.
- **4.2.3** Once per turn. **4.2.3.1** "Additional" ink allowances stack with the base
  allowance and do not reset by replaying the source. **4.2.3.2** Effects that put a card
  straight into the inkwell do not use the allowance and do not reveal the card.
  *Engine:* `inkedThisTurn` counter against `allowance = 1 + extras`; effect-inking calls
  `move` to inkwell directly, with no inkwell-symbol check (7.5.6) and no reveal event.
  The revealed card goes into the log for the opponent.

### 4.3 Play a card
- **4.3.2.1 to 4.3.2.4** Announce and reveal; choose the payment route; compute the total cost
  (cost or alternate cost plus payment modifiers); pay it in full by exerting that many ready
  ink cards, plus any other costs. Only the active player may do this, from hand, unless text
  says otherwise.
- **4.3.3** Characters, items, locations enter the Play zone (a shifted character lands on top
  of its target). Actions enter the Play zone, resolve at once, then go to the discard
  (**4.3.3.2**, **6.7.1.2**).
- **4.3.4** After the whole process, bag triggers resolve. **4.3.4.1** "When you play this"
  triggers fire as the card enters play (step 4.3.3) even though other triggers wait.
  **4.3.4.2** Same timing for "whenever a card is played" watchers when the played card is put on
  top of another (shift).
  *Engine:* play = pay, then move to play, then raise `played` event, then resolve the bag.
- **4.3.5** Cost-changing effects like Singer do not alter the card's printed cost.
- **4.3.6** "Next [type] you play this turn" payment modifiers apply to the next card of that type
  even if it was played by an alternate cost or for free. Self-referential modifiers work from
  outside play on that card only. *Engine:* modifiers carry a `scope` (`self`, `next-of-type`,
  `while-in-play`) and an expiry.

### 4.4 Use an activated ability
- **4.4.2** An ability that exerts a character needs that character dry. Item and location
  abilities work the turn they come into play (see 5.5.4, 5.6.4).
- **4.4.3** Steps: announce, choose route (ink or alternate), total the cost, pay it. A "for
  free" activation still pays the exert cost. Only the active player.
- **4.4.4, 4.4.5** The effect resolves immediately; triggers it caused resolve afterwards.
  Activated abilities do not use the bag (7.7.2).
  *Engine:* an `activate(iid, abilityIndex)` action; costs paid by `pay` before effect runs;
  Boost (8.4) uses this same timing.

### 4.5 Quest
- **4.5.1** Only characters. Steps: declare; check limiters (drying, Reckless, "can't quest")
  and pay any costs; exert; gain lore equal to Lore value (negative counts as 0, 4.5.3.1).
- **4.5.2, 4.5.3** The character then counts as having quested; its triggers resolve afterwards.
  *Engine:* `quest(iid)` offered only if dry, ready, and not barred. `gainLore` reads
  `chars(...).lore` clamped at 0 (6.6.3).

### 4.6 Challenge
- **4.6.1, 4.6.2** Only characters challenge. Only the challenger and the defender are "in" the
  challenge.
- **4.6.3** Two steps: Declaration, then Damage.
- **4.6.4 Declaration**
  - **4.6.4.1** The challenger must have been in play since the Set step and be ready.
  - **4.6.4.2** The defender must be an exerted opposing character (or a location, 4.6.8).
  - **4.6.4.3** Challenge limiters are checked (Evasive, Bodyguard, "can't be challenged"),
    choices made, costs paid.
  - **4.6.4.4** The challenger exerts. If something readies it mid-challenge it stays in.
  - **4.6.4.5** "While challenging" effects start.
  *Engine:* legal defenders = exerted opposing characters, minus those barred by limiters; if
  any opposing Bodyguard-capable defender exists, restrict (8.3.3).
- **4.6.5** Triggers from challenging or being challenged resolve from the bag, then the Damage
  step begins.
- **4.6.6 Damage**
  - **4.6.6.1** Compute each side's damage from its Strength. Negative Strength counts as 0.
  - **4.6.6.2** Both sides deal simultaneously.
  - **4.6.6.3** A game state check follows.
  *Engine:* both `dealDamage` calls computed before either applies; reductions (Resist) are
  per receiver; check state afterwards.
- **4.6.7** After the Damage step and an empty bag, "while challenging/being challenged"
  effects end, "after the challenge" abilities fire, then play continues.
- **4.6.8** Locations can be challenged any time in the Main Phase, are neither ready nor
  exerted, and deal no damage back. *Engine:* not implemented (PLAN D14).
- **4.6.9** If a character in a challenge leaves it, the challenge ends: remaining bag items
  resolve, then the same cleanup as 4.6.7.

### 4.7 Move a character
- **4.7** Move your own character to your own location by paying its move cost. *Engine:* not
  implemented (PLAN D14); no `move` action exists in `legalActions`.

---

## 5. Cards and card types

### 5.1 Card states
- **5.1.1.1, 5.1.1.2** Ready is upright; exerted is turned. An exerted card still uses abilities
  that do not require exerting it. Characters and items enter ready.
- **5.1.1.3, 5.1.1.4** Damaged means at least one counter.
- **5.1.1.5 to 5.1.1.8** A card under another card is not "in play" and cannot be chosen.
  Only the top card of a stack is in play. If the top card leaves, the cards under it go to the
  same zone and take that zone's states. *Engine:* a stack is `{top, under: [iid...]}`; `move`
  of the top carries the stack.
- **5.1.1.11, 5.1.1.12** Drying (entered this turn) cannot quest, challenge, or pay an exert
  cost; dry can. Items have no drying.
  *Engine:* a character gets `drySince` when readied at turn start; `dry` is derived.
  The glossary adds that non-activated abilities, including "when you play this", still work
  while drying.
- **5.1.2.1 to 5.1.2.7** Which states each type/zone can hold: characters enter ready,
  undamaged, drying; items ready (no damage); locations undamaged (no ready/exerted); inkwell
  cards ready or exerted, facedown; deck facedown; discard faceup; hand has none.
- **5.1.3** State changes are immediate. A shifted character takes states from the card it sits
  on (details under 8.10).

### 5.2 Parts of a card
- **5.2.3** The inkwell symbol marks inkable cards; every ink card counts as 1 ink.
- **5.2.5, 5.2.5.1** Six inks. A two-ink card counts as both.
- **5.2.6, 5.3.6.1** Name matching ignores the version; full name is name plus version.
  *Engine:* "named X" effects compare the name line only; deck limits use full name.
- **5.2.6.1 to 5.2.6.3** A character with two names joined by an ampersand is one card that has
  three names: each half and the pair. A lookup for "Flotsam" matches the pair card; a lookup
  for the pair does not match a card that is only Flotsam. The one character written without the
  ampersand (Chip 'n' Dale) is treated as if it had one. *Engine:* `names(def)` returns an
  array and matching is "the specified name equals any entry". The data build must split
  two-name cards; check this when one enters the pool.
- **5.2.7** Classifications are referenced by other cards.
- **5.2.8 to 5.2.10** Story names, flavor, artist, collector number are not gameplay.

### 5.3 Characters
- **5.3.3** A card is a character only if it has Strength and Willpower and at least one of the
  listed classifications (Alien through Whisper; the list in 5.3.3.2 includes the four new
  ones: Boss, Red Panda, Team, Vineling). *Engine:* derive card type from the data's type
  field; classification list is data, not code.
- **5.3.4, 5.3.5** Only characters quest or challenge, and only when dry.
- **5.3.6.2** Negative or zero Strength deals nothing in a challenge.
- **5.3.6.3** Damage persists and banishes at Willpower (1.8.1.4).

### 5.4 Actions
- **5.4.1.2** Played from hand; effect resolves immediately; the action sits in Play until it
  finishes, then goes to the discard. Its effect does not use the bag.
- **5.4.4 Songs** An action with the Song classification may be played by exerting a character
  of cost N or higher (N is the song's cost) instead of paying ink. *Engine:* every song gets a
  `sing` payment route per eligible dry, ready character; Singer (8.11) changes the effective
  cost; Sing Together (8.12) allows several.
- **5.4.5** Triggers from playing an action wait until it finishes (4.3.4).

### 5.5 Items
- **5.5.3, 5.5.4** An item's activated ability works the turn it enters play.

### 5.6 Locations
- **5.6.x** Landscape cards with move cost, Willpower, optional Lore; characters at a location
  stay in play if it leaves (5.6.6). *Engine:* not implemented (PLAN D14); effects mentioning
  locations find no targets.

---

## 6. Abilities, effects, and resolving

### 6.1 General
- **6.1.1, 6.1.2** An effect is one sentence's worth of resolution; an ability's effects resolve
  in written order, all within one resolution. *Engine:* an ability script is a sequence of
  steps run to completion inside one `resolve`.
- **6.1.3** Choices are made as the effect resolves. "Up to N" may be 0 and cannot repeat a
  pick. Separate "chosen" words in one effect may pick the same card.
  *Engine:* `ask` with `{min, max, distinct}`; see D10.
- **6.1.3.1, 6.7.3** A requirement is what must be chosen; a limiter narrows it. Legality is
  checked in order: pay ink costs, make the choice, check limiters. *Engine:* candidate lists
  are built by filtering the pool through all limiters before the player is asked, so a choice
  can never be illegal.
- **6.1.4** "May": the player decides at resolution; declining means that sentence does
  nothing and others still happen. **6.1.4.1** A "may" with a cost the player cannot pay is the
  same as declining. *Engine:* `ask` with yes/no, even when the answer seems obvious (CLAUDE.md
  rule 4); an unpayable cost removes the yes option.
- **6.1.5** Sequential effects: "[A] to [B]", "[A] or [B]", "[A]. If you do, [B]". **6.1.5.1**
  For "to" and "if you do", [A] is required as part of resolving and must be fully completed or
  [B] does not happen; paying ink in [A] happens at resolution. **6.1.5.2** For "or", the
  player must take one branch; if only one is possible, take it. Anything with an ink payment
  in [A] is a cost, not an effect. *Engine:* step runner returns `{done: bool}` from [A];
  [B] runs only on `done`.
- **6.1.6** "Another"/"other" excludes the source or already-chosen cards.
- **6.1.7, 6.1.7.1** "For free" plays and activations: see 1.5.5. Triggers from a free play wait
  until the instructing effect finishes.
- **6.1.8, 6.1.8.1** "For each" counts once at resolution for non-static abilities, continuously
  for static ones. A "draw/discard until" count is taken once at resolution.
  *Engine:* static abilities read the live count through `chars`; resolving effects snapshot it.
- **6.1.10** Loops: players may announce a number of iterations. *Engine:* not modelled; each
  iteration is a separate action by the player.
- **6.1.11, 6.1.11.1** "That card" refers to one specific card; if it changed zones, that part
  of the effect fails even if an identical card is present. *Engine:* effects store card
  instance ids, never names, for "that" references.
- **6.1.12** Some abilities function outside play (cost reducers in hand, triggers that watch
  the discard). *Engine:* each ability declares `zones`.
- **6.1.13 Durations**
  - **6.1.13.1 during** applies only in that window ("during your turn").
  - **6.1.13.2 once** runs one time per period, tracked per ability instance (two copies each
    count separately).
  - **6.1.13.3 until** runs from the moment generated to the named moment.
  - **6.1.13.4 this turn** ends in the End-of-Turn Phase just before the turn passes.
  - **6.1.13.5 while** applies only while the condition holds.
  - **6.1.13.6** Combined durations apply only while all hold.
  *Engine:* per-effect `expires` event plus a re-evaluated `condition`; `once` keeps a
  per-instance fired-this-period flag keyed by ability instance, not by ability name.
- **6.1.14** Reveal shows the face of cards, only from the group the effect names; they stay
  revealed only while the effect applies.
- **6.1.15, 6.1.16** Conditional effects tied by "unless" (applies while the condition is false)
  or "if" (applies while true). Triggered abilities with "if" check the condition at resolution
  (6.2.4).

### 6.2 Triggered abilities
- **6.2.1** Each trigger condition met triggers once.
- **6.2.2** Starts with "when", "whenever", "the first/second/next time", "at the start of", "at
  the end of".
- **6.2.3** A met condition puts the ability in the bag.
- **6.2.4** "[Trigger], if [condition], [effect]": the condition is checked only when the effect
  resolves; false means no effect. *Engine:* condition evaluated in the step runner, not at
  trigger time.
- **6.2.5** Multiple sentences after one trigger are independent effects.
- **6.2.6** "[Trigger] and [Trigger], [effect]" is two independent triggers with one effect.
- **6.2.7.1** Floating triggers (exist for a duration, outside the bag, add an instance when
  met) and **6.2.7.2** delayed triggers (created now, fire at a later named moment). *Engine:*
  a `floating` list on state, each with condition and expiry; delayed ones are the same list
  with a one-shot flag.

### 6.3 Activated abilities
- **6.3.1** Written "cost -- effect"; usable in the Main Phase. **6.3.1.1** Exert-cost on a
  character needs dry; ability without exert cost works the turn the character is played.
- **6.3.2** Usable only while nothing is waiting to resolve and the character is not mid-quest
  or mid-challenge.
- **6.3.3** Triggers from paying or resolving it wait until its effect finishes.

### 6.4 Static abilities
- **6.4.1** Continuous modifiers of characteristics, rules or state, lasting for a stated
  duration or as long as the source is in play.
- **6.4.2.1** A continuous effect from a resolved effect covers everything it can affect, including
  cards that arrive later (e.g. "your characters can't be challenged until ..."). **6.4.2.2** An
  applied effect covers only cards in play at resolution (e.g. "all characters get -3 Strength").
  **6.4.2.3** A card in play generates a continuous effect for as long as it stays, covering
  later arrivals. *Engine:* two flavours of timed modifier: `continuous` (evaluates a filter
  at every `chars` call) and `applied` (stores the list of affected iids at resolution).
- **6.4.3** "Skip" effects are static; if the step has already started it is not skipped.

### 6.5 Replacement effects
- **6.5.1 to 6.5.5** An effect with "instead" swaps the event before it happens; the replaced
  event never happens, so nothing triggers off it; the modified event can trigger and be
  replaced again, but each replacement effect gets one chance on a given event.
- **6.5.6, 6.5.7** Self-replacements apply first. Then the player whose cards are affected
  chooses among the other replacements, repeating until none apply. *Engine:* `dealDamage` and
  other doors run an event through a replacement pipeline; the choice is `ask`ed of the affected
  player.
- **6.5.8** Two instances of the same replacement effect cannot both apply to one event; the
  affected player picks one and the others vanish.

### 6.6 Ability modifiers
- **6.6.1** Modifiers apply immediately without the bag; they combine in no particular order.
  *Engine:* `chars` sums all active modifiers fresh each call; never store the sum.
- **6.6.2, 6.6.3** A negative Strength or Lore value counts as 0 for effects that read it, but
  stays negative as a number for further modifiers (so +1 on -1 gives 0, not 1).
- **6.6.4** A "can't be reduced below" floor applies after summing.

### 6.7 Resolving cards and effects
- **6.7.1** Played cards resolve as in 4.3.3.
- **6.7.2** Resolving an effect, in order: (1) count any "for each" number and check a
  secondary "if" (making any choices that condition needs; false means nothing happens);
  (2) if the effect deals damage, make its choices first, then compute total damage per 1.9.4;
  (3) perform the instructions, choosing whatever is left to choose, with all damage dealt
  simultaneously and replacements applying. Any ink payment is made in the step that needs it.
  *Engine:* three-phase resolver in this order; choices for damage targets are asked before
  damage is calculated.
- **6.7.4, 6.7.5** Triggers raised during resolution wait until the whole card or ability
  finishes; a state check follows.
- **6.7.6** When an effect needs several players to act, the active player acts first, then
  others in turn order, all as one resolution.
- **6.7.7** "Last known information": if a card has left play, effects use its characteristics as
  they were just before. *Engine:* `move` out of play snapshots `chars` into the event payload.
- **6.7.8** A card played during another effect resolves its own effects as part of that
  instruction; triggers from it wait until the instructing action or ability finishes, with an
  action's own effect going first (6.7.8.1).
- **6.7.9** "Enters play with ..." effects resolve as the card enters; there is no moment
  without them. *Engine:* an `enterPlay` hook runs inside `move`, before the arrival event.

---

## 7. Zones

- **7.1.2, 7.1.3** Public zones: play, discard, bag. Private zones: hand, deck, inkwell. Counts
  of private zones are always public. *Engine:* the UI never receives hidden ids; it receives
  counts.
- **7.1.4** Searching a private zone may fail; searching a public one may not (a player must
  pick a legal card if one exists). *Engine:* "look for" effects over discard or play have no
  "find nothing" option when a match exists.
- **7.1.5** A card is in one zone at a time; only Play counts as in play.
- **7.1.6** A card leaving play loses all gained effects, damage and other gained features and is
  a new object. *Engine:* `move` strips timed modifiers keyed to the old instance; effects that
  refer to "that card" in its new zone track the iid through 6.1.11.
- **7.2.2, 7.2.3** The deck is private and facedown; its order cannot be changed by players. If
  face-up cards go to the top or bottom "in any order", their order must be known to all. See
  Rulings and DEVIATIONS.
- **7.3.3, 7.3.4** No maximum hand size. Discarding is the owner's choice from hand.
- **7.4.1, 7.4.2** Actions are in Play only while resolving. A facedown card in Play is private
  (7.4.2.1).
- **7.4.3** When cards leave play, "leaves play" and "banished" triggers see every card leaving
  at the same moment, including each other. *Engine:* gather triggers against the pre-move state
  for the whole batch (see 1.8.4).
- **7.5.1 to 7.5.6** Inkwell: private, facedown, each card is 1 ink, no size limit. Cards enter
  ready. Cards put in by an effect need no inkwell symbol and are not revealed. *Engine:* the
  inkwell stores iids only; the UI shows backs and counts.
- **7.6.1 to 7.6.3** Discard is public, faceup, one pile; players may look at and reorder their
  own. Cards entering together go in the order their player chooses. See Rulings.
- **7.7 The bag**
  - **7.7.1, 7.7.2** Only triggered abilities wait in the bag. Played cards, activated abilities
    and action effects never do.
  - **7.7.3.1** Whoever's card generated the trigger adds it. Triggers met together are added
    together; those met mid-effect wait until the effect finishes.
  - **7.7.4** Resolving order: if the active player has triggers in the bag, they choose one
    and fully resolve it (including its state check). If they still have triggers, they pick
    the next. When they have none, the bag passes to the next player in turn order, who does the
    same. Repeat until empty.
  - **7.7.5, 7.7.6** A new trigger from the player currently resolving is seen immediately and
    may be picked next. One from a player who is not resolving waits for that player's turn to
    pick.
  - **7.7.7** If a player leaves the game, their triggers vanish.
  *Engine:* `bag` is a list `{seat, source, ability, payload}`. The loop is: `stateCheck` to
  fixpoint; pick the resolving seat per 7.7.4; if that seat has more than one trigger, `ask` it
  which first (a single trigger is still shown but no choice is invented); resolve; repeat.
  Never auto-pick order between two of the active player's triggers.

---

## 8. Keywords

- **8.1.2** Keywords written with "+N" stack by adding; those without do not (a second copy of
  Support does nothing). *Engine:* `chars` stores keywords as a map; stackable ones sum.

| CR | Keyword | What it does (our words) | Engine |
|---|---|---|---|
| 8.2 | Alert | Ignores the Evasive restriction on who may challenge it. Does not grant Evasive. | Check Evasive limiter in challenge legality: skip if the challenger has Alert. |
| 8.3 | Bodyguard | When played, its owner may choose to have it enter exerted. While in play, opponents who challenge must pick a Bodyguard character if any can legally be picked. | Play-time `ask` yes/no for exerted entry (also with Shift). Defender list filters to Bodyguards when any is a legal defender. |
| 8.4 | Boost N | Once on your turn, pay N ink to put your deck's top card facedown under this card. Usable whenever an activated ability could be used. | A once-per-turn action using activated-ability timing. The card under is hidden from everyone, not in play, and not "played" (8.4.3). Ruling needed for an empty deck. |
| 8.5 | Challenger +N | While this character is the challenger it gets +N Strength; not when defending. | Modifier active only in the challenge role (during Declaration through Damage). |
| 8.6 | Evasive | Can't be challenged except by another Evasive character. | A challenge limiter on the defender. |
| 8.7 | Reckless | Can't quest. You can't end your turn while it is ready and could challenge something. May still exert for abilities or songs. | Remove `quest` for it. `endTurn` is illegal if any ready Reckless character has a legal challenge target. |
| 8.8 | Resist +N | Damage dealt to it is reduced by N, to a minimum of nothing taken. Does not reduce damage that is put or moved onto it. | A damage modifier inside `dealDamage` for the `deal` path only; `put` and `move` skip it (1.9.2, 8.8.3). |
| 8.9 | Rush | May challenge the turn it comes into play, as if dry. Does not allow questing or exert costs. | Treat as dry for the challenge-legality check only. |
| 8.10 | Shift N (variants) | Pay the Shift cost instead of the ink cost to put this card on top of a same-named character you control. | See below. |
| 8.11 | Singer N | Counts as cost N, only for exerting to sing songs. | Effective sing cost = the Singer number plus any "counts as +N cost to sing" effects (8.11.3), instead of the printed cost. |
| 8.12 | Sing Together N | A song with this may be sung by exerting any number of your ready characters whose costs total at least N. | A `sing` payment route over subsets; "whenever this sings a song" triggers fire for each singer (8.12.3). |
| 8.13 | Support | When this quests, you may add its Strength to another chosen character's Strength this turn. | Trigger with `ask` yes/no then `ask` target; modifier expires at end of turn (3.4.1.2). |
| 8.14 | Vanish | When an opponent chooses it as part of resolving an action's effect, it is banished (after the action finishes). | Trigger fires on being chosen by an opposing action's effect; no effect if it already left the zone (8.14.2). |
| 8.15 | Ward | Opponents can't choose it when resolving an effect. Effects that don't choose still hit it. | Filtered out of every opposing `ask` candidate list when resolving an effect (8.15.1). Effects that choose nothing, such as "all" or "each", still hit it (8.15.2). A challenge is a turn action, not an effect, so Ward does not stop it. |

**Shift details (8.10)**
- **8.10.1** Shift is an alternate cost; the shifted card lands on top of a same-named character
  and does not gain its text.
- **8.10.2 to 8.10.4** Entering exerted if the card underneath is exerted; entering exerted when
  the shifted card's own text says so; dry if the card underneath was dry, drying otherwise.
  8.10.4.1 and 8.10.4.2 cover non-character bases and two-card bases.
- **8.10.5** A shifted character can take all turn actions the base could and keeps modifiers
  that applied to the base on entry; it can sing only if the base was dry.
- **8.10.6** Damage on the base stays.
- **8.10.7** If the stack leaves play, every card in it moves to the same zone.
- **8.10.8 variants** Classification Shift (any character with the named classification),
  Universal Shift (any character), Duo Shift (put on two characters, each sharing a name),
  Combo Shift (Shift or Duo Shift), Temporary Shift (returns to hand at end of turn with its
  damage removed), Potato Shift (onto an item named Potato).
- **8.10.9** Combined variants require every condition.
  *Engine:* `shiftTargets(def)` returns legal base sets per variant; the Shift play route
  carries the chosen base iids; hands the dry/exerted derivation to `move`.

---

## 9. Multiplayer and 10. Casual variants

- **9, 10** Not implemented: two-player only, Constructed only. Pack Rush (15 lore, 5-card
  hand, shuffle-discard instead of deck-out) is not offered.

---

## Rulings we had to make

Places where the Comprehensive Rules are silent, contradictory, or point at something missing.
Each states what the engine does until corrected.

1. **1.8.1.5 is cited but absent.** The 1.8.3 examples cite "1.8.1.5" for a location being
   banished at Willpower; the list in 1.8.1 stops at 1.8.1.4, which covers characters and
   locations together. Ruling: 1.8.1.4 covers both. No effect today (D14).
2. **3.4.2 cross-reference.** It points to "1.9.1" for the final game state check; 1.9.1 is
   about damage counters. We read it as 1.8.
3. **Drawing from an empty deck.** The rules lose a player only when their turn ends with an empty
   deck (1.8.1.2); nothing says a draw from an empty deck loses at once. Ruling: the draw does
   nothing (1.2.3) and the player loses at end of turn only if the deck is still empty.
4. **Boost with an empty deck.** 8.4.1 has the player put the top card under this one; nothing
   covers an empty deck. Ruling: the ability can't be activated (the effect has nothing to do)
   rather than allowing a payment for nothing. Verify against official rulings.
5. **Order of cards going to the discard together (7.6.3) and to the deck "in any order"
   (7.2.3).** The player arranges; we do not ask. Discard uses play order, banished-together
   cards in the order the state check found them; the "rest on the bottom" case is listed in
   `DEVIATIONS.md`. We have not verified that no pool card cares about discard order.
6. **1.2.3 versus 6.1.5.1.** The first says do as much as you can; the second says a sequential
   "[A] to [B]" stops if [A] cannot be fully done. Ruling: 6.1.5.1 is the specific rule and wins
   for sequential effects; 1.2.3 governs everything else.
7. **When a "may" ink payment is asked.** 6.1.4.1 treats an unpayable cost as declining; 6.7.2
   says ink is paid in the step that needs it. Ruling: offer the yes option only if the ink is
   currently payable, and pay when the step runs.
8. **Bag choices belong to whom.** 7.7.4.2 lets the active player pick the order of their own
   triggers; 7.7.6 says an opponent's trigger waits for that player's turn to pick. Ruling:
   when two non-active triggers are pending the opponent's seat is asked, even in AI-vs-AI
   or hot-seat, so the seat that owns the card decides.
9. **Reckless and an empty challenge pool.** 8.7.3 says you can't end your turn while a
   ready Reckless character "can challenge an opposing character or location." Ruling: true
   when at least one legal defender exists after Evasive, Bodyguard and Ward-like limiters;
   otherwise ending is allowed.
10. **Shift base chosen mid-play.** 8.10 says "another character you have in play with the
    same name"; with two eligible bases the player picks, and the pick matters for dry, ready and
    damage. We ask the player; no tie-break by state.
11. **Glossary versus body text on the Ready step.** The glossary says "at the start of your
    turn" triggers "wait until the Set step to start resolving"; 3.2.1.4 and 3.2.2.3 say the
    same. No conflict, but note the location-lore gain (3.2.2.2) comes before those triggers
    resolve; the engine follows the body text order.
12. **Banned cards.** 1.10.1.1 forbids banned cards but the rules do not list them. Ruling:
    legality comes from the format legality in the card data at fetch time.
13. **Rules examples name specific cards.** The numbered rule is the authority; where an example
    seems to read differently from its rule, the engine follows the rule.
