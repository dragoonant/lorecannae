// The one style block (PLAN.md D17, owner's pick "C" from art/audition-mgsd.jpg: FLUX.1 dev, name +
// description). Byte-identical on every card prompt; changing a single character starts a new set.
// It describes the feature-animation direction without naming a studio (a studio name invites its
// logo). build-art-prompts.mjs lints it like any prompt. (D3's painterly STYLE is superseded.)
export const STYLE = 'super-deformed chibi figure with MGSD proportions, about two and a half heads tall, oversized head with big expressive eyes, short stubby limbs, richly detailed costume and textures, classic feature-animation art direction, clean appealing shapes, bright saturated colours, polished soft cel shading, cinematic lighting, full-bleed scene edge to edge, purely pictorial, wordless and untitled, vertical portrait composition';

// Item, action and song cards whose subject is an object or a scene: same direction, the chibi
// clause applies to any characters present.
// UI backdrops ("empty places", no figures): the same animation direction as a background painting.
export const UI_STYLE = 'classic feature-animation background painting, clean appealing shapes, bright saturated colours, polished soft shading, cinematic lighting, full-bleed scene edge to edge, purely pictorial, wordless and untitled, wide panoramic landscape composition';

// The model chosen in the audition (non-commercial licence; free fan project, docs/sources.md).
export const MODEL = 'dev';
