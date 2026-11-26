import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "trime-theme-mode";

function initialMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  } catch {
    return "dark";
  }
}

/** Switches the editor chrome only; the keyboard preview keeps its own light/dark scheme. */
export function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    const meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", mode === "dark" ? "#0b1118" : "#f6f8fa");
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Private browsing can reject storage writes; the in-memory choice still applies.
    }
  }, [mode]);

  const next: ThemeMode = mode === "dark" ? "light" : "dark";
  const label = next === "dark" ? "切换到深色界面" : "切换到浅色界面";

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={mode === "dark"}
      onClick={() => setMode(next)}
    >
      {mode === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
