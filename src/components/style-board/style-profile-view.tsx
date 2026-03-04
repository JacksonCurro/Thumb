"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { StyleProfile } from "@/types";

interface StyleProfileViewProps {
  profile: StyleProfile;
}

export function StyleProfileView({ profile }: StyleProfileViewProps) {
  return (
    <div className="space-y-6">
      {/* Colour Palette */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Colour Palette
        </h3>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Dominant</p>
            <div className="flex gap-2">
              {profile.palette.dominant.map((hex, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="h-8 w-8 rounded-md border border-border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Accent</p>
            <div className="flex gap-2">
              {profile.palette.accent.map((hex, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="h-8 w-8 rounded-md border border-border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Layout */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Composition
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Subject Position</p>
            <p className="text-sm font-medium capitalize">
              {profile.layout.subjectPosition}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Text Zone</p>
            <p className="text-sm font-medium capitalize">
              {profile.layout.textZone}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Typography */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Typography
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="text-sm font-medium capitalize">
              {profile.typography.weightStyle}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Case</p>
            <p className="text-sm font-medium capitalize">
              {profile.typography.caseStyle}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hierarchy</p>
            <p className="text-sm font-medium capitalize">
              {profile.typography.sizeHierarchy}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Mood Tags */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Mood Tags
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {profile.moodTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Raw Descriptors */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Visual Description
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {profile.rawDescriptors}
        </p>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        Prompt version: {profile.promptVersion}
      </div>
    </div>
  );
}
