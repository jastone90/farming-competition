"use client";

import { useEffect, useState } from "react";

interface UserInfo {
  id: number;
  name: string;
  color: string;
  stravaAthleteId: string | null;
}

interface ScoringRuleInfo {
  id: number;
  ruleType: string;
  config: Record<string, unknown>;
  isActive: boolean;
  effectiveSeason: number;
}

const ruleLabels: Record<string, string> = {
  base_biking: "Base Biking (1 pt/mi)",
  base_running: "Base Running (1 pt/mi)",
  indoor_modifier: "Indoor Modifier (83%)",
  elevation_bonus: "Elevation Bonus (Running)",
  general_physical: "General Physical Activity (5 pts/30 min)",
  calorie_scoring: "Calorie-Based Scoring (1 pt/40 cal)",
  handicap: "Martin William Paul Ayers Memorial Handicap",
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rules, setRules] = useState<ScoringRuleInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      })
      .catch(() => {});

    fetch("/api/scoring/rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/strava/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      const data = await res.json();
      setSyncResult(`Imported ${data.imported} activities`);
    } else {
      const data = await res.json();
      setSyncResult(data.error || "Sync failed");
    }
  }

  return (
    <div className="px-4 py-4 max-w-full">
      <h1 className="text-lg font-bold mb-3">Settings</h1>

      {!user ? (
        <div className="border border-border p-3 text-xs text-muted-foreground">
          Please <a href="/login" className="text-primary hover:underline">log in</a> to access settings.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Profile & Strava - key-value table */}
          <div className="border border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70">
                  <th className="border border-border px-2 py-1.5 text-left font-semibold" colSpan={2}>
                    Profile & Strava
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-background">
                  <td className="border border-border px-2 py-1.5 font-semibold w-1/3">User</td>
                  <td className="border border-border px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: user.color }}
                      />
                      {user.name}
                    </span>
                  </td>
                </tr>
                <tr className="bg-muted/30">
                  <td className="border border-border px-2 py-1.5 font-semibold">User ID</td>
                  <td className="border border-border px-2 py-1.5 tabular-nums">{user.id}</td>
                </tr>
                <tr className="bg-background">
                  <td className="border border-border px-2 py-1.5 font-semibold">Strava Status</td>
                  <td className="border border-border px-2 py-1.5">
                    {user.stravaAthleteId ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                        <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                        <span className="text-muted-foreground">(Athlete {user.stravaAthleteId})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">Not connected</span>
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="bg-muted/30">
                  <td className="border border-border px-2 py-1.5 font-semibold">Actions</td>
                  <td className="border border-border px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {user.stravaAthleteId ? (
                        <button
                          onClick={handleSync}
                          disabled={syncing}
                          className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 border border-orange-600 disabled:opacity-50"
                        >
                          {syncing ? "Syncing..." : "Sync Past Activities"}
                        </button>
                      ) : (
                        <a
                          href="/api/strava/auth"
                          className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 border border-orange-600"
                        >
                          Connect Strava
                        </a>
                      )}
                      {syncResult && (
                        <span className="text-muted-foreground">{syncResult}</span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Scoring Rules Table */}
          <div className="border border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70">
                  <th className="border border-border px-2 py-1.5 text-left font-semibold">Scoring Rule</th>
                  <th className="border border-border px-2 py-1.5 text-left font-semibold">Since</th>
                  <th className="border border-border px-2 py-1.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => (
                  <tr
                    key={rule.id}
                    className={`hover:bg-amber-50 dark:hover:bg-amber-950/20 ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    <td className="border border-border px-2 py-1">
                      {ruleLabels[rule.ruleType] || rule.ruleType}
                    </td>
                    <td className="border border-border px-2 py-1 tabular-nums">{rule.effectiveSeason}</td>
                    <td className="border border-border px-2 py-1 text-center">
                      <span className="text-green-600 dark:text-green-400 font-semibold">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
