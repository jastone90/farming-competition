"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ManualEntryForm } from "@/components/manual-entry-form";
import { CumulativeChart } from "@/components/cumulative-chart";

interface ActivityData {
  id: number;
  userId: number;
  source: "strava" | "manual";
  title: string;
  type: string;
  isIndoor: boolean;
  withChild: boolean;
  distanceMiles: number | null;
  durationMinutes: number | null;
  elevationGainFeet: number | null;
  caloriesBurned: number | null;
  poundsLifted: number | null;
  rawPoints: number;
  modifiedPoints: number;
  pointBreakdown: Record<string, { label: string; points: number }>;
  engineVersion: string | null;
  activityDate: string;
  userName: string;
  userColor: string;
}

interface UserInfo {
  id: number;
  name: string;
  color: string;
}

type Filter = "all" | "strava" | "manual" | "indoor";
type ViewMode = "grid" | "sheet";
type SortField =
  | "activityDate"
  | "userName"
  | "type"
  | "title"
  | "distanceMiles"
  | "durationMinutes"
  | "elevationGainFeet"
  | "caloriesBurned"
  | "poundsLifted"
  | "modifiedPoints"
  | "source";
type SortDir = "asc" | "desc";

function pointsIntensity(points: number, maxPoints: number): string {
  if (maxPoints <= 0) return "transparent";
  const t = Math.min(points / maxPoints, 1);
  const alpha = Math.round(t * t * 0.22 * 255);
  return `rgba(217, 158, 39, ${alpha / 255})`;
}

function computeTotals(items: ActivityData[]) {
  let dist = 0, dur = 0, elev = 0, cal = 0, pts = 0;
  for (const a of items) {
    dist += a.distanceMiles ?? 0;
    dur += a.durationMinutes ?? 0;
    elev += a.elevationGainFeet ?? 0;
    cal += a.caloriesBurned ?? 0;
    pts += a.modifiedPoints;
  }
  return { dist, dur, elev, cal, pts };
}

const typeLabels: Record<string, string> = {
  ride: "Ride",
  run: "Run",
  weight_training: "Haybailz",
  swimming: "Swim",
  other: "Other",
};

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function numCell(v: number | null, decimals = 1) {
  if (v == null || v === 0) return "";
  return v.toFixed(decimals);
}

function PointsCell({
  points,
  breakdown,
  engineVersion,
  className,
}: {
  points: number;
  breakdown: Record<string, { label: string; points: number }>;
  engineVersion: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipLeft: boolean } | null>(null);
  const ref = useRef<HTMLTableCellElement>(null);

  const items = Object.values(breakdown);

  function handleEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const tooltipWidth = 220;
      const flipLeft = rect.right + tooltipWidth + 16 > window.innerWidth;
      setPos({ top: rect.top, left: flipLeft ? rect.left : rect.right, flipLeft });
    }
    setOpen(true);
  }

  return (
    <td
      ref={ref}
      className={`border border-border px-1 py-0.5 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400 cursor-default ${className || ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      {points.toFixed(1)}
      {open && items.length > 0 && pos && createPortal(
        <div
          className="fixed z-[9999] bg-card border border-border shadow-xl rounded p-2 text-left whitespace-nowrap min-w-[200px]"
          style={{
            top: pos.top,
            left: pos.flipLeft ? undefined : pos.left + 8,
            right: pos.flipLeft ? window.innerWidth - pos.left + 8 : undefined,
            transform: "translateY(-50%)",
          }}
        >
          <div className="text-[10px] font-semibold text-foreground mb-1">Point Breakdown</div>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between gap-4 text-[10px]">
              <span className="text-muted-foreground font-normal">{item.label}</span>
              <span className={`font-semibold ${item.points >= 0 ? "text-amber-700 dark:text-amber-400" : "text-red-500"}`}>
                {item.points >= 0 ? "+" : ""}{item.points.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-4 text-[10px] border-t border-border mt-1 pt-1">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">{points.toFixed(2)}</span>
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">
            {engineVersion ? <>ScoringEngine <span className="font-bold text-foreground">v{engineVersion}</span></> : "Historical import"}
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function sortActivities(items: ActivityData[], field: SortField, dir: SortDir) {
  return [...items].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

// Compact table for one user in grid view
function UserMiniTable({
  user,
  activities,
  currentUserId,
  canDelete,
  onDelete,
}: {
  user: UserInfo;
  activities: ActivityData[];
  currentUserId: number | null;
  canDelete: boolean;
  onDelete: (id: number) => void;
}) {
  const sorted = useMemo(
    () => sortActivities(activities, "activityDate", "desc"),
    [activities]
  );
  const totals = useMemo(() => computeTotals(sorted), [sorted]);
  const maxPoints = useMemo(() => Math.max(...sorted.map((a) => a.modifiedPoints), 0), [sorted]);

  return (
    <div className="flex flex-col min-w-0">
      {/* User header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold text-white"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
        <span className="font-normal opacity-80 ml-auto">{sorted.length}</span>
      </div>
      {/* Scrollable table body */}
      <div className="overflow-y-auto max-h-[70vh] border-x border-border">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/90">
              <th className="border border-border px-1 py-1 text-left font-semibold">Date</th>
              <th className="border border-border px-1 py-1 text-left font-semibold">Type</th>
              <th className="border border-border px-1 py-1 text-right font-semibold">Mi</th>
              <th className="border border-border px-1 py-1 text-right font-semibold">Elev</th>
              <th className="border border-border px-1 py-1 text-right font-semibold">Pts</th>
              {canDelete && (
                <th className="border border-border px-1 py-1 w-4"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => (
              <tr
                key={a.id}
                className="hover:bg-amber-50 dark:hover:bg-amber-950/20"
                style={{ backgroundColor: pointsIntensity(a.modifiedPoints, maxPoints) }}
              >
                <td className="border border-border px-1 py-0.5 whitespace-nowrap tabular-nums">
                  {formatDate(a.activityDate)}
                </td>
                <td className="border border-border px-1 py-0.5 whitespace-nowrap">
                  {typeLabels[a.type] || a.type}
                  {a.isIndoor && <span className="text-muted-foreground">(i)</span>}
                </td>
                <td className="border border-border px-1 py-0.5 text-right tabular-nums">
                  {numCell(a.distanceMiles)}
                </td>
                <td className="border border-border px-1 py-0.5 text-right tabular-nums">
                  {numCell(a.elevationGainFeet, 0)}
                </td>
                <PointsCell points={a.modifiedPoints} breakdown={a.pointBreakdown} engineVersion={a.engineVersion} />
                {canDelete && (
                  <td className="border border-border px-1 py-0.5 text-center">
                      <button
                        onClick={() => onDelete(a.id)}
                        className="text-destructive hover:underline leading-none"
                      >
                        x
                      </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="font-semibold bg-muted/90">
              <td className="border border-border px-1 py-1" colSpan={2}>
                TOT
              </td>
              <td className="border border-border px-1 py-1 text-right tabular-nums">
                {totals.dist.toFixed(1)}
              </td>
              <td className="border border-border px-1 py-1 text-right tabular-nums">
                {Math.round(totals.elev)}
              </td>
              <td className="border border-border px-1 py-1 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                {totals.pts.toFixed(1)}
              </td>
              {canDelete && <td className="border border-border px-1 py-1 w-4"></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("activityDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [cumulative, setCumulative] = useState<{
    data: { date: string; [k: string]: string | number | null }[];
    users: { name: string; color: string }[];
    decStartIndex: number;
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const seasonOptions = Array.from({ length: currentYear - 2022 + 1 }, (_, i) => 2022 + i).reverse();

  const users = useMemo(() => {
    const map = new Map<number, UserInfo>();
    for (const a of activities) {
      if (!map.has(a.userId)) {
        map.set(a.userId, { id: a.userId, name: a.userName, color: a.userColor });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  // activeTab defaults to "all" — no auto-select

  // Group activities by user for grid view
  const activitiesByUser = useMemo(() => {
    const map = new Map<number, ActivityData[]>();
    for (const a of activities) {
      if (!map.has(a.userId)) map.set(a.userId, []);
      map.get(a.userId)!.push(a);
    }
    return map;
  }, [activities]);

  const loadActivities = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ season: String(season) });
    if (filter === "strava") params.set("source", "strava");
    if (filter === "manual") params.set("source", "manual");
    if (filter === "indoor") params.set("indoor", "true");

    fetch(`/api/activities?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setActivities(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, season]);

  useEffect(() => {
    loadActivities();
    fetch(`/api/leaderboard/cumulative?season=${season}`)
      .then((r) => r.json())
      .then(setCumulative)
      .catch(() => {});
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setCurrentUserId(d.user.id);
      })
      .catch(() => {});
  }, [loadActivities]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this activity?")) return;
    const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
    if (res.ok) loadActivities();
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "activityDate" ? "desc" : "asc");
    }
  }

  // Sheet view: filter by active tab, then sort
  const filtered = useMemo(() => {
    const base = activeTab === "all" ? activities : activities.filter((a) => a.userId === activeTab);
    return sortActivities(base, sortField, sortDir);
  }, [activities, activeTab, sortField, sortDir]);

  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const maxPoints = useMemo(() => Math.max(...filtered.map((a) => a.modifiedPoints), 0), [filtered]);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "strava", label: "Strava" },
    { value: "manual", label: "Manual" },
    { value: "indoor", label: "Indoor" },
  ];

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return " \u2195";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const showUserCol = activeTab === "all";

  const sheetColumns: { field: SortField; label: string; align?: "right"; hideOnUser?: boolean }[] = [
    { field: "activityDate", label: "Date" },
    { field: "userName", label: "User", hideOnUser: true },
    { field: "type", label: "Type" },
    { field: "title", label: "Title" },
    { field: "source", label: "Src" },
    { field: "distanceMiles", label: "Miles", align: "right" },
    { field: "durationMinutes", label: "Min", align: "right" },
    { field: "elevationGainFeet", label: "Elev (ft)", align: "right" },
    { field: "poundsLifted", label: "Lbs", align: "right" },
    { field: "modifiedPoints", label: "Points", align: "right" },
  ];

  // Kidz column is non-sortable, rendered separately

  const visibleColumns = sheetColumns.filter((c) => !c.hideOnUser || showUserCol);

  return (
    <div className="px-4 py-4 max-w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Activities</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSeason((s) => Math.max(2022, s - 1))}
              disabled={season <= 2022}
              className="px-1.5 py-0.5 text-xs font-bold border border-border bg-background hover:bg-muted disabled:opacity-30"
            >
              &lt;
            </button>
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="px-2 py-0.5 text-sm font-bold border border-border bg-background tabular-nums"
            >
              {seasonOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => setSeason((s) => Math.min(currentYear, s + 1))}
              disabled={season >= currentYear}
              className="px-1.5 py-0.5 text-xs font-bold border border-border bg-background hover:bg-muted disabled:opacity-30"
            >
              &gt;
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            Jan 1 – Dec 25
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex gap-0 border border-border">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-amber-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="4-up grid view"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("sheet")}
              className={`px-2 py-0.5 text-xs font-medium border-l border-border transition-colors ${
                viewMode === "sheet"
                  ? "bg-amber-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Single table view"
            >
              Sheet
            </button>
          </div>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2 py-0.5 text-xs font-medium border transition-colors ${
                  filter === f.value
                    ? "bg-amber-600 text-white border-amber-700"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 border border-primary"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Cumulative Points Chart */}
      {cumulative && cumulative.data.length > 0 && (
        <div className="border border-border mb-4 p-3">
          <div className="text-xs font-semibold mb-2">
            Cumulative Points — {season}
          </div>
          <CumulativeChart
            data={cumulative.data}
            users={cumulative.users}
            decStartIndex={cumulative.decStartIndex}
          />
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Loading...
        </div>
      ) : viewMode === "grid" ? (
        /* ===== GRID VIEW: 4 side-by-side tables ===== */
        <div className="grid grid-cols-4 gap-2">
          {users.map((u) => (
            <UserMiniTable
              key={u.id}
              user={u}
              activities={activitiesByUser.get(u.id) || []}
              currentUserId={currentUserId}
              canDelete={u.id === currentUserId && season === currentYear}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* ===== SHEET VIEW: single table with tabs ===== */
        <>
          <div className="flex items-end gap-0 border-b border-border mb-0">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-medium border border-b-0 transition-colors -mb-px ${
                activeTab === "all"
                  ? "bg-background text-foreground border-border z-10"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              All
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setActiveTab(u.id)}
                className={`px-3 py-1.5 text-xs font-medium border border-b-0 transition-colors -mb-px flex items-center gap-1.5 ${
                  activeTab === u.id
                    ? "bg-background text-foreground border-border z-10"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: u.color }}
                />
                {u.name}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground px-2 py-1.5">
              {filtered.length} rows
            </span>
          </div>

          <div className="overflow-x-auto border-x border-b border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70">
                  {visibleColumns.filter((c) => c.field !== "modifiedPoints").map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className={`border border-border px-2 py-1.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-muted ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.label}
                      <span className="text-muted-foreground">{sortArrow(col.field)}</span>
                    </th>
                  ))}
                  <th className="border border-border px-2 py-1.5 font-semibold text-center whitespace-nowrap">
                    Kidz
                  </th>
                  {visibleColumns.filter((c) => c.field === "modifiedPoints").map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="border border-border px-2 py-1.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-muted text-right"
                    >
                      {col.label}
                      <span className="text-muted-foreground">{sortArrow(col.field)}</span>
                    </th>
                  ))}
                  <th className="border border-border px-2 py-1.5 font-semibold text-left w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    className="hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    style={{ backgroundColor: pointsIntensity(a.modifiedPoints, maxPoints) }}
                  >
                    <td className="border border-border px-2 py-1 whitespace-nowrap">
                      {formatDate(a.activityDate)}
                    </td>
                    {showUserCol && (
                      <td className="border border-border px-2 py-1 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: a.userColor }}
                          />
                          {a.userName}
                        </span>
                      </td>
                    )}
                    <td className="border border-border px-2 py-1 whitespace-nowrap">
                      {typeLabels[a.type] || a.type}
                      {a.isIndoor && (
                        <span className="text-muted-foreground ml-1" title="Indoor">
                          (i)
                        </span>
                      )}
                    </td>
                    <td className="border border-border px-2 py-1 max-w-[200px] truncate" title={a.title}>
                      {a.title}
                    </td>
                    <td className="border border-border px-2 py-1 whitespace-nowrap">
                      <span
                        className={
                          a.source === "strava"
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-muted-foreground"
                        }
                      >
                        {a.source === "strava" ? "S" : "M"}
                      </span>
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums">
                      {numCell(a.distanceMiles)}
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums">
                      {numCell(a.durationMinutes, 0)}
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums">
                      {numCell(a.elevationGainFeet, 0)}
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums">
                      {numCell(a.poundsLifted, 0)}
                    </td>
                    <td className="border border-border px-2 py-1 text-center">
                      {a.withChild ? "\u2713" : "\u2013"}
                    </td>
                    <PointsCell points={a.modifiedPoints} breakdown={a.pointBreakdown} engineVersion={a.engineVersion} className="px-2 py-1" />
                    <td className="border border-border px-2 py-1 text-center">
                      {a.userId === currentUserId && season === currentYear && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-destructive hover:underline"
                          title="Delete"
                        >
                          x
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/70 font-semibold">
                    <td className="border border-border px-2 py-1.5" colSpan={showUserCol ? 5 : 4}>
                      TOTALS ({filtered.length})
                    </td>
                    <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                      {totals.dist.toFixed(1)}
                    </td>
                    <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                      {Math.round(totals.dur)}
                    </td>
                    <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                      {Math.round(totals.elev)}
                    </td>
                    <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                      {Math.round(totals.cal)}
                    </td>
                    <td className="border border-border px-2 py-1.5"></td>
                    <td className="border border-border px-2 py-1.5 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                      {totals.pts.toFixed(1)}
                    </td>
                    <td className="border border-border px-2 py-1.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {showForm && (
        <ManualEntryForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadActivities();
          }}
        />
      )}
    </div>
  );
}
