"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import {
  Trash2,
  Upload,
  Loader2,
  Eye,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useStyleBoardStore } from "@/stores/style-board-store";
import { StyleProfileView } from "./style-profile-view";
import type { StyleProfile, ExtractionResult } from "@/types";

export function StyleBoardPanel() {
  const { items, removeItem, addItem, updateItemProfile } =
    useStyleBoardStore();
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<StyleProfile | null>(
    null
  );

  // File upload via drag-and-drop
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          addItem({
            source: "upload",
            thumbnailUrl: dataUrl,
            title: file.name,
          });
        };
        reader.readAsDataURL(file);
      });
    },
    [addItem]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const handleExtract = async (id: string, thumbnailUrl: string) => {
    setExtractingId(id);
    try {
      let body: Record<string, string>;
      const itemName = items.find((i) => i.id === id)?.title || "Extracted Style";

      if (thumbnailUrl.startsWith("data:")) {
        const [meta, data] = thumbnailUrl.split(",");
        const mediaType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
        body = { imageBase64: data, mediaType, name: itemName };
      } else {
        body = { imageUrl: thumbnailUrl, name: itemName };
      }

      const res = await fetch("/api/extract-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        toast.error("Extraction failed", { description: data.error });
        return;
      }

      const extraction = data.result as ExtractionResult & {
        promptVersion: string;
      };

      const profile: StyleProfile = {
        id: data.profileId || crypto.randomUUID(),
        userId: "demo-user",
        name: itemName,
        sourceType: "extracted",
        palette: extraction.palette,
        layout: extraction.layout,
        typography: extraction.typography,
        moodTags: extraction.moodTags,
        rawDescriptors: extraction.rawDescriptors,
        promptVersion: extraction.promptVersion,
        createdAt: new Date().toISOString(),
      };

      updateItemProfile(id, profile);
      toast.success("Style extracted", {
        description: `${extraction.moodTags.slice(0, 3).join(", ")}`,
      });
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Extraction failed", {
        description: "Check the console for details",
      });
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop thumbnails here or click to upload
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP up to 10MB
        </p>
      </div>

      {/* Board items */}
      {items.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Your style board is empty. Browse thumbnails or upload your own.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""} on board
              {" — "}
              {items.filter((i) => i.extractedProfile).length} extracted
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Card
                key={item.id}
                className="group relative overflow-hidden p-0"
              >
                <div className="relative aspect-video">
                  <Image
                    src={item.thumbnailUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    {...(item.source === "upload" ? { unoptimized: true } : {})}
                  />

                  {/* Status indicator */}
                  <div className="absolute right-2 top-2">
                    {item.extractedProfile ? (
                      <Badge
                        variant="default"
                        className="gap-1 bg-green-600 text-xs"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Extracted
                      </Badge>
                    ) : extractingId === item.id ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analysing...
                      </Badge>
                    ) : null}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                    {!item.extractedProfile && extractingId !== item.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleExtract(item.id, item.thumbnailUrl)
                        }
                      >
                        Extract Style
                      </Button>
                    )}
                    {item.extractedProfile && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setViewingProfile(item.extractedProfile!)
                        }
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="p-2">
                  <p className="line-clamp-1 text-xs font-medium">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.source === "upload" ? "Uploaded" : "YouTube"}
                    {item.extractedProfile && (
                      <span className="ml-1 text-green-500">
                        — {item.extractedProfile.moodTags.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Profile viewer dialog */}
      <Dialog
        open={!!viewingProfile}
        onOpenChange={() => setViewingProfile(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Style Profile</DialogTitle>
          </DialogHeader>
          {viewingProfile && <StyleProfileView profile={viewingProfile} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
