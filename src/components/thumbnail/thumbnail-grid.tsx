"use client";

import Image from "next/image";
import { Plus, Check, Eye, ThumbsUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { YouTubeVideo } from "@/types";
import { getBestThumbnailUrl } from "@/types";
import { formatDuration, formatViewCount } from "@/lib/services/youtube";
import { useStyleBoardStore } from "@/stores/style-board-store";

interface ThumbnailGridProps {
  videos: YouTubeVideo[];
  loading?: boolean;
}

export function ThumbnailGrid({ videos, loading }: ThumbnailGridProps) {
  const { items, addItem } = useStyleBoardStore();

  const isSaved = (videoId: string) =>
    items.some((i) => i.thumbnailUrl.includes(videoId));

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Search for thumbnails to get started
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {videos.map((video) => {
        const thumbUrl = getBestThumbnailUrl(video);
        const saved = isSaved(video.videoId);

        return (
          <div
            key={video.videoId}
            className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video">
              <Image
                src={thumbUrl}
                alt={video.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />

              {/* Duration badge */}
              <div className="absolute bottom-1.5 right-1.5">
                <Badge
                  variant="secondary"
                  className="bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
                >
                  {formatDuration(video.duration)}
                </Badge>
              </div>

              {/* Hover overlay with save button */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                <button
                  onClick={() =>
                    addItem({
                      source: "youtube",
                      thumbnailUrl: thumbUrl,
                      title: video.title,
                    })
                  }
                  disabled={saved}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                    saved
                      ? "bg-green-500 text-white"
                      : "bg-white/90 text-black opacity-0 hover:bg-white group-hover:opacity-100"
                  )}
                >
                  {saved ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Video info */}
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-2 text-xs font-medium leading-tight">
                {video.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {video.channelTitle}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatViewCount(video.viewCount)}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {formatViewCount(video.likeCount)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
