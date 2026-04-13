"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

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
  { value: "user_create", label: "user_create" },
  { value: "color_change", label: "color_change" },
  { value: "strava_sync", label: "strava_sync" },
];

function formatDetail(entry: AuditEntry): string {
  const m = entry.metadata;
  switch (entry.action) {
    case "activity_create":
    case "activity_delete":
      return `${m.title} | ${m.type} | ${m.activityDate} | ${typeof m.points === "number" ? m.points.toFixed(2) : "0"} SFUs${m.isIndoor ? " | 🏠" : ""}`;
    case "amendment_propose":
    case "amendment_withdraw":
      return `#${m.number} ${m.title}`;
    case "vote_cast":
      return `amendment #${m.amendmentNumber} | ${m.vote}`;
    case "pin_change":
      return "—";
    case "user_create":
      return `${m.name} | ${m.color}`;
    case "color_change":
      return `${m.oldColor} → ${m.newColor}`;
    case "strava_sync":
      return `${m.triggeredBy} | imported ${m.imported ?? 0}, skipped ${m.skipped ?? 0}`;
    default:
      return JSON.stringify(m);
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function SketchInfoTooltip() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function handleEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  return (
    <span
      ref={ref}
      className="self-center cursor-help text-muted-foreground hover:text-foreground transition-colors"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v.01a.75.75 0 001.5 0v-.01zM7.25 8a.75.75 0 011.5 0v3.25a.75.75 0 01-1.5 0V8z" />
      </svg>
      {open && pos && createPortal(
        <div
          className="fixed z-[9999] bg-card border border-border shadow-xl rounded p-2 text-left whitespace-nowrap min-w-[200px]"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="text-[10px] font-semibold text-foreground mb-1">What gets flagged SKETCH?</div>
          <div className="text-[10px] text-muted-foreground">Activity logged &gt;3 weeks after its date</div>
          <div className="text-[10px] text-muted-foreground">PIN change (always sus)</div>
          <div className="text-[10px] text-muted-foreground">user=brian</div>
        </div>,
        document.body
      )}
    </span>
  );
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [sketchOnly, setSketchOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [authed, setAuthed] = useState(false);

  const PAGE_SIZE = 100;

  const filtered = sketchOnly ? entries.filter((e) => e.isSketch) : entries;

  const loadEntries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterUser) params.set("userId", filterUser);
    if (filterAction) params.set("action", filterAction);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");

    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterUser, filterAction]);

  function loadMore() {
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (filterUser) params.set("userId", filterUser);
    if (filterAction) params.set("action", filterAction);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(entries.length));

    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => { if (d.user) setAuthed(true); })
      .catch(() => {});
    fetch("/api/amendments")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  if (!authed) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-lg font-bold mb-3">Audit Log</h1>
        <div className="border border-border p-3 text-xs text-muted-foreground">
          Please <a href="/login" className="text-primary hover:underline">log in</a> to view the audit log.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold">Audit Log</h1>
        <div className="flex gap-2 flex-wrap">
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
            SKETCHY STUFF FILTER
          </label>
          <span className="text-xs text-muted-foreground self-center font-mono">
            {filtered.length} events
          </span>
          <SketchInfoTooltip />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-xs font-mono">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-xs font-mono">No events found.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-xs font-mono">No sketchy events found.</p>
      ) : (
        <div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-x-auto">
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
      {!loading && entries.length > 0 && (
        <div className="mt-3 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore || !hasMore}
            className="px-4 py-1.5 text-xs font-medium font-mono border border-stone-300 dark:border-stone-700 bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-default"
          >
            {loadingMore ? "Loading..." : hasMore ? "Load more" : "All events loaded"}
          </button>
        </div>
      )}
    </div>
  );
}
