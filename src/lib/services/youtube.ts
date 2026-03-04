import { eq } from "drizzle-orm";
import type { YouTubeVideo } from "@/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── In-memory fallback cache ────────────────────────────────────────────────

const memoryCache = new Map<string, { data: YouTubeVideo[]; cachedAt: number }>();

function cacheKey(query: string, type: string, maxResults: number): string {
  return `${type}:${query}:${maxResults}`;
}

async function getCache(key: string): Promise<YouTubeVideo[] | null> {
  try {
    const { db, schema } = await import("@/lib/db");
    const rows = await db()
      .select()
      .from(schema.youtubeCache)
      .where(eq(schema.youtubeCache.cacheKey, key))
      .limit(1);

    if (rows.length && Date.now() - new Date(rows[0].cachedAt).getTime() < CACHE_TTL_MS) {
      return rows[0].results as YouTubeVideo[];
    }
  } catch {
    // DB not available
  }

  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.cachedAt < CACHE_TTL_MS) return mem.data;
  return null;
}

async function setCache(key: string, data: YouTubeVideo[]): Promise<void> {
  memoryCache.set(key, { data, cachedAt: Date.now() });

  try {
    const { db, schema } = await import("@/lib/db");
    await db()
      .insert(schema.youtubeCache)
      .values({ cacheKey: key, results: data })
      .onConflictDoUpdate({
        target: schema.youtubeCache.cacheKey,
        set: { results: data, cachedAt: new Date() },
      });
  } catch {
    // DB not available
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type SearchType = "keyword" | "channel" | "trending";
export type SortOrder = "relevance" | "date" | "viewCount" | "rating";

export interface SearchOptions {
  type?: SearchType;
  maxResults?: number;
  order?: SortOrder;
  regionCode?: string;
  publishedAfter?: string; // ISO 8601
  publishedBefore?: string; // ISO 8601
  videoDuration?: "any" | "short" | "medium" | "long";
  videoCategoryId?: string;
}

export async function searchVideos(
  query: string,
  options: SearchOptions = {}
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

  const {
    type = "keyword",
    maxResults = 12,
    order = "relevance",
    regionCode = "US",
    publishedAfter,
    publishedBefore,
    videoDuration,
    videoCategoryId,
  } = options;

  const key = cacheKey(
    `${query}|${order}|${regionCode}|${publishedAfter || ""}|${publishedBefore || ""}|${videoDuration || ""}|${videoCategoryId || ""}`,
    type,
    maxResults
  );

  const cached = await getCache(key);
  if (cached) return cached;

  let videoIds: string[];

  if (type === "trending") {
    // Trending uses videos.list directly — 1 unit per call, much cheaper
    const results = await fetchTrending(apiKey, regionCode, maxResults, videoCategoryId);
    await setCache(key, results);
    return results;
  } else if (type === "channel") {
    videoIds = await searchVideoIds(apiKey, {
      channelId: query,
      maxResults,
      order: "date",
    });
  } else {
    videoIds = await searchVideoIds(apiKey, {
      q: query,
      maxResults,
      order,
      regionCode,
      publishedAfter,
      publishedBefore,
      videoDuration,
      videoCategoryId,
    });
  }

  if (!videoIds.length) {
    await setCache(key, []);
    return [];
  }

  // Step 2: Enrich with full video data (1 unit total, regardless of count)
  const results = await fetchVideoDetails(apiKey, videoIds);
  await setCache(key, results);
  return results;
}

// ─── Step 1: Search for video IDs (100 quota units) ──────────────────────────

interface SearchParams {
  q?: string;
  channelId?: string;
  maxResults: number;
  order?: string;
  regionCode?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  videoDuration?: string;
  videoCategoryId?: string;
}

async function searchVideoIds(
  apiKey: string,
  params: SearchParams
): Promise<string[]> {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("part", "id"); // only need IDs — smaller response
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(params.maxResults, 50)));
  url.searchParams.set("key", apiKey);

  if (params.q) url.searchParams.set("q", params.q);
  if (params.channelId) url.searchParams.set("channelId", params.channelId);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.regionCode) url.searchParams.set("regionCode", params.regionCode);
  if (params.publishedAfter) url.searchParams.set("publishedAfter", params.publishedAfter);
  if (params.publishedBefore) url.searchParams.set("publishedBefore", params.publishedBefore);
  if (params.videoDuration) url.searchParams.set("videoDuration", params.videoDuration);
  if (params.videoCategoryId) url.searchParams.set("videoCategoryId", params.videoCategoryId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`YouTube search failed: ${error}`);
  }

  const data = await res.json();

  return (data.items || []).map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );
}

// ─── Step 2: Batch enrich video IDs (1 quota unit) ───────────────────────────

async function fetchVideoDetails(
  apiKey: string,
  videoIds: string[]
): Promise<YouTubeVideo[]> {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "snippet,contentDetails,statistics");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`YouTube videos.list failed: ${error}`);
  }

  const data = await res.json();
  return mapVideoItems(data.items || []);
}

// ─── Trending (uses videos.list chart — 1 unit, no search needed) ────────────

async function fetchTrending(
  apiKey: string,
  regionCode: string,
  maxResults: number,
  videoCategoryId?: string
): Promise<YouTubeVideo[]> {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "snippet,contentDetails,statistics");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", String(Math.min(maxResults, 50)));
  url.searchParams.set("key", apiKey);
  if (videoCategoryId) url.searchParams.set("videoCategoryId", videoCategoryId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`YouTube trending failed: ${error}`);
  }

  const data = await res.json();
  return mapVideoItems(data.items || []);
}

// ─── Response mapping ────────────────────────────────────────────────────────

interface RawVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    categoryId: string;
    tags?: string[];
    thumbnails: {
      default: RawThumb;
      medium: RawThumb;
      high: RawThumb;
      standard?: RawThumb;
      maxres?: RawThumb;
    };
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

interface RawThumb {
  url: string;
  width: number;
  height: number;
}

function mapVideoItems(items: RawVideoItem[]): YouTubeVideo[] {
  return items.map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    publishedAt: item.snippet.publishedAt,
    categoryId: item.snippet.categoryId,
    tags: item.snippet.tags || [],
    duration: item.contentDetails.duration,
    viewCount: parseInt(item.statistics.viewCount || "0", 10),
    likeCount: parseInt(item.statistics.likeCount || "0", 10),
    commentCount: parseInt(item.statistics.commentCount || "0", 10),
    thumbnails: item.snippet.thumbnails,
  }));
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration to human-readable string */
export function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";

  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  const s = match[3] ? parseInt(match[3]) : 0;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format view count to compact form */
export function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
