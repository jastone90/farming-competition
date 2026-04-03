"use client";

import { useState } from "react";

const userOptions = ["Alan", "Brian", "Martin", "Will"];

export default function LoginPage() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-md shadow-stone-200/50 dark:shadow-none">
        <div className="text-center mb-6">
          <span className="text-4xl">🌾</span>
          <h1 className="text-xl font-bold mt-2">Farming Competition</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Who are you?</label>
            <div className="grid grid-cols-2 gap-2">
              {userOptions.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setName(u)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    name === u
                      ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-500"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">PIN</label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-lg tracking-widest"
            />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <button
            type="submit"
            disabled={!name || pin.length < 4 || loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
