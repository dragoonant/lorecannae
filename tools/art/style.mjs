// The one style block (PLAN.md D3: painterly storybook). Byte-identical on every card prompt;
// changing a single character starts a new set. build-art-prompts.mjs lints it like any prompt.
// Owner's direction, in our own words. It deliberately avoids the words "storybook" and "page"
// (text magnets) and names no studio, franchise or artist.
export const STYLE = 'luminous painterly fairy-tale illustration in gouache and watercolour, soft glowing magic, swirling ink-splash flourishes of liquid colour, rich jewel colours, expressive character acting, one clear focal subject, full-bleed picture edge to edge, purely pictorial, wordless and untitled';

// Orientation clause, appended after STYLE.
export const PORTRAIT = 'vertical portrait composition';
export const LANDSCAPE = 'wide panoramic landscape composition';

// Per-ink accent clause, chosen by the card's ink (never by hash).
export const INK = {
  Amber: 'accented with warm honey-gold glowing light',
  Amethyst: 'accented with drifting violet arcane mist',
  Emerald: 'accented with dappled green forest light and sly flickering wisps',
  Ruby: 'accented with crimson fire-ember energy',
  Sapphire: 'accented with clear blue crystalline light',
  Steel: 'accented with a cold silver metallic sheen',
};
