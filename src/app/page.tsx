"use client";

import { AppShell } from "@/components/layout/app-shell";
import { BrowsePanel } from "@/components/thumbnail/browse-panel";
import { StyleBoardPanel } from "@/components/style-board/style-board-panel";
import { GeneratePanel } from "@/components/thumbnail/generate-panel";
import { ProfilesPanel } from "@/components/thumbnail/profiles-panel";

export default function Home() {
  return (
    <AppShell>
      {(activeTab) => {
        switch (activeTab) {
          case "browse":
            return <BrowsePanel />;
          case "board":
            return <StyleBoardPanel />;
          case "generate":
            return <GeneratePanel />;
          case "profiles":
            return <ProfilesPanel />;
        }
      }}
    </AppShell>
  );
}
