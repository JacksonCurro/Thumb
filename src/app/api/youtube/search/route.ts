import { NextRequest, NextResponse } from "next/server";
import { searchVideos } from "@/lib/services/youtube";
import type { SearchType, SortOrder } from "@/lib/services/youtube";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const query = searchParams.get("q");
  const type = (searchParams.get("type") || "keyword") as SearchType;
  const order = (searchParams.get("order") || "relevance") as SortOrder;
  const maxResults = Math.min(parseInt(searchParams.get("maxResults") || "12", 10), 50);
  const regionCode = searchParams.get("regionCode") || "US";
  const publishedAfter = searchParams.get("publishedAfter") || undefined;
  const publishedBefore = searchParams.get("publishedBefore") || undefined;
  const videoDuration = (searchParams.get("videoDuration") || undefined) as
    | "any" | "short" | "medium" | "long" | undefined;
  const videoCategoryId = searchParams.get("videoCategoryId") || undefined;

  if (!query && type !== "trending") {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (unless type=trending)" },
      { status: 400 }
    );
  }

  try {
    const results = await searchVideos(query || "", {
      type,
      maxResults,
      order,
      regionCode,
      publishedAfter,
      publishedBefore,
      videoDuration,
      videoCategoryId,
    });

    return NextResponse.json({
      results,
      meta: {
        query,
        type,
        order,
        resultCount: results.length,
        // Quota cost: 101 units for keyword/channel (search + enrich), 1 unit for trending
        quotaCost: type === "trending" ? 1 : 101,
      },
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
