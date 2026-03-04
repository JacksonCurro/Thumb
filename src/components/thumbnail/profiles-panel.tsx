"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check } from "lucide-react";
import { useStyleBoardStore } from "@/stores/style-board-store";

export function ProfilesPanel() {
  const { items, removeItem, renameProfile } = useStyleBoardStore();
  const profileItems = items.filter((i) => i.extractedProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const confirmRename = (id: string) => {
    if (editValue.trim()) {
      renameProfile(id, editValue.trim());
    }
    setEditingId(null);
  };

  if (profileItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        No saved style profiles yet. Extract styles from thumbnails on your
        Style Board.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
      {profileItems.map((item) => {
        const profile = item.extractedProfile!;
        const isEditing = editingId === item.id;

        return (
          <Card key={item.id} className="overflow-hidden p-0">
            {/* Thumbnail preview */}
            <div className="relative aspect-video w-full">
              <Image
                src={item.thumbnailUrl}
                alt={profile.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                {...(item.source === "upload" ? { unoptimized: true } : {})}
              />
            </div>

            <CardHeader className="flex flex-row items-start justify-between pb-2 pt-3">
              <div className="flex-1 pr-2">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename(item.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => confirmRename(item.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="group/name flex items-center gap-1">
                    <p className="text-base font-bold">{profile.name}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startRename(item.id, profile.name)}
                      className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover/name:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-0.5 overflow-hidden rounded">
                {[...profile.palette.dominant, ...profile.palette.accent].map(
                  (hex, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1"
                      style={{ backgroundColor: hex }}
                    />
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="capitalize">
                    {profile.layout.subjectPosition}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Text: </span>
                  <span className="capitalize">
                    {profile.layout.textZone}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {profile.moodTags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {profile.moodTags.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{profile.moodTags.length - 4}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
