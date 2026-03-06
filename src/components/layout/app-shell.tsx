"use client";

import { useState } from "react";
import { Search, Palette, Sparkles, FolderOpen, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/theme-provider";

const NAV_ITEMS = [
  { id: "browse", label: "Browse", icon: Search },
  { id: "board", label: "Style Board", icon: Palette },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "profiles", label: "Profiles", icon: FolderOpen },
] as const;

export type TabId = (typeof NAV_ITEMS)[number]["id"];

interface AppShellProps {
  panels: Record<TabId, React.ReactNode>;
}

export function AppShell({ panels }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>("browse");
  const { theme, toggleTheme } = useTheme();

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
        <button
          onClick={toggleTheme}
          className="ml-auto rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Content — all panels stay mounted, only the active one is visible */}
      <main className="relative flex-1 overflow-hidden">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={cn(
              "absolute inset-0 overflow-auto",
              activeTab === item.id ? "visible" : "invisible"
            )}
          >
            {panels[item.id]}
          </div>
        ))}
      </main>
    </div>
  );
}
