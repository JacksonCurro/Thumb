import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Style Profiles ──────────────────────────────────────────────────────────

export const styleProfiles = pgTable("style_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sourceType: varchar("source_type", { length: 20 }).notNull(), // extracted | uploaded | manual
  palette: jsonb("palette").notNull(), // { dominant: string[], accent: string[] }
  layout: jsonb("layout").notNull(), // { subjectPosition, textZone }
  typography: jsonb("typography").notNull(), // { weightStyle, caseStyle, sizeHierarchy }
  lighting: varchar("lighting", { length: 20 }),
  backgroundType: varchar("background_type", { length: 20 }),
  textEffect: varchar("text_effect", { length: 20 }),
  energyLevel: varchar("energy_level", { length: 20 }),
  contrastLevel: varchar("contrast_level", { length: 20 }),
  moodTags: jsonb("mood_tags").notNull(), // string[]
  rawDescriptors: text("raw_descriptors").notNull(),
  promptVersion: varchar("prompt_version", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Thumbnail Jobs ──────────────────────────────────────────────────────────

export const thumbnailJobs = pgTable("thumbnail_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  styleProfileId: uuid("style_profile_id").references(() => styleProfiles.id),
  brief: text("brief").notNull(),
  generatedPrompt: text("generated_prompt").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | generating | complete | failed
  outputs: jsonb("outputs").notNull().default([]), // { url, variationIndex }[]
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Style Board Items ───────────────────────────────────────────────────────

export const styleBoardItems = pgTable("style_board_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  source: varchar("source", { length: 20 }).notNull(), // youtube | upload
  thumbnailUrl: text("thumbnail_url").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  styleProfileId: uuid("style_profile_id").references(() => styleProfiles.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// ─── YouTube Search Cache ────────────────────────────────────────────────────

export const youtubeCache = pgTable("youtube_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  cacheKey: varchar("cache_key", { length: 500 }).notNull().unique(),
  results: jsonb("results").notNull(), // YouTubeThumbnail[]
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});
