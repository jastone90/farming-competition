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
  config: Record<string, number | string | boolean>;
  isActive: boolean;
  effectiveSeason: number;
}

interface EngineVersion {
  id: number;
  version: string;
  summary: string;
  effectiveDate: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rules, setRules] = useState<ScoringRuleInfo[]>([]);
  const [versions, setVersions] = useState<EngineVersion[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [newName, setNewName] = useState("");
  const [newUserPin, setNewUserPin] = useState("");
  const [newColor, setNewColor] = useState("");
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState("");
  const [colorMsg, setColorMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [colorLoading, setColorLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      })
      .catch(() => {});

    fetch("/api/users")
      .then((r) => r.json())
      .then(setAllUsers)
      .catch(() => {});

    fetch("/api/scoring/rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => {});

    fetch("/api/scoring/versions")
      .then((r) => r.json())
      .then(setVersions)
      .catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/strava/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      const data = await res.json();
      const typeCounts = Object.entries(data.importedTypes as Record<string, number>)
        .map(([t, n]) => `${n} ${t}`)
        .join(", ");
      const skippedCounts = Object.entries(data.skippedTypes as Record<string, number>)
        .map(([t, n]) => `${n} ${t}`)
        .join(", ");
      let msg = `Imported ${data.imported} activities`;
      if (typeCounts) msg += ` (${typeCounts})`;
      if (data.skipped > 0) msg += `, skipped ${data.skipped} unsupported (${skippedCounts})`;
      setSyncResult(msg);
    } else {
      const data = await res.json();
      setSyncResult(data.error || "Sync failed");
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinMsg(null);
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json();
    if (res.ok) {
      setPinMsg({ text: "PIN updated", ok: true });
      setCurrentPin("");
      setNewPin("");
      setTimeout(() => {
        setShowPinModal(false);
        setPinMsg(null);
      }, 1000);
    } else {
      setPinMsg({ text: data.error || "Failed to change PIN", ok: false });
    }
  }

  const colorPresets = [
    // Row 1: iOS system colors
    "#007AFF", "#34C759", "#FF9500", "#FF3B30",
    "#AF52DE", "#5856D6", "#FF2D55", "#00C7BE",
    // Row 2: extended palette
    "#30B0C7", "#A2845E", "#64D2FF", "#FFD60A",
    "#BF5AF2", "#FF6482", "#32D74B", "#0A84FF",
  ];
  const takenColors = new Set(allUsers.map((u) => u.color.toUpperCase()));

  async function handleAddCompetitor(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    setAddLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, pin: newUserPin, color: newColor }),
    });
    const data = await res.json();
    setAddLoading(false);
    if (res.ok) {
      setAddMsg({ text: `${data.name} added!`, ok: true });
      setAllUsers((prev) => [...prev, { ...data, stravaAthleteId: null }]);
      setNewName("");
      setNewUserPin("");
      setNewColor("");
      setTimeout(() => {
        setShowAddModal(false);
        setAddMsg(null);
      }, 1000);
    } else {
      setAddMsg({ text: data.error || "Failed to add competitor", ok: false });
    }
  }

  async function handleChangeColor(e: React.FormEvent) {
    e.preventDefault();
    setColorMsg(null);
    setColorLoading(true);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: selectedColor }),
    });
    const data = await res.json();
    setColorLoading(false);
    if (res.ok) {
      setColorMsg({ text: "Color updated!", ok: true });
      setUser((prev) => prev ? { ...prev, color: selectedColor } : prev);
      setAllUsers((prev) => prev.map((u) => u.id === user?.id ? { ...u, color: selectedColor } : u));
      setTimeout(() => {
        setShowColorModal(false);
        setColorMsg(null);
      }, 1000);
    } else {
      setColorMsg({ text: data.error || "Failed to change color", ok: false });
    }
  }

  // Extract rule configs
  function getRule(type: string) {
    return rules.find((r) => r.ruleType === type);
  }
  function getAllRules(type: string) {
    return rules.filter((r) => r.ruleType === type);
  }

  // Derive values from rules
  const runPPM = Number(getRule("base_running")?.config.pointsPerMile ?? 4);
  const bikePPM = Number(getRule("base_biking")?.config.pointsPerMile ?? 1);

  const elevRules = getAllRules("elevation_bonus");
  const runElevPPF = Number(
    elevRules.find((r) => r.config.activityType === "run")?.config.pointsPerFoot ?? 0.013
  );
  const bikeElevPPF = Number(
    elevRules.find((r) => r.config.activityType === "ride")?.config.pointsPerFoot ?? 0.003
  );

  const weightPer1000 = Number(getRule("weight_training")?.config.pointsPer1000Lbs ?? 0.5);
  const swimPPM = Number(getRule("base_swimming")?.config.pointsPerMile ?? 25);

  const loaded = rules.length > 0;
  const currentVersion = versions.length > 0 ? versions[0].version : "1.0";

  function ScoringCard({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/70 text-sm font-semibold border-b border-border">
          {title}
        </div>
        <div className="px-3 py-3 space-y-2 text-xs">{children}</div>
      </div>
    );
  }

  function Val({ children }: { children: React.ReactNode }) {
    return (
      <span className="text-amber-600 dark:text-amber-400 font-semibold">{children}</span>
    );
  }

  function FormulaLine({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{children}</span>
      </div>
    );
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
          {/* Profile & Strava */}
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
                <tr className="bg-background">
                  <td className="border border-border px-2 py-1.5 font-semibold">Actions</td>
                  <td className="border border-border px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setShowPinModal(true); setPinMsg(null); setCurrentPin(""); setNewPin(""); }}
                        className="px-2 py-0.5 text-xs font-medium border border-input hover:bg-muted"
                      >
                        Change PIN
                      </button>
                      <button
                        onClick={() => { setShowColorModal(true); setColorMsg(null); setSelectedColor(user.color); }}
                        className="px-2 py-0.5 text-xs font-medium border border-input hover:bg-muted"
                      >
                        Change Color
                      </button>
                      <button
                        onClick={() => { setShowAddModal(true); setAddMsg(null); setNewName(""); setNewUserPin(""); setNewColor(""); }}
                        className="px-2 py-0.5 text-xs font-medium border border-input hover:bg-muted"
                      >
                        Add Competitor
                      </button>
                      {user.stravaAthleteId ? (
                        <button
                          onClick={handleSync}
                          disabled={syncing}
                          className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 border border-orange-600 disabled:opacity-50 min-w-[180px]"
                        >
                          {syncing ? "Syncing..." : <>Strava&#8482; Sync <span className="text-[10px] opacity-80">({new Date().getFullYear()} activities)</span></>}
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

          {/* Current Scoring Rules */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <span>Scoring Engine</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded">
                v{currentVersion}
              </span>
            </div>
            {!loaded ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Running */}
                <ScoringCard title="Running">
                  <FormulaLine label="Distance">× <Val>{runPPM.toFixed(2)}</Val> pts/mi</FormulaLine>
                  <FormulaLine label="Elevation">× <Val>{runElevPPF}</Val> pts/ft</FormulaLine>
                  <div className="border-t border-border pt-2 mt-1">
                    <div className="text-muted-foreground mb-0.5">Example: 5 mi + 800 ft</div>
                    <div className="font-mono">
                      = {(5 * runPPM).toFixed(1)} + {(800 * runElevPPF).toFixed(1)} ={" "}
                      <span className="font-semibold">
                        {(5 * runPPM + 800 * runElevPPF).toFixed(1)} SFUs
                      </span>
                    </div>
                  </div>
                </ScoringCard>

                {/* Cycling */}
                <ScoringCard title="Cycling">
                  <FormulaLine label="Distance">× <Val>{bikePPM.toFixed(2)}</Val> pts/mi</FormulaLine>
                  <FormulaLine label="Elevation">× <Val>{bikeElevPPF}</Val> pts/ft</FormulaLine>
                  <div className="border-t border-border pt-2 mt-1">
                    <div className="text-muted-foreground mb-0.5">Example: 20 mi + 1,500 ft</div>
                    <div className="font-mono">
                      = {(20 * bikePPM).toFixed(1)} + {(1500 * bikeElevPPF).toFixed(1)} ={" "}
                      <span className="font-semibold">
                        {(20 * bikePPM + 1500 * bikeElevPPF).toFixed(1)} SFUs
                      </span>
                    </div>
                  </div>
                </ScoringCard>

                {/* Weight Training */}
                <ScoringCard title="Weight Training (Haybailz)">
                  <FormulaLine label="Pounds">× <Val>{weightPer1000}</Val> pts/1,000 lbs</FormulaLine>
                  <div className="border-t border-border pt-2 mt-1">
                    <div className="text-muted-foreground mb-0.5">Example: 12,000 lbs</div>
                    <div className="font-mono">
                      ={" "}
                      <span className="font-semibold">
                        {((12000 / 1000) * weightPer1000).toFixed(1)} SFUs
                      </span>
                    </div>
                  </div>
                </ScoringCard>

                {/* Swimming */}
                <ScoringCard title="Swimming">
                  <FormulaLine label="Distance">× <Val>{swimPPM.toFixed(2)}</Val> pts/mi</FormulaLine>
                  <div className="border-t border-border pt-2 mt-1">
                    <div className="text-muted-foreground mb-0.5">Example: 1 mi</div>
                    <div className="font-mono">
                      ={" "}
                      <span className="font-semibold">
                        {(1 * swimPPM).toFixed(1)} SFUs
                      </span>
                    </div>
                  </div>
                </ScoringCard>
              </div>
            )}

            {/* Version Audit Log */}
            {versions.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold mb-1.5 text-muted-foreground">Version History</div>
                <div className="border border-border">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/70">
                        <th className="border border-border px-2 py-1.5 text-left font-semibold w-20">Version</th>
                        <th className="border border-border px-2 py-1.5 text-left font-semibold w-28">Effective</th>
                        <th className="border border-border px-2 py-1.5 text-left font-semibold">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v, i) => (
                        <tr key={v.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <td className="border border-border px-2 py-1.5 font-mono font-semibold">v{v.version}</td>
                          <td className="border border-border px-2 py-1.5">
                            {new Date(v.effectiveDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="border border-border px-2 py-1.5">{v.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPinModal(false)}>
          <div className="bg-card border border-border shadow-lg w-72 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold mb-3">Change PIN</h2>
            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Current PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="----"
                  className="w-full border border-input bg-background px-2 py-1.5 text-sm text-center tracking-widest"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="----"
                  className="w-full border border-input bg-background px-2 py-1.5 text-sm text-center tracking-widest"
                />
              </div>
              {pinMsg && (
                <p className={`text-xs font-medium ${pinMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {pinMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={currentPin.length < 4 || newPin.length < 4}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary disabled:opacity-50"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-input hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border shadow-lg w-72 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold mb-3">Add Competitor</h2>
            <form onSubmit={handleAddCompetitor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="w-full border border-input bg-background px-2 py-1.5 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full border border-input bg-background px-2 py-1.5 text-sm text-center tracking-widest"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((c) => {
                    const taken = takenColors.has(c.toUpperCase());
                    const selected = newColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={taken}
                        onClick={() => setNewColor(c)}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${
                          selected
                            ? "border-foreground scale-110"
                            : taken
                            ? "border-transparent opacity-25 cursor-not-allowed"
                            : "border-transparent hover:border-muted-foreground"
                        }`}
                        style={{ backgroundColor: c }}
                        title={taken ? "Already taken" : c}
                      />
                    );
                  })}
                </div>
              </div>
              {addMsg && (
                <p className={`text-xs font-medium ${addMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {addMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newName.trim() || newUserPin.length < 4 || !newColor || addLoading}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary disabled:opacity-50"
                >
                  {addLoading ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-input hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Color Modal */}
      {showColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowColorModal(false)}>
          <div className="bg-card border border-border shadow-lg w-72 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold mb-3">Change Color</h2>
            <form onSubmit={handleChangeColor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Pick a new color</label>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((c) => {
                    const takenByOther = allUsers.some(
                      (u) => u.id !== user?.id && u.color.toUpperCase() === c.toUpperCase()
                    );
                    const selected = selectedColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={takenByOther}
                        onClick={() => setSelectedColor(c)}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${
                          selected
                            ? "border-foreground scale-110"
                            : takenByOther
                            ? "border-transparent opacity-25 cursor-not-allowed"
                            : "border-transparent hover:border-muted-foreground"
                        }`}
                        style={{ backgroundColor: c }}
                        title={takenByOther ? "Taken by another competitor" : c}
                      />
                    );
                  })}
                </div>
              </div>
              {colorMsg && (
                <p className={`text-xs font-medium ${colorMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {colorMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!selectedColor || selectedColor === user?.color || colorLoading}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary disabled:opacity-50"
                >
                  {colorLoading ? "Saving..." : "Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowColorModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-input hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
