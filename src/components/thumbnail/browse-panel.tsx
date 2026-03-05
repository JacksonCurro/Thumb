"use client";

import { useState, useCallback } from "react";
import { Search, TrendingUp, User, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThumbnailGrid } from "./thumbnail-grid";
import type { YouTubeVideo } from "@/types";

type SearchType = "keyword" | "channel" | "trending";

export function BrowsePanel() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("keyword");
  const [sortOrder, setSortOrder] = useState("relevance");
  const [duration, setDuration] = useState("any");
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && searchType !== "trending") return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: searchType,
        maxResults: "24",
        order: sortOrder,
      });

      if (searchType !== "trending" && query.trim()) {
        params.set("q", query);
      }

      if (duration !== "any") params.set("videoDuration", duration);

      const res = await fetch(`/api/youtube/search?${params}`);
      if (!res.ok) {
        toast.error("Search failed", {
          description: `Server returned ${res.status}`,
        });
        return;
      }
      const data = await res.json();

      if (data.error) {
        toast.error("Search failed", { description: data.error });
        return;
      }

      setResults(data.results || []);
      setQuotaUsed(data.meta?.quotaCost || null);
    } catch {
      toast.error("Search failed — check your connection");
    } finally {
      setLoading(false);
    }
  }, [query, searchType, sortOrder, duration]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Search bar */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                searchType === "keyword"
                  ? "Search thumbnails by keyword..."
                  : searchType === "channel"
                    ? "Enter channel ID..."
                    : "Hit search to load trending..."
              }
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "border-primary" : ""}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* Search type toggles */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[
              { type: "keyword" as SearchType, icon: Search, label: "Keyword" },
              { type: "trending" as SearchType, icon: TrendingUp, label: "Trending" },
              { type: "channel" as SearchType, icon: User, label: "Channel" },
            ].map(({ type, icon: Icon, label }) => (
              <Badge
                key={type}
                variant={searchType === type ? "default" : "outline"}
                className="cursor-pointer gap-1 px-3 py-1"
                onClick={() => setSearchType(type)}
              >
                <Icon className="h-3 w-3" />
                {label}
              </Badge>
            ))}
          </div>

          {quotaUsed !== null && (
            <span className="text-[10px] text-muted-foreground">
              {quotaUsed} quota units used
            </span>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex gap-4 rounded-lg border border-border bg-card p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Sort by
              </label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Upload date</SelectItem>
                  <SelectItem value="viewCount">View count</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Duration
              </label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="short">Short (&lt; 4 min)</SelectItem>
                  <SelectItem value="medium">Medium (4-20 min)</SelectItem>
                  <SelectItem value="long">Long (&gt; 20 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex items-center justify-between">
        {results.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {results.length} results
          </p>
        )}
      </div>

      <ThumbnailGrid videos={results} loading={loading} />
    </div>
  );
}
