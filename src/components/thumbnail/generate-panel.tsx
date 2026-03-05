"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Copy,
  CheckCircle,
  Download,
  Loader2,
  AlertCircle,
  UserPlus,
  X,
  Pencil,
  Check,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useStyleBoardStore } from "@/stores/style-board-store";
import { useGenerationStore } from "@/stores/generation-store";
import { EditModal } from "./edit-modal";
import type { CreativeBrief, JobOutput, StyleBoardItem } from "@/types";

export function GeneratePanel() {
  const { items } = useStyleBoardStore();
  const { setCurrentJob, setBrief, setActiveProfile } = useGenerationStore();

  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [videoTitle, setVideoTitle] = useState("");
  const [description, setDescription] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [noText, setNoText] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<JobOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterBase64, setCharacterBase64] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);

  const profileItems = items.filter((i) => i.extractedProfile);

  const selectedItems = profileItems.filter(
    (i) => selectedProfileIds.includes(i.extractedProfile!.id)
  );

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCharacterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCharacterImage(dataUrl);
      setCharacterBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (selectedItems.length === 0 || !videoTitle.trim()) return;

    const profiles = selectedItems.map((i) => i.extractedProfile!);
    const referenceImageUrls = selectedItems.map((i) => i.thumbnailUrl);
    const brief: CreativeBrief = {
      videoTitle,
      description,
      textOverlay: noText ? undefined : (textOverlay || undefined),
      targetAudience: targetAudience || undefined,
      noText,
    };

    setLoading(true);
    setError(null);
    setGeneratedImages([]);
    setGeneratedPrompt(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles,
          brief,
          referenceImageUrls,
          characterImageBase64: characterBase64 || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        setError(`Server error (${res.status})`);
        toast.error("Generation failed", { description: errText });
        return;
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        toast.error("Generation failed", { description: data.error });
        return;
      }

      setGeneratedPrompt(data.prompt);
      setCurrentJob(data.job);
      setBrief(brief);
      setActiveProfile(profiles[0]);

      if (data.job.outputs?.length > 0) {
        setGeneratedImages(data.job.outputs);
        toast.success(`${data.job.outputs.length} thumbnails generated`);
      } else if (data.note) {
        toast.info(data.note);
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const a = document.createElement("a");
      a.download = `thumbnail-v${index + 1}-${Date.now()}.png`;
      if (url.startsWith("data:")) {
        a.href = url;
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        a.href = URL.createObjectURL(blob);
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!url.startsWith("data:")) URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Download failed");
    }
  };

  const exportLayeredSVG = async (url: string, index: number) => {
    setExportingIndex(index);
    try {
      const profiles = selectedItems.map((i) => i.extractedProfile!);
      const styleProfile = profiles[0];
      const brief: CreativeBrief = {
        videoTitle,
        description,
        textOverlay: noText ? undefined : (textOverlay || undefined),
        targetAudience: targetAudience || undefined,
        noText,
      };

      const res = await fetch("/api/export/layered-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: url, styleProfile, brief }),
      });

      if (!res.ok) {
        toast.error("SVG export failed", {
          description: `Server returned ${res.status}`,
        });
        return;
      }

      const data = await res.json();

      if (data.error) {
        toast.error("SVG export failed", { description: data.error });
        return;
      }

      // Download the SVG
      const blob = new Blob([data.svg], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.download = data.filename || `thumbnail-layered-${Date.now()}.svg`;
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      toast.success("Layered SVG exported");
    } catch {
      toast.error("SVG export failed — check your connection");
    } finally {
      setExportingIndex(null);
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-auto p-6">
      {/* Left: Brief input */}
      <div className="flex w-[520px] shrink-0 flex-col gap-4">
        <h2 className="text-lg font-semibold">Creative Brief</h2>

        {/* Style profile selector — multi-select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Style Profiles</Label>
            {selectedProfileIds.length > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedProfileIds.length} selected — styles will be combined
              </Badge>
            )}
          </div>
          {profileItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No extracted profiles yet. Go to Style Board and extract styles
              from thumbnails first.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {profileItems.map((item) => (
                <ProfileCard
                  key={item.extractedProfile!.id}
                  item={item}
                  selected={selectedProfileIds.includes(item.extractedProfile!.id)}
                  onToggle={() => toggleProfile(item.extractedProfile!.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Character / Model reference */}
        <div className="space-y-2">
          <Label>Character / Model Reference</Label>
          {characterImage ? (
            <div className="relative">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={characterImage}
                    alt="Character reference"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">Character uploaded</p>
                  <p className="text-[11px] text-muted-foreground">
                    This person will appear in the generated thumbnails
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCharacterImage(null);
                    setCharacterBase64(null);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 transition-colors hover:border-primary/50 hover:bg-accent/50">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">Add a person / model</p>
                <p className="text-[11px] text-muted-foreground">
                  Upload a clear photo — they'll appear in the thumbnail
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCharacterUpload}
              />
            </label>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="title">Video Title / Topic *</Label>
          <Input
            id="title"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="e.g. 10 CSS Tricks You Didn't Know"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description / Brief</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the video about? Key points, angle, tone..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="textOverlay">Text Overlay</Label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={noText}
                onChange={(e) => setNoText(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-xs text-muted-foreground">No text</span>
            </label>
          </div>
          {noText ? (
            <p className="text-xs text-muted-foreground">
              The thumbnail will be generated without any text or typography
            </p>
          ) : (
            <>
              <Input
                id="textOverlay"
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                placeholder="e.g. 10 CSS TRICKS"
              />
              <p className="text-xs text-muted-foreground">
                The exact text displayed on the thumbnail
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience">Target Audience</Label>
          <Input
            id="audience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. Beginner web developers"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={selectedProfileIds.length === 0 || !videoTitle.trim() || loading}
          className="mt-2"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating 3 variations...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {selectedProfileIds.length > 1
                ? `Generate from ${selectedProfileIds.length} Styles`
                : "Generate Thumbnail"}
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-lg font-semibold">Results</h2>

        {/* Generated images */}
        {generatedImages.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {generatedImages.map((output, i) => (
                <Card key={i} className="max-w-md overflow-hidden p-0">
                  <div
                    className="relative aspect-video cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => setEditingIndex(i)}
                  >
                    <Image
                      src={output.url}
                      alt={`Variation ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs text-muted-foreground">
                      Variation {i + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingIndex(i)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadImage(output.url, i)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => exportLayeredSVG(output.url, i)}
                        disabled={exportingIndex !== null}
                      >
                        {exportingIndex === i ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Layers className="mr-1 h-3 w-3" />
                        )}
                        SVG
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating 3 thumbnail variations...
            </p>
            <p className="text-xs text-muted-foreground">
              This usually takes 15-30 seconds
            </p>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Fill in the brief and select a style to generate thumbnails
              </p>
            </div>
          </div>
        )}

        {/* Prompt preview */}
        {generatedPrompt && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Generated Prompt</CardTitle>
              <Button size="sm" variant="ghost" onClick={copyPrompt}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <p className={`whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground ${promptExpanded ? "" : "line-clamp-3"}`}>
                {generatedPrompt}
              </p>
              <button
                type="button"
                onClick={() => setPromptExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {promptExpanded ? "Show less" : "Read more"}
              </button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit modal */}
      {editingIndex !== null && generatedImages[editingIndex] && (
        <EditModal
          open
          onClose={() => setEditingIndex(null)}
          imageUrl={generatedImages[editingIndex].url}
          variationIndex={editingIndex}
          onAccept={(editedUrl) => {
            setGeneratedImages((prev) =>
              prev.map((img, i) =>
                i === editingIndex ? { ...img, url: editedUrl } : img
              )
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Profile Card (clickable multi-select) ────────────────────────────────────

function ProfileCard({
  item,
  selected,
  onToggle,
}: {
  item: StyleBoardItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative overflow-hidden rounded-lg border-2 text-left transition-all ${
        selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      <div className="relative aspect-video">
        <Image
          src={item.thumbnailUrl}
          alt={item.extractedProfile!.name}
          fill
          className="object-cover"
          {...(item.source === "upload" ? { unoptimized: true } : {})}
        />
        {selected && (
          <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="p-1.5">
        <p className="truncate text-[11px] font-medium">
          {item.extractedProfile!.name}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {item.extractedProfile!.moodTags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}
