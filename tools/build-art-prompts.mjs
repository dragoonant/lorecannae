// Builds tools/art/art-prompts.json: one prompt per card in data/cards.js plus the UI plates.
// Card prompt = WHO clause (characters, keyed by Name) + per-card act/scene + ink accent + STYLE + PORTRAIT.
// The lint REFUSES to write the file on any violation (kb/LESSONS-DIGEST.md §8), and lints STYLE too:
//   text-magnet nouns, negations, counts above two, franchise/studio/film/artist/game words,
//   every card's Name and Version proper nouns, every card name / version as a phrase, > 900 chars.
// PLAN.md D3 (art: 100% original, painterly storybook).
//   node tools/build-art-prompts.mjs            # lint + write
//   node tools/build-art-prompts.mjs --selftest # prove the lint bites, then exit
//   node tools/build-art-prompts.mjs --show <id> # print one prompt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLE, PORTRAIT, LANDSCAPE, INK } from './art/style.mjs';
import { WHO } from './art/who.mjs';
import { CARDS } from './art/scenes.mjs';
import { UI, UI_EMPTY } from './art/ui.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/art/art-prompts.json');
globalThis.LC = globalThis.LC || {};
await import(pathToFileURL(path.join(ROOT, 'data/cards.js')).href);
const C = globalThis.LC.CARDS;

// ---- lint vocabulary
const MAGNETS = ['sign', 'signs', 'signpost', 'signboard', 'banner', 'banners', 'book', 'books', 'bookish', 'bookshelf', 'bookshelves', 'spellbook', 'guidebook', 'scroll', 'scrolls', 'letter', 'letters', 'lettering', 'label', 'labels', 'logo', 'logos', 'emblem', 'emblems', 'crest', 'crests', 'map', 'maps', 'screen', 'screens', 'poster', 'posters', 'cover', 'covers', 'title', 'titles', 'page', 'pages', 'flag', 'flags', 'insignia', 'nameplate', 'text', 'word', 'words', 'newspaper', 'glyph', 'glyphs', 'rune', 'runes', 'plaque', 'inscription', 'inscribed', 'writing', 'written', 'calligraphy', 'card', 'cards', 'library', 'menu', 'storybook', 'caption', 'signature', 'chalkboard', 'blackboard', 'clipboard', 'note', 'notes', 'contract', 'manuscript', 'parchment', 'alphabet', 'typography', 'font', 'watermark'];
const NEGATIONS = ['no', 'not', 'never', 'without', 'lack', 'lacking', 'none', 'nothing', 'nobody', 'nor', 'neither', 'cannot', 'cant', 'dont', 'isnt', 'doesnt', 'wont'];
const COUNTS = ['three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'twenty', 'thirty', 'hundred', 'hundreds', 'thousand', 'thousands', 'dozen', 'dozens', 'trio', 'triplet', 'triplets', 'triple', 'quartet', 'third', 'quarter'];
const FRANCHISE = ['disney', 'pixar', 'lorcana', 'ravensburger', 'illumineer', 'illumineers', 'marvel', 'lucasfilm', 'dreamworks', 'ghibli', 'miyazaki', 'artstation', 'rutkowski', 'mucha', 'rackham', 'frozen', 'encanto', 'moana', 'zootopia', 'incredibles', 'ducktales', 'gargoyles', 'tangled', 'hercules', 'mulan', 'fantasia', 'pinocchio', 'neverland', 'atlantis', 'pooh', 'goofy', 'donald', 'huey', 'dewey', 'louie', 'scrooge', 'simba', 'mufasa', 'nala', 'sebastian', 'flounder', 'triton', 'cinderella', 'belle', 'merida', 'moana', 'maui', 'buzz', 'lightyear', 'sulley', 'boo', 'ratigan', 'basil', 'syndrome', 'kevin', 'ellie', 'nick', 'judy', 'kronk', 'yzma', 'kuzco', 'gyro', 'gizmoduck', 'canard', 'wyvern', 'llyr', 'ohana', 'agrabah', 'arendelle', 'motunui', 'storyborn', 'dreamborn', 'floodborn', 'glimmer', 'inkwell', 'lore'];
const PHRASES_EXTRA = ['toy story', 'lion king', 'little mermaid', 'sleeping beauty', 'snow white', 'peter pan', 'jungle book', 'robin hood', 'treasure planet', 'black cauldron', 'turning red', 'monsters inc', 'rescue rangers', 'hundred acre', 'beauty and the beast', 'fox and the hound', 'goof troop', 'darkwing', 'big hero', 'wreck it', 'inside out', 'ink bottle label', 'storybook page', 'three quarter'];
// Proper nouns from card Names/Versions (kept explicit: common words such as "queen", "fairy", "fire" stay usable).
const PROPER = ['agustin', 'akood', 'aladdin', 'alan', 'ali', 'angela', 'angel', 'ariel', 'aurora', 'bambi', 'benja', 'bobby', 'broadway', 'camilo', 'canard', 'charming', 'chernabog', 'cheshire', 'christopher', 'dale', 'darkwing', 'david', 'demona', 'diablo', 'dumbo', 'eilonwy', 'elinor', 'elsa', 'emuti', 'eric', 'finnick', 'flynn', 'gaetan', 'gaston', 'genie', 'goof', 'hades', 'hamish', 'hamm', 'hamsterviel', 'harris', 'hubert', 'huntsman', 'horseman', 'incredible', 'inkcaster', 'isis', 'jasmine', 'john', 'jookiba', 'jumba', 'launchpad', 'lee', 'lenny', 'lexington', 'lilo', 'llyr', 'luisa', 'lyle', 'madrigal', 'maleficent', 'max', 'meilin', 'mickey', 'mike', 'milo', 'moliere', 'mowgli', 'mrs', 'mushu', 'nakoma', 'nani', 'ohana', 'omnidroid', 'parr', 'phillip', 'pluto', 'pocahontas', 'rafiki', 'rapunzel', 'robin', 'rourke', 'smolder', 'squeaks', 'stegmutt', 'stitch', 'sven', 'taran', 'thatch', 'thomas', 'tiberius', 'tigger', 'tinker', 'tod', 'ursula', 'vanderchill', 'vanessa', 'vixey', 'wazowski', 'willow', 'woodchuck', 'woody', 'wyvern', 'zimuruski'];

const norm = s => ' ' + s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const phrases = new Set(PHRASES_EXTRA.map(p => norm(p)));
for (const c of Object.values(C)) {
  phrases.add(norm(c.name));
  if (c.version) { phrases.add(norm(c.version)); phrases.add(norm(c.name + ' ' + c.version)); }
  for (const part of c.name.split(/\s*&\s*|,\s*/)) if (part.trim().split(/\s+/).length > 1) phrases.add(norm(part));
}
const BANNED = new Map();
for (const w of MAGNETS) BANNED.set(w, 'text magnet');
for (const w of NEGATIONS) BANNED.set(w, 'negation');
for (const w of COUNTS) BANNED.set(w, 'count above two');
for (const w of FRANCHISE) BANNED.set(w, 'franchise/IP word');
for (const w of PROPER) BANNED.set(w, 'card proper noun');

function lintText(what, text, problems) {
  const n = norm(text);
  for (const w of n.trim().split(' ')) {
    if (BANNED.has(w)) problems.push(`${what}: "${w}" (${BANNED.get(w)})`);
    if (/^\d+$/.test(w) && +w > 2) problems.push(`${what}: "${w}" (count above two)`);
  }
  for (const p of phrases) if (p.trim().split(' ').length > 1 || p.trim().length > 3) { if (n.includes(p)) problems.push(`${what}: "${p.trim()}" (card or character name as a phrase)`); }
  if (/\bn['’]t\b/i.test(text)) problems.push(`${what}: contraction negation`);
}

export function buildAll() {
  const problems = [];
  lintText('STYLE', STYLE, problems);
  lintText('PORTRAIT', PORTRAIT, problems); lintText('LANDSCAPE', LANDSCAPE, problems); lintText('UI_EMPTY', UI_EMPTY, problems);
  for (const [k, v] of Object.entries(INK)) lintText('INK ' + k, v, problems);
  for (const [k, v] of Object.entries(WHO)) lintText('WHO ' + k, v, problems);
  const prompts = {};
  for (const id of Object.keys(C).sort()) {
    const c = C[id], e = CARDS[id];
    if (!e) { problems.push(id + ': no CARDS entry (no generic fallback)'); continue; }
    const ink = c.ink || (c.inks && c.inks[0]);
    if (!INK[ink]) { problems.push(id + ': no ink accent for ' + ink); continue; }
    let lead;
    if (/Character/.test(c.type)) {
      const names = e.who ? [e.who] : (WHO[c.name] ? [c.name] : c.name.split(/\s*&\s*/));
      const clauses = names.map(n => WHO[n]);
      if (clauses.some(x => !x)) { problems.push(id + ': no WHO entry for ' + names.join(' / ')); continue; }
      if (!e.act || !e.set) { problems.push(id + ': character needs act + set'); continue; }
      lead = (clauses.length > 1 ? clauses.join(' together with ') : clauses[0]) + ', ' + e.act + ', ' + e.set;
      lintText(id + ' act', e.act, problems); lintText(id + ' set', e.set, problems);
    } else {
      if (!e.subject || !e.set) { problems.push(id + ': non-character needs subject + set'); continue; }
      lead = e.subject + ', ' + e.set;
      lintText(id + ' subject', e.subject, problems); lintText(id + ' set', e.set, problems);
    }
    const prompt = lead + ', ' + INK[ink] + ', ' + STYLE + ', ' + PORTRAIT;
    if (prompt.length > 900) problems.push(id + ': prompt ' + prompt.length + ' chars (> 900)');
    lintText(id + ' (whole)', prompt, problems);
    prompts[id] = { name: c.name + (c.version ? ' - ' + c.version : ''), ink, aspect: '2:3', megapixels: 1, prompt };
  }
  for (const id of Object.keys(CARDS)) if (!C[id]) problems.push(id + ': CARDS entry for an id that is not in data/cards.js');
  const ui = {};
  for (const [id, e] of Object.entries(UI)) {
    lintText('ui ' + id, e.subject + ' ' + e.set, problems);
    const prompt = e.subject + ', ' + e.set + ', ' + (e.empty ? UI_EMPTY + ', ' : '') + INK[e.ink] + ', ' + STYLE + ', ' + LANDSCAPE;
    if (prompt.length > 900) problems.push('ui ' + id + ': prompt too long');
    ui[id] = { name: id, aspect: '16:9', megapixels: 2, prompt };
  }
  return { problems, prompts, ui };
}

if (process.argv.includes('--selftest')) {
  const bad = ['a sign over the door', 'there is no light', 'three wolves', 'a mouse in the style of disney', 'an elsa lookalike', 'a frozen lake', 'standing all alone', 'a battering ram', 'a spellbook', 'it isn\'t here', '7 stars'];
  let ok = true;
  for (const t of bad) { const p = []; lintText('t', t, p); if (!p.length) { ok = false; console.log('selftest: lint MISSED "' + t + '"'); } }
  for (const t of ['a calm moonlit glade with a pair of owls', STYLE]) { const p = []; lintText('t', t, p); if (p.length) { ok = false; console.log('selftest: false positive ' + p.join('; ')); } }
  console.log(ok ? 'selftest: lint bites (' + bad.length + ' bad strings refused, clean strings pass)' : 'selftest: FAILED');
  process.exit(ok ? 0 : 1);
}

const { problems, prompts, ui } = buildAll();
const show = process.argv.indexOf('--show');
if (show >= 0) { const id = process.argv[show + 1]; console.log((prompts[id] || ui[id] || {}).prompt || 'no such id'); }
if (problems.length) { console.log('art-prompts: REFUSED to write - ' + problems.length + ' lint problem(s)\n  ' + problems.join('\n  ')); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify({ style: STYLE, prompts, ui }, null, 1));
const lens = Object.values(prompts).map(p => p.prompt.length);
console.log('art-prompts: lint clean; ' + Object.keys(prompts).length + ' card prompts + ' + Object.keys(ui).length + ' UI prompts written to tools/art/art-prompts.json (' + Object.keys(WHO).length + ' identities; prompt length ' + Math.min(...lens) + '-' + Math.max(...lens) + ')');
