import type { StyleProfile, CreativeBrief } from "@/types";

/**
 * Builds a structured image generation prompt from a StyleProfile + CreativeBrief.
 *
 * This is the second critical precision layer. The prompt must translate
 * extracted style attributes into concrete visual instructions that
 * image generation models can follow exactly.
 *
 * Structure: [Scene] [Text overlay] [Palette] [Layout] [Mood] [Technical]
 */
export function buildGenerationPrompt(
  profile: StyleProfile,
  brief: CreativeBrief
): string {
  const sections: string[] = [];

  // ─── 1. Scene / Subject Description ──────────────────────────────────
  sections.push(buildSceneSection(brief));

  // ─── 2. Text Overlay Instructions ────────────────────────────────────
  if (brief.textOverlay) {
    sections.push(buildTextSection(brief.textOverlay, profile));
  }

  // ─── 3. Colour Palette ───────────────────────────────────────────────
  sections.push(buildPaletteSection(profile));

  // ─── 4. Layout / Composition ─────────────────────────────────────────
  sections.push(buildLayoutSection(profile));

  // ─── 5. Mood & Style ─────────────────────────────────────────────────
  sections.push(buildMoodSection(profile));

  // ─── 6. Technical Specs ──────────────────────────────────────────────
  sections.push(
    "Technical specifications: 16:9 aspect ratio, 1280x720 pixels, YouTube thumbnail composition, high resolution, no letterboxing, edge-to-edge content."
  );

  return sections.join(" ");
}

function buildSceneSection(brief: CreativeBrief): string {
  const parts = [`Create a YouTube thumbnail for: "${brief.videoTitle}".`];

  if (brief.description) {
    parts.push(`Context: ${brief.description}.`);
  }

  if (brief.targetAudience) {
    parts.push(`Target audience: ${brief.targetAudience}.`);
  }

  return parts.join(" ");
}

function buildTextSection(text: string, profile: StyleProfile): string {
  const { typography } = profile;

  const caseInstruction = {
    uppercase: "ALL CAPS",
    title: "Title Case",
    mixed: "mixed case with emphasis on key words",
  }[typography.caseStyle];

  const weightInstruction = {
    bold: "extra bold, thick strokes",
    medium: "medium weight, clean and readable",
    mixed: "mixed weights with bold headlines and lighter subtext",
  }[typography.weightStyle];

  const hierarchyInstruction = {
    single: "single text element, one size",
    dual: "two text levels — large headline with smaller supporting text",
    complex: "multiple text elements at different sizes creating visual hierarchy",
  }[typography.sizeHierarchy];

  return `Text overlay: display "${text}" in ${caseInstruction}, using ${weightInstruction} typography. Text hierarchy: ${hierarchyInstruction}. Text must be sharp, fully legible, and integrated into the composition.`;
}

function buildPaletteSection(profile: StyleProfile): string {
  const { dominant, accent } = profile.palette;

  const dominantStr = dominant.map((c) => c).join(", ");
  const accentStr = accent.map((c) => c).join(", ");

  return `Colour palette: dominant colours are ${dominantStr}. Accent/highlight colours: ${accentStr}. Use these exact colours — do not introduce unrelated hues. The dominant colours should fill the majority of the frame, with accents used for emphasis, text, or graphical elements.`;
}

function buildLayoutSection(profile: StyleProfile): string {
  const { subjectPosition, textZone } = profile.layout;

  const positionMap = {
    left: "Position the primary subject on the left third of the frame",
    right: "Position the primary subject on the right third of the frame",
    center: "Place the primary subject centrally in frame",
    full: "The subject fills the entire frame",
  };

  const textZoneMap = {
    top: "Text should be placed in the upper portion of the frame, above the subject",
    bottom: "Text should be placed in the lower portion of the frame, below the subject",
    overlay: "Text should overlay directly on the subject/background with sufficient contrast",
    separate: "Text should be in a distinct zone separated from the main subject, potentially with a background panel",
  };

  return `Composition: ${positionMap[subjectPosition]}. ${textZoneMap[textZone]}.`;
}

function buildMoodSection(profile: StyleProfile): string {
  const tags = profile.moodTags.join(", ");
  const descriptors = profile.rawDescriptors;

  return `Visual style and mood: ${tags}. ${descriptors}`;
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
