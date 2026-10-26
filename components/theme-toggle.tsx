"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ mobile }: { mobile?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={mobile ? "size-9" : "size-12"} />;

  const isDark = resolvedTheme === "dark";

  if (mobile) {
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        title="Toggle theme"
        className="flex min-w-16 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold text-cream/60"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
        Theme
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Toggle theme"
      className="grid size-12 place-items-center rounded-2xl text-cream/60 hover:text-cream"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
