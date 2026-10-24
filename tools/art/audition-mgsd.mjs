// MGSD style audition (PLAN.md D17): 3 cards x 4 variants, one shared STYLE string.
//   A = FLUX.2 klein, character name + description     B = klein, description only
//   C = FLUX.1 dev (non-commercial licence; free fan project), name + description
//   D = FLUX.1 schnell, name + description
// Writes tools/art/audition-prompts.json (gen-art --prompts format). Descriptions are written in our
// own words from the official card only to identify who/costume/colours; the composition is our own.
//   node tools/art/audition-mgsd.mjs
//   node tools/gen-art.mjs --prompts tools/art/audition-prompts.json --out art/masters/audition --model klein --only <ids>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Disney-animation direction described, not named (a studio name in a prompt invites its logo).
export const STYLE_MGSD = 'super-deformed chibi figure with MGSD proportions, about two and a half heads tall, oversized head with big expressive eyes, short stubby limbs, richly detailed costume and textures, classic feature-animation art direction, clean appealing shapes, bright saturated colours, polished soft cel shading, cinematic lighting, full-bleed scene edge to edge, purely pictorial, wordless and untitled, vertical portrait composition';
const CARDS = {
  darkwing: { name: 'Darkwing Duck', desc: 'a white cartoon duck hero with an orange bill, a purple domino mask, a wide-brimmed purple fedora, a long purple cape lined in pink and a teal turtleneck, leaping out of the shadows with a gas gun raised and a confident grin', set: 'in a misty night alley of a city with purple shadows and a glowing streetlamp' },
  stitch: { name: 'Stitch', desc: 'a small blue koala-like alien with big notched ears, a fluffy blue chest, black eyes and a huge toothy grin, wearing a sleeveless golden studded rock jacket, shredding an electric guitar', set: 'on a beachside concert stage at night with confetti, spotlights and palm trees' },
  elsa: { name: 'Elsa', desc: 'a young snow queen with a long platinum-blonde side braid and blue eyes, wearing a shimmering white ice gown with a long sheer sparkling cape, arms raised to conjure a swirling blizzard of glowing snowflakes', set: 'above an ice-locked fjord at night under green northern lights' },
};
const VARIANTS = { A: { label: 'A klein+name', model: 'klein', name: true }, B: { label: 'B klein desc', model: 'klein', name: false }, C: { label: 'C dev+name', model: 'dev', name: true }, D: { label: 'D schnell+name', model: 'schnell', name: true } };
const BAD = /\b(sign|banner|book|scroll|letter|label|logo|emblem|crest|map|screen|poster|cover|title|page|card|text|word|no|not|never|without|three|four|five|six|seven|eight|nine|ten|dozen|disney|pixar|lorcana)s?\b/i;
const prompts = {};
const problems = [];
for (const [v, V] of Object.entries(VARIANTS)) for (const [k, c] of Object.entries(CARDS)) {
  const lead = (V.name ? c.name + ', ' : '') + c.desc + ', ' + c.set;
  const m = (lead + ' ' + STYLE_MGSD).match(BAD); if (m) problems.push(v + k + ': ' + m[0]);
  prompts[v + '-' + k] = { name: V.label + ' ' + k, model: V.model, label: V.label, aspect: '2:3', megapixels: 1, prompt: lead + ', ' + STYLE_MGSD };
}
if (problems.length) { console.log('audition: refused - ' + problems.join('; ')); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'audition-prompts.json'), JSON.stringify({ style: STYLE_MGSD, prompts }, null, 1));
console.log('audition: ' + Object.keys(prompts).length + ' prompts written to tools/art/audition-prompts.json');
