"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/activities", label: "Activities" },
  { href: "/amendments", label: "Amendments" },
  { href: "/", label: "Almanac" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{
    id: number;
    name: string;
    color: string;
  } | null>(null);
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user || null);
      })
      .catch(() => setUser(null));
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
    } catch {
      // If server logout fails, force reload to re-check session
    }
    setUser(null);
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 dark:border-stone-800 bg-card/80 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/activities" className="flex items-center gap-2 font-bold text-lg">
          <span>🌾</span>
          <span className="hidden sm:inline">Farming Competition</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-100/60 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Toggle dark mode"
          >
            {dark ? "☀️" : "🌙"}
          </button>

          <button
            onClick={() => router.push("/music")}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Music"
          >
            🎵
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${user.id}`}
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-amber-400 transition-all"
                style={{ backgroundColor: user.color }}
              >
                {user.name[0]}
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              Login
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-2">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block py-2 text-sm font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
