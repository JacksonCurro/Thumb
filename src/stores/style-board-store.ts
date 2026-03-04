import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StyleBoardItem, StyleProfile } from "@/types";

interface StyleBoardState {
  items: StyleBoardItem[];
  selectedItems: string[];

  addItem: (item: Omit<StyleBoardItem, "id" | "addedAt">) => void;
  removeItem: (id: string) => void;
  clearBoard: () => void;

  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  updateItemProfile: (id: string, profile: StyleProfile) => void;
  renameProfile: (id: string, name: string) => void;
}

export const useStyleBoardStore = create<StyleBoardState>()(
  persist(
    (set) => ({
      items: [],
      selectedItems: [],

      addItem: (item) =>
        set((state) => {
          // Prevent duplicates by thumbnailUrl
          if (state.items.some((i) => i.thumbnailUrl === item.thumbnailUrl)) {
            return state;
          }
          return {
            items: [
              ...state.items,
              {
                ...item,
                id: crypto.randomUUID(),
                addedAt: new Date().toISOString(),
              },
            ],
          };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          selectedItems: state.selectedItems.filter((i) => i !== id),
        })),

      clearBoard: () => set({ items: [], selectedItems: [] }),

      toggleSelection: (id) =>
        set((state) => ({
          selectedItems: state.selectedItems.includes(id)
            ? state.selectedItems.filter((i) => i !== id)
            : [...state.selectedItems, id],
        })),

      clearSelection: () => set({ selectedItems: [] }),

      selectAll: () =>
        set((state) => ({
          selectedItems: state.items.map((i) => i.id),
        })),

      updateItemProfile: (id, profile) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, extractedProfile: profile } : i
          ),
        })),

      renameProfile: (id, name) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id && i.extractedProfile
              ? { ...i, extractedProfile: { ...i.extractedProfile, name } }
              : i
          ),
        })),
    }),
    {
      name: "thumbnail-os-style-board",
    }
  )
);
