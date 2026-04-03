"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditEntry {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: Record<string, unknown>;
  isSketch: boolean;
  createdAt: string;
  userName: string;
  userColor: string;
}

interface UserOption {
  id: number;
  name: string;
  color: string;
}

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "activity_create", label: "activity_create" },
  { value: "activity_delete", label: "activity_delete" },
  { value: "amendment_propose", label: "amendment_propose" },
  { value: "amendment_withdraw", label: "amendment_withdraw" },
  { value: "vote_cast", label: "vote_cast" },
  { value: "pin_change", label: "pin_change" },
];

function formatDetail(entry: AuditEntry): string {
  const m = entry.metadata;
  switch (entry.action) {
    case "activity_create":
    case "activity_delete":
      return `${m.title} | ${m.type} | ${m.activityDate} | ${typeof m.points === "number" ? m.points.toFixed(2) : "0"} SFUs${m.isIndoor ? " | indoor" : ""}`;
    case "amendment_propose":
    case "amendment_withdraw":
      return `#${m.number} ${m.title}`;
    case "vote_cast":
      return `amendment #${m.amendmentNumber} | ${m.vote}`;
    case "pin_change":
      return "—";
    default:
      return JSON.stringify(m);
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [sketchOnly, setSketchOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const filtered = sketchOnly ? entries.filter((e) => e.isSketch) : entries;

  const loadEntries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterUser) params.set("userId", filterUser);
    if (filterAction) params.set("action", filterAction);
    params.set("limit", "200");

    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterUser, filterAction]);

  useEffect(() => {
    fetch("/api/amendments")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Audit Log</h1>
        <div className="flex gap-2">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded border border-stone-300 dark:border-stone-700 bg-card px-2 py-1 text-xs font-mono"
          >
            <option value="">user=*</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                user={u.name.toLowerCase()}
              </option>
            ))}
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="rounded border border-stone-300 dark:border-stone-700 bg-card px-2 py-1 text-xs font-mono"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value ? `action=${o.label}` : "action=*"}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-mono cursor-pointer select-none text-red-600 dark:text-red-400">
            <input
              type="checkbox"
              checked={sketchOnly}
              onChange={(e) => setSketchOnly(e.target.checked)}
              className="accent-red-600"
            />
            SKETCHY SHIT ONLY
          </label>
          <span className="text-xs text-muted-foreground self-center font-mono">
            {filtered.length} events
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-xs font-mono">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-xs font-mono">No events found.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-xs font-mono">No sketchy events found.</p>
      ) : (
        <div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-900 text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium w-[150px]">timestamp</th>
                <th className="px-2 py-1.5 font-medium w-[70px]">user</th>
                <th className="px-2 py-1.5 font-medium w-[140px]">action</th>
                <th className="px-2 py-1.5 font-medium">detail</th>
                <th className="px-2 py-1.5 font-medium w-[50px] text-center">flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/50">
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  className={
                    entry.isSketch
                      ? "bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200"
                      : "hover:bg-stone-50 dark:hover:bg-stone-900/50"
                  }
                >
                  <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.userColor }}
                      />
                      {entry.userName}
                    </span>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">{entry.action}</td>
                  <td className="px-2 py-1 text-muted-foreground truncate max-w-[400px]" title={formatDetail(entry)}>
                    {formatDetail(entry)}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {entry.isSketch && (
                      <span className="text-red-600 dark:text-red-400 font-bold uppercase tracking-wide">
                        SKETCH
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
