"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Pencil, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  variationIndex: number;
  onAccept: (editedUrl: string) => void;
}

export function EditModal({
  open,
  onClose,
  imageUrl,
  variationIndex,
  onAccept,
}: EditModalProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  // Track the "current" image — starts as original, updates after each edit
  const [currentUrl, setCurrentUrl] = useState(imageUrl);

  // Reset state when modal opens with a new image
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setInstruction("");
      setEditedUrl(null);
      setCurrentUrl(imageUrl);
      onClose();
    }
  };

  const handleEdit = async () => {
    if (!instruction.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/generate/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: currentUrl,
          editInstruction: instruction.trim(),
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error("Edit failed", { description: data.error });
        return;
      }

      setEditedUrl(data.editedImageUrl);
      setInstruction("");
    } catch {
      toast.error("Edit failed — check your connection");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (editedUrl) {
      onAccept(editedUrl);
      handleOpenChange(false);
    }
  };

  const handleTryAgain = () => {
    // Keep the current base image, clear the edit result
    setEditedUrl(null);
    setInstruction("");
  };

  const handleKeepAndEditMore = () => {
    // Accept the edit as the new base and continue editing
    if (editedUrl) {
      setCurrentUrl(editedUrl);
      setEditedUrl(null);
      setInstruction("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault();
      handleEdit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-[90vw] !w-[90vw]">
        <DialogHeader>
          <DialogTitle>Edit Variation {variationIndex + 1}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image preview */}
          <div className="grid grid-cols-1 gap-3">
            {editedUrl ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Before</p>
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
                    <Image
                      src={currentUrl}
                      alt="Original"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">After</p>
                  <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-primary">
                    <Image
                      src={editedUrl}
                      alt="Edited"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
                <Image
                  src={currentUrl}
                  alt={`Variation ${variationIndex + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          {/* Edit input or action buttons */}
          {editedUrl ? (
            <div className="flex gap-2">
              <Button onClick={handleAccept} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Use This
              </Button>
              <Button
                onClick={handleKeepAndEditMore}
                variant="outline"
                className="flex-1"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit More
              </Button>
              <Button onClick={handleTryAgain} variant="ghost" size="icon">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what to change... (e.g. 'make the t-shirt white')"
                rows={2}
                className="flex-1 resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleEdit}
                disabled={!instruction.trim() || loading}
                className="self-end"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
