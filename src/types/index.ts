// ─── Style Profile ───────────────────────────────────────────────────────────

export type SubjectPosition = "left" | "right" | "center" | "full";
export type TextZone = "top" | "bottom" | "overlay" | "separate";
export type WeightStyle = "bold" | "medium" | "mixed";
export type CaseStyle = "uppercase" | "title" | "mixed";
export type SizeHierarchy = "single" | "dual" | "complex";
export type SourceType = "extracted" | "uploaded" | "manual";
export type LightingStyle = "natural" | "studio" | "dramatic" | "neon-glow" | "flat" | "backlit" | "mixed";
export type BackgroundType = "solid" | "gradient" | "photo" | "blurred-photo" | "pattern" | "split" | "transparent";
export type TextEffect = "plain" | "outline" | "shadow" | "glow" | "3d" | "gradient-fill" | "none";
export type EnergyLevel = "calm" | "moderate" | "high" | "explosive";

export interface StyleProfile {
  id: string;
  userId: string;
  name: string;
  sourceType: SourceType;
  palette: {
    dominant: string[];
    accent: string[];
  };
  layout: {
    subjectPosition: SubjectPosition;
    textZone: TextZone;
  };
  typography: {
    weightStyle: WeightStyle;
    caseStyle: CaseStyle;
    sizeHierarchy: SizeHierarchy;
  };
  lighting?: LightingStyle;
  backgroundType?: BackgroundType;
  textEffect?: TextEffect;
  energyLevel?: EnergyLevel;
  contrastLevel?: ContrastLevel;
  graphicElements?: string[];
  moodTags: string[];
  rawDescriptors: string;
  promptVersion: string;
  createdAt: string;
}

// ─── Thumbnail Job ───────────────────────────────────────────────────────────

export type JobStatus = "pending" | "generating" | "complete" | "failed";

export interface ThumbnailJob {
  id: string;
  userId: string;
  styleProfileId: string;
  brief: string;
  generatedPrompt: string;
  status: JobStatus;
  outputs: JobOutput[];
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface JobOutput {
  url: string;
  variationIndex: number;
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  categoryId: string;
  tags: string[];
  duration: string; // ISO 8601 e.g. "PT15M33S"
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnails: {
    default: YouTubeThumbnailSize;
    medium: YouTubeThumbnailSize;
    high: YouTubeThumbnailSize;
    standard?: YouTubeThumbnailSize;
    maxres?: YouTubeThumbnailSize; // 1280x720 — the actual thumbnail
  };
}

export interface YouTubeThumbnailSize {
  url: string;
  width: number;
  height: number;
}

// Helper — best available thumbnail URL for display
export function getBestThumbnailUrl(video: YouTubeVideo): string {
  return (
    video.thumbnails.maxres?.url ||
    video.thumbnails.standard?.url ||
    video.thumbnails.high.url
  );
}

// ─── Style Board ─────────────────────────────────────────────────────────────

export interface StyleBoardItem {
  id: string;
  source: "youtube" | "upload";
  thumbnailUrl: string;
  title: string;
  addedAt: string;
  extractedProfile?: StyleProfile;
}

// ─── Creative Brief ──────────────────────────────────────────────────────────

export interface CreativeBrief {
  videoTitle: string;
  description: string;
  targetAudience?: string;
  talkingPoints?: string;
  textOverlay?: string;
}

// ─── Extraction Result (raw from vision API) ─────────────────────────────────

export type ContrastLevel = "high" | "medium" | "low";

export interface ExtractionResult {
  palette: {
    dominant: string[];
    accent: string[];
  };
  layout: {
    subjectPosition: SubjectPosition;
    textZone: TextZone;
  };
  typography: {
    weightStyle: WeightStyle;
    caseStyle: CaseStyle;
    sizeHierarchy: SizeHierarchy;
  };
  lighting: LightingStyle;
  backgroundType: BackgroundType;
  textEffect: TextEffect;
  energyLevel: EnergyLevel;
  contrastLevel: ContrastLevel;
  moodTags: string[];
  rawDescriptors: string;
}
