import type { StyleProfile, CreativeBrief } from "@/types";

/**
 * Builds a structured image generation prompt from a StyleProfile + CreativeBrief.
 *
 * Token priority: the first ~77 tokens carry the most weight in CLIP-based models.
 * We front-load: technical container → subject → lighting → palette → composition.
 *
 * Structure: [Technical] [Scene] [Lighting] [Palette] [Layout] [Background]
 *            [Mood] [Text overlay] [Energy/Contrast]
 */
export function buildGenerationPrompt(
  profile: StyleProfile,
  brief: CreativeBrief
): string {
  const sections: string[] = [];

  // ─── 1. Technical container (primes model for output format) ───────
  sections.push(
    "YouTube thumbnail, 16:9 aspect ratio, 1280x720, high detail, edge-to-edge content, no letterboxing."
  );

  // ─── 2. Scene / Subject (highest priority after container) ─────────
  sections.push(buildSceneSection(brief));

  // ─── 3. Lighting (before colour — models use lighting to interpret colour) ─
  sections.push(buildLightingSection(profile));

  // ─── 4. Colour Palette ─────────────────────────────────────────────
  sections.push(buildPaletteSection(profile, brief.noText));

  // ─── 5. Layout / Composition (film vocabulary) ─────────────────────
  sections.push(buildLayoutSection(profile, brief.noText));

  // ─── 6. Background Treatment ───────────────────────────────────────
  sections.push(buildBackgroundSection(profile));

  // ─── 7. Mood & Style (rawDescriptors carry the "soul" of the style) ─
  sections.push(buildMoodSection(profile));

  // ─── 8. Text Overlay or No-Text instruction ──────────────────────
  if (brief.noText) {
    sections.push("IMPORTANT: Do NOT render any text, letters, words, numbers, typography, or written content anywhere in the image. The thumbnail must be purely visual with zero text elements.");
  } else if (brief.textOverlay) {
    sections.push(buildTextSection(brief.textOverlay, profile));
  }

  // ─── 9. Energy / Contrast finishing instructions ───────────────────
  sections.push(buildEnergySection(profile));

  return sections.join(" ");
}

function buildSceneSection(brief: CreativeBrief): string {
  const parts = [`Subject: ${brief.videoTitle}.`];

  if (brief.description) {
    parts.push(`Scene context: ${brief.description}.`);
  }

  if (brief.targetAudience) {
    parts.push(`Target audience: ${brief.targetAudience}.`);
  }

  return parts.join(" ");
}

function buildLightingSection(profile: StyleProfile): string {
  const lightingMap: Record<string, string> = {
    natural: "Natural daylight illumination, soft diffused shadows, warm ambient fill",
    studio: "Controlled studio lighting, even illumination, clean soft shadows",
    dramatic: "Dramatic directional lighting, hard shadows, strong key light from one side, high contrast between lit and shadowed areas",
    "neon-glow": "Neon-coloured light sources casting coloured ambient glow, LED-style rim lighting, saturated light spill on surfaces",
    flat: "Flat even lighting, minimal shadows, uniform brightness across frame",
    backlit: "Strong backlight creating rim/edge lighting on subject, silhouette tendency, lens flare optional",
    mixed: "Mixed lighting with multiple sources, combining practical and ambient light",
  };

  const lighting = profile.lighting || "dramatic";
  return `Lighting: ${lightingMap[lighting] || lightingMap.dramatic}.`;
}

function buildPaletteSection(profile: StyleProfile, noText?: boolean): string {
  const { dominant, accent } = profile.palette;

  const dominantStr = dominant.join(", ");
  const accentStr = accent.join(", ");

  return `Colour palette: dominant fills are ${dominantStr}, accent/highlight colours are ${accentStr}. Use these exact colours — do not introduce unrelated hues. Dominant colours fill the majority of the frame; accents for emphasis${noText ? "" : " and text"}.`;
}

function buildLayoutSection(profile: StyleProfile, noText?: boolean): string {
  const { subjectPosition } = profile.layout;

  const positionMap: Record<string, string> = {
    left: "Subject fills the left third of frame, leaving right side open for negative space. Rule of thirds, subject eyes at upper-left power point",
    right: "Subject fills the right third of frame, leaving left side open. Rule of thirds, subject at right power point",
    center: "Subject placed centrally in frame, symmetrical composition, f/1.8 shallow depth of field separating subject from background",
    full: "Subject fills the entire frame edge-to-edge, tight crop, maximum visual impact",
  };

  if (noText) {
    return `Composition: ${positionMap[subjectPosition]}. Use the full frame for visual content — no space reserved for text.`;
  }

  const { textZone } = profile.layout;
  const textZoneMap: Record<string, string> = {
    top: "Text placed in the upper portion of the frame, above the subject, with clear separation",
    bottom: "Text placed in the lower portion of the frame, below or overlapping the bottom of the subject",
    overlay: "Text overlays directly on the subject/background with high-contrast treatment for legibility",
    separate: "Text in a distinct zone separated from the main subject, potentially on a colour panel or clean background region",
  };

  return `Composition: ${positionMap[subjectPosition]}. ${textZoneMap[textZone]}.`;
}

function buildBackgroundSection(profile: StyleProfile): string {
  const bgMap: Record<string, string> = {
    solid: "Clean solid-colour background, no texture or noise",
    gradient: "Smooth colour gradient background transitioning between palette dominant colours",
    photo: "Photographic background, sharp detail, environmental context",
    "blurred-photo": "Photographic background with strong gaussian blur, f/1.4 bokeh effect, subject in sharp focus against soft background",
    pattern: "Repeating graphic pattern or texture in the background",
    split: "Background split into distinct colour or compositional zones",
    transparent: "Subject on clean cutout with no background, floating composition",
  };

  const bg = profile.backgroundType || "photo";
  return `Background: ${bgMap[bg] || bgMap.photo}.`;
}

function buildTextSection(text: string, profile: StyleProfile): string {
  const { typography } = profile;

  const caseInstruction: Record<string, string> = {
    uppercase: "ALL CAPS",
    title: "Title Case",
    mixed: "mixed case with emphasis on key words",
  };

  const weightInstruction: Record<string, string> = {
    bold: "extra bold, thick strokes, heavy weight",
    medium: "medium weight, clean and readable",
    mixed: "mixed weights — bold headlines with lighter subtext",
  };

  const hierarchyInstruction: Record<string, string> = {
    single: "single text element at one size",
    dual: "two text levels — large headline with smaller supporting text",
    complex: "multiple text elements at different sizes creating visual hierarchy",
  };

  const effectInstruction: Record<string, string> = {
    plain: "flat solid fill on text",
    outline: "bold outline/stroke around each letter for contrast",
    shadow: "strong drop shadow behind text for depth",
    glow: "luminous glow halo around text",
    "3d": "3D extruded dimensional text with depth",
    "gradient-fill": "gradient colour fill within the letters",
    none: "",
  };

  const effect = profile.textEffect || "plain";
  const effectStr = effectInstruction[effect] ? ` Text effect: ${effectInstruction[effect]}.` : "";

  return `Text overlay: "${text}" in ${caseInstruction[typography.caseStyle]}, ${weightInstruction[typography.weightStyle]}. Hierarchy: ${hierarchyInstruction[typography.sizeHierarchy]}. Text must be sharp, fully legible, horizontal, and integrated into the composition.${effectStr}`;
}

function buildMoodSection(profile: StyleProfile): string {
  const tags = profile.moodTags.join(", ");
  const descriptors = profile.rawDescriptors;

  return `In the exact visual style of the reference: ${tags}. ${descriptors}`;
}

function buildEnergySection(profile: StyleProfile): string {
  const energyMap: Record<string, string> = {
    calm: "Calm, restrained visual energy. Muted saturation, gentle contrast, breathing room in composition",
    moderate: "Balanced visual energy. Clear focal point, moderate saturation and contrast",
    high: "High visual energy. Bold saturated colours, strong contrast, dynamic composition with tension",
    explosive: "Maximum visual intensity. Extreme contrast, oversaturated colours, aggressive composition, every element demands attention",
  };

  const contrastMap: Record<string, string> = {
    high: "High figure-ground contrast — subject pops dramatically from background",
    medium: "Clear subject-background separation with moderate contrast",
    low: "Subtle subject-background separation, cohesive tonal range",
  };

  const energy = profile.energyLevel || "high";
  const contrast = profile.contrastLevel || "high";

  return `${energyMap[energy]}. ${contrastMap[contrast]}.`;
}

/**
 * Merge multiple StyleProfiles into one for multi-style generation.
 * First profile is "primary" (layout, background, lighting).
 * Palettes and mood tags are blended from all profiles.
 */
export function mergeProfiles(profiles: StyleProfile[]): StyleProfile {
  if (profiles.length === 0) throw new Error("No profiles to merge");
  if (profiles.length === 1) return profiles[0];

  const primary = profiles[0];
  const secondary = profiles.slice(1);

  // Palette: primary's dominant colours stay, pull only accent inspiration from others
  const accentPool = [...new Set([
    ...primary.palette.accent,
    ...secondary.flatMap((p) => p.palette.accent.slice(0, 1)),
  ])];

  // Mood: primary's tags first, then pick at most 1 unique tag per secondary
  const primaryTags = new Set(primary.moodTags);
  const extraTags = secondary
    .flatMap((p) => p.moodTags.filter((t) => !primaryTags.has(t)).slice(0, 1));
  const moodTags = [...primary.moodTags, ...extraTags];

  // Descriptors: use only the primary's raw descriptors — avoids conflicting instructions
  // but note the inspirational sources
  const sourceNames = secondary.map((p) => p.name).join(", ");
  const descriptors = `${primary.rawDescriptors}. Inspired by creative elements from: ${sourceNames}.`;

  // Energy: average rather than max — prevents always going explosive
  const energyRank: Record<string, number> = { calm: 0, moderate: 1, high: 2, explosive: 3 };
  const energyLabels = ["calm", "moderate", "high", "explosive"] as const;
  const avgEnergy = Math.round(
    profiles.reduce((sum, p) => sum + (energyRank[p.energyLevel || "high"] ?? 2), 0) / profiles.length
  );

  return {
    ...primary,
    name: profiles.map((p) => p.name).join(" + "),
    palette: {
      dominant: primary.palette.dominant,
      accent: accentPool.slice(0, 4),
    },
    moodTags,
    rawDescriptors: descriptors,
    energyLevel: energyLabels[avgEnergy],
  };
}

/**
 * Build an iteration prompt that modifies a previous generation
 * based on user feedback while preserving the core style.
 */
export function buildIterationPrompt(
  originalPrompt: string,
  feedback: string
): string {
  return `${originalPrompt}

MODIFICATION: Apply this change to the previous design: ${feedback}. Keep all other visual elements, colours, layout, and style exactly the same — only modify what was specifically requested.`;
}
