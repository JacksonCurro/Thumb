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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStyleBoardStore } from "@/stores/style-board-store";
import { useGenerationStore } from "@/stores/generation-store";
import type { CreativeBrief, JobOutput } from "@/types";

export function GeneratePanel() {
  const { items } = useStyleBoardStore();
  const { setCurrentJob, setBrief, setActiveProfile } = useGenerationStore();

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("");
  const [description, setDescription] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<JobOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<string | null>(null); // data URL
  const [characterBase64, setCharacterBase64] = useState<string | null>(null); // raw base64

  const profileItems = items.filter((i) => i.extractedProfile);

  const selectedItem = profileItems.find(
    (i) => i.extractedProfile?.id === selectedProfileId
  );

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
    if (!selectedItem?.extractedProfile || !videoTitle.trim()) return;

    const profile = selectedItem.extractedProfile;
    const brief: CreativeBrief = {
      videoTitle,
      description,
      textOverlay: textOverlay || undefined,
      targetAudience: targetAudience || undefined,
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
          profile,
          brief,
          referenceImageUrl: selectedItem.thumbnailUrl,
          characterImageBase64: characterBase64 || undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        toast.error("Generation failed", { description: data.error });
        return;
      }

      setGeneratedPrompt(data.prompt);
      setCurrentJob(data.job);
      setBrief(brief);
      setActiveProfile(profile);

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
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `thumbnail-v${index + 1}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-auto p-6">
      {/* Left: Brief input */}
      <div className="flex w-[400px] shrink-0 flex-col gap-4">
        <h2 className="text-lg font-semibold">Creative Brief</h2>

        {/* Style profile selector */}
        <div className="space-y-2">
          <Label>Style Profile</Label>
          {profileItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No extracted profiles yet. Go to Style Board and extract styles
              from thumbnails first.
            </p>
          ) : (
            <Select
              value={selectedProfileId}
              onValueChange={setSelectedProfileId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a style profile..." />
              </SelectTrigger>
              <SelectContent>
                {profileItems.map((item) => (
                  <SelectItem
                    key={item.extractedProfile!.id}
                    value={item.extractedProfile!.id}
                  >
                    {item.extractedProfile!.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Reference thumbnail preview */}
        {selectedItem && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Style reference
            </Label>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
              <Image
                src={selectedItem.thumbnailUrl}
                alt="Style reference"
                fill
                className="object-cover"
                {...(selectedItem.source === "upload"
                  ? { unoptimized: true }
                  : {})}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedItem.extractedProfile?.moodTags
                .slice(0, 4)
                .map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
            </div>
          </div>
        )}

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
          <Label htmlFor="textOverlay">Text Overlay</Label>
          <Input
            id="textOverlay"
            value={textOverlay}
            onChange={(e) => setTextOverlay(e.target.value)}
            placeholder="e.g. 10 CSS TRICKS"
          />
          <p className="text-xs text-muted-foreground">
            The exact text displayed on the thumbnail
          </p>
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
          disabled={!selectedProfileId || !videoTitle.trim() || loading}
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
              Generate Thumbnail
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {generatedImages.map((output, i) => (
                <Card key={i} className="overflow-hidden p-0">
                  <div className="relative aspect-video">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadImage(output.url, i)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
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
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {generatedPrompt}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
