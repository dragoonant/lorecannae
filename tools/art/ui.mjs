// UI plates (16:9, 2 MP) → art/ui/<name>.png masters, art/ui/<name>.webp delivery.
// Backdrops are "empty places": no figures, calm open centre, detail fading toward the edges, so
// cards and panels can sit on top. Same STYLE and lint as the cards; LANDSCAPE instead of PORTRAIT.
export const UI_EMPTY = 'an empty place with a calm open centre, soft muted tones, detail fading gently toward the edges';
export const UI = {
  'title': { subject: 'an enchanted fairy-tale realm seen from a hilltop, a distant castle on a crag, rivers of glowing liquid ink magic swirling through the sky like ribbons of northern lights', set: 'at twilight with the first stars appearing', ink: 'Amber', empty: true },
  'board-forest': { subject: 'a moonlit forest glade of ancient mossy trees and ferns around a soft open clearing', set: 'at night with gentle silver moonlight and drifting fireflies', ink: 'Emerald', empty: true },
  'board-courtyard': { subject: 'a sunlit castle courtyard of pale flagstones with climbing roses on the surrounding walls', set: 'on a warm quiet afternoon', ink: 'Amber', empty: true },
  'board-cavern': { subject: 'a vast crystal cavern with glowing gemstone clusters along the walls and a smooth still floor', set: 'lit by soft inner crystal light', ink: 'Sapphire', empty: true },
  'board-harbour': { subject: 'a starry harbour of calm water with moored sailing ships and lantern-lit quays along the far shore', set: 'under a deep blue night sky full of stars', ink: 'Steel', empty: true },
  'deck-chooser': { subject: 'a grand enchanted vaulted hall of tall arched windows and marble columns, floating motes of glowing ink and swirling colour', set: 'in warm candlelight', ink: 'Amethyst', empty: true },
  'victory': { subject: 'a triumphant golden sunrise over a fairy-tale kingdom, beams of light and swirling sparkles of magic rising into the sky', set: 'in the early morning', ink: 'Amber', empty: true },
  'defeat': { subject: 'a misty rain-soaked moor with a lone bare tree, the last embers of magic fading into grey drifting fog', set: 'at dusk under heavy clouds', ink: 'Steel', empty: true },
};
