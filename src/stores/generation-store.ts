import { create } from "zustand";
import type { ThumbnailJob, CreativeBrief, StyleProfile } from "@/types";

interface GenerationState {
  currentBrief: CreativeBrief | null;
  activeProfile: StyleProfile | null;
  currentJob: ThumbnailJob | null;
  jobHistory: ThumbnailJob[];

  setBrief: (brief: CreativeBrief) => void;
  setActiveProfile: (profile: StyleProfile) => void;
  setCurrentJob: (job: ThumbnailJob) => void;
  updateJobStatus: (job: Partial<ThumbnailJob>) => void;
  clearCurrentJob: () => void;
}

export const useGenerationStore = create<GenerationState>()((set) => ({
  currentBrief: null,
  activeProfile: null,
  currentJob: null,
  jobHistory: [],

  setBrief: (brief) => set({ currentBrief: brief }),

  setActiveProfile: (profile) => set({ activeProfile: profile }),

  setCurrentJob: (job) =>
    set((state) => ({
      currentJob: job,
      jobHistory: [job, ...state.jobHistory],
    })),

  updateJobStatus: (update) =>
    set((state) => {
      if (!state.currentJob) return state;
      const updated = { ...state.currentJob, ...update };
      return {
        currentJob: updated,
        jobHistory: state.jobHistory.map((j) =>
          j.id === updated.id ? updated : j
        ),
      };
    }),

  clearCurrentJob: () => set({ currentJob: null }),
}));
