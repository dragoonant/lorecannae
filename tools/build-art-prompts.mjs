// Builds tools/art/art-prompts.json: one prompt per card in data/cards.js plus the UI plates.
// PLAN.md D17 (supersedes D3): every card shows its ACTUAL character, MGSD proportions,
// feature-animation direction; the owner picked FLUX.1 dev with name + description.
// Card prompt = WHO clause (keyed by character Name; starts with the name) + per-card act + setting
//               + STYLE. Items/actions/songs = subject + setting + STYLE.
// UI prompt   = subject + setting + "empty place" clause + UI_STYLE.
// The lint REFUSES to write the file on any violation (kb/LESSONS-DIGEST.md §8) and lints STYLE too:
//   text-magnet nouns (a card may `allow` words its subject cannot avoid; QC checks those plates),
//   negations, counts above two, studio/film/game titles as text, > 900 chars;
//   UI prompts also refuse castle words (D16).
// Character names are allowed since D17 (the audition showed no lettering from them).
//   node tools/build-art-prompts.mjs            # lint + write
//   node tools/build-art-prompts.mjs --selftest # prove the lint bites, then exit
//   node tools/build-art-prompts.mjs --show <id> # print one prompt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLE, UI_STYLE, MODEL } from './art/style.mjs';
import { WHO } from './art/who.mjs';
import { CARDS } from './art/scenes.mjs';
import { UI, UI_EMPTY } from './art/ui.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/art/art-prompts.json');
globalThis.LC = globalThis.LC || {};
await import(pathToFileURL(path.join(ROOT, 'data/cards.js')).href);
const C = globalThis.LC.CARDS;

// ---- lint vocabulary
const MAGNETS = ['sign', 'signs', 'signpost', 'signboard', 'banner', 'banners', 'book', 'books', 'bookish', 'bookshelf', 'bookshelves', 'spellbook', 'guidebook', 'scroll', 'scrolls', 'letter', 'letters', 'lettering', 'label', 'labels', 'logo', 'logos', 'emblem', 'emblems', 'crest', 'crests', 'map', 'maps', 'screen', 'screens', 'poster', 'posters', 'cover', 'covers', 'title', 'titles', 'page', 'pages', 'flag', 'flags', 'insignia', 'nameplate', 'text', 'word', 'words', 'newspaper', 'glyph', 'glyphs', 'rune', 'runes', 'plaque', 'inscription', 'inscribed', 'writing', 'written', 'calligraphy', 'card', 'cards', 'frame', 'library', 'menu', 'storybook', 'caption', 'signature', 'chalkboard', 'blackboard', 'clipboard', 'note', 'notes', 'contract', 'treaty', 'manuscript', 'parchment', 'alphabet', 'typography', 'font', 'watermark', 'clock', 'clockface', 'marquee', 'billboard'];
const NEGATIONS = ['no', 'not', 'never', 'without', 'lack', 'lacking', 'none', 'nothing', 'nobody', 'nor', 'neither', 'cannot', 'cant', 'dont', 'isnt', 'doesnt', 'wont'];
const COUNTS = ['three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'twenty', 'thirty', 'hundred', 'hundreds', 'thousand', 'thousands', 'dozen', 'dozens', 'trio', 'triplet', 'triplets', 'triple', 'quartet', 'third', 'quarter'];
// Studio, film and game titles (as text they invite logos). Words that are also a character's name
// in the pool (Dumbo, Pocahontas, Mulan, Aladdin, ...) stay allowed.
const TITLES = ['disney', 'pixar', 'lorcana', 'ravensburger', 'illumineer', 'illumineers', 'marvel', 'lucasfilm', 'dreamworks', 'ghibli', 'miyazaki', 'artstation', 'rutkowski', 'frozen', 'encanto', 'zootopia', 'incredibles', 'ducktales', 'gargoyles', 'tangled', 'hercules', 'fantasia', 'pinocchio', 'atlantis', 'storyborn', 'dreamborn', 'floodborn', 'glimmer', 'inkwell', 'lore'];
const TITLE_PHRASES = ['toy story', 'lion king', 'little mermaid', 'sleeping beauty', 'snow white', 'jungle book', 'robin hood', 'treasure planet', 'black cauldron', 'turning red', 'monsters inc', 'rescue rangers', 'hundred acre', 'beauty and the beast', 'fox and the hound', 'goof troop', 'goofy movie', 'big hero', 'wreck it', 'inside out', 'great mouse detective', 'emperors new groove', 'lilo and stitch', 'three quarter', 'card frame', 'ink bottle label', 'storybook page'];
const UI_BANNED = ['castle', 'castles', 'palace', 'palaces', 'spire', 'spires', 'turret', 'turrets', 'citadel', 'kingdom'];

const norm = s => ' ' + s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const BANNED = new Map();
for (const w of MAGNETS) BANNED.set(w, 'text magnet');
for (const w of NEGATIONS) BANNED.set(w, 'negation');
for (const w of COUNTS) BANNED.set(w, 'count above two');
for (const w of TITLES) BANNED.set(w, 'studio/film/game title');

function lintText(what, text, problems, allow = [], extra = []) {
  const n = norm(text);
  for (const w of n.trim().split(' ')) {
    if (BANNED.has(w) && !allow.includes(w)) problems.push(`${what}: "${w}" (${BANNED.get(w)})`);
    if (extra.includes(w)) problems.push(`${what}: "${w}" (castle trade-dress risk on UI art)`);
    if (/^\d+$/.test(w) && +w > 2) problems.push(`${what}: "${w}" (count above two)`);
  }
  for (const p of TITLE_PHRASES) if (n.includes(' ' + p + ' ')) problems.push(`${what}: "${p}" (title phrase)`);
  if (/\bn['’]t\b/i.test(text)) problems.push(`${what}: contraction negation`);
}

export function buildAll() {
  const problems = [];
  lintText('STYLE', STYLE, problems); lintText('UI_STYLE', UI_STYLE, problems); lintText('UI_EMPTY', UI_EMPTY, problems);
  for (const [k, v] of Object.entries(WHO)) lintText('WHO ' + k, v, problems);
  const prompts = {};
  for (const id of Object.keys(C).sort()) {
    const c = C[id], e = CARDS[id];
    if (!e) { problems.push(id + ': no CARDS entry (no generic fallback)'); continue; }
    const allow = e.allow || [];
    let lead;
    if (/Character/.test(c.type)) {
      const names = e.who ? [e.who] : (WHO[c.name] ? [c.name] : c.name.split(/\s*&\s*/));
      const clauses = names.map(n => WHO[n]);
      if (clauses.some(x => !x)) { problems.push(id + ': no WHO entry for ' + names.join(' / ')); continue; }
      if (!e.act || !e.set) { problems.push(id + ': character needs act + set'); continue; }
      lead = (clauses.length > 1 ? clauses.join(', together with ') : clauses[0]) + ', ' + e.act + ', ' + e.set;
      lintText(id + ' act', e.act, problems, allow); lintText(id + ' set', e.set, problems, allow);
    } else {
      if (!e.subject || !e.set) { problems.push(id + ': non-character needs subject + set'); continue; }
      lead = e.subject + ', ' + e.set;
      lintText(id + ' subject', e.subject, problems, allow); lintText(id + ' set', e.set, problems, allow);
    }
    const prompt = lead + ', ' + STYLE;
    if (prompt.length > 900) problems.push(id + ': prompt ' + prompt.length + ' chars (> 900)');
    lintText(id + ' (whole)', prompt, problems, allow);
    prompts[id] = { name: c.name + (c.version ? ' - ' + c.version : ''), model: MODEL, aspect: '2:3', megapixels: 1, prompt, ...(allow.length ? { allow } : {}) };
  }
  for (const id of Object.keys(CARDS)) if (!C[id]) problems.push(id + ': CARDS entry for an id that is not in data/cards.js');
  const ui = {};
  for (const [id, e] of Object.entries(UI)) {
    lintText('ui ' + id, e.subject + ' ' + e.set, problems, [], UI_BANNED);
    const prompt = e.subject + ', ' + e.set + ', ' + (e.empty ? UI_EMPTY + ', ' : '') + UI_STYLE;
    if (prompt.length > 900) problems.push('ui ' + id + ': prompt too long');
    ui[id] = { name: id, model: MODEL, aspect: '16:9', megapixels: 2, prompt };
  }
  return { problems, prompts, ui };
}

if (process.argv.includes('--selftest')) {
  const bad = ['a sign over the door', 'there is no light', 'three wolves', 'a mouse in the style of disney', 'a frozen lake', 'a spellbook', 'it isn\'t here', '7 stars', 'a toy story scene', 'a lorcana card frame'];
  let ok = true;
  for (const t of bad) { const p = []; lintText('t', t, p); if (!p.length) { ok = false; console.log('selftest: lint MISSED "' + t + '"'); } }
  { const p = []; lintText('t', 'a castle on a hill', p, [], UI_BANNED); if (!p.length) { ok = false; console.log('selftest: UI castle ban MISSED'); } }
  { const p = []; lintText('t', 'a red guidebook', p, ['guidebook']); if (p.length) { ok = false; console.log('selftest: allow list ignored'); } }
  for (const t of ['Stitch, a small blue alien with a pair of maracas', STYLE, UI_STYLE]) { const p = []; lintText('t', t, p); if (p.length) { ok = false; console.log('selftest: false positive ' + p.join('; ')); } }
  console.log(ok ? 'selftest: lint bites (' + (bad.length + 1) + ' bad strings refused, allow list and clean strings pass)' : 'selftest: FAILED');
  process.exit(ok ? 0 : 1);
}

const { problems, prompts, ui } = buildAll();
const show = process.argv.indexOf('--show');
if (show >= 0) { const id = process.argv[show + 1]; console.log((prompts[id] || ui[id] || {}).prompt || 'no such id'); }
if (problems.length) { console.log('art-prompts: REFUSED to write - ' + problems.length + ' lint problem(s)\n  ' + problems.join('\n  ')); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify({ style: STYLE, uiStyle: UI_STYLE, model: MODEL, prompts, ui }, null, 1));
const lens = Object.values(prompts).map(p => p.prompt.length);
console.log('art-prompts: lint clean; ' + Object.keys(prompts).length + ' card prompts + ' + Object.keys(ui).length + ' UI prompts written to tools/art/art-prompts.json (' + Object.keys(WHO).length + ' identities; model ' + MODEL + '; prompt length ' + Math.min(...lens) + '-' + Math.max(...lens) + ')');
