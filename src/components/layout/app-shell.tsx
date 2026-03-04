"use client";

import { useState } from "react";
import { Search, Palette, Sparkles, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "browse", label: "Browse", icon: Search },
  { id: "board", label: "Style Board", icon: Palette },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "profiles", label: "Profiles", icon: FolderOpen },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>("browse");

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center border-b border-border px-6">
        <h1 className="text-lg font-semibold tracking-tight">Thumbnail OS</h1>
        <nav className="ml-8 flex gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">{children(activeTab)}</main>
    </div>
  );
}
