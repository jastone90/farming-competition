"use client";

import { useEffect, useState, useMemo } from "react";
import { use } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ReferenceArea,
  Label,
} from "recharts";

import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/constants";
import { MONTH_NAMES, formatMonth, formatDate } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = ACTIVITY_TYPE_COLORS;
const TYPE_LABELS: Record<string, string> = ACTIVITY_TYPE_LABELS;

const SEASON_COLORS: Record<number, string> = {
  2022: "#6366F1",
  2023: "#EC4899",
  2024: "#14B8A6",
  2025: "#F97316",
  2026: "#8B5CF6",
  2027: "#06B6D4",
};

interface ProfileData {
  user: { id: number; name: string; color: string };
  allTime: {
    totalPoints: number;
    totalActivities: number;
    totalMiles: number;
    totalElevation: number;
    totalMinutes: number;
    totalPoundsLifted: number;
  };
  personalRecords: {
    bestActivity: { title: string; type: string; points: number; date: string; season: number } | null;
    bestSeason: { season: number; points: number } | null;
    bestMonth: { month: string; points: number } | null;
    longestDrought: { days: number; from: string; to: string; season: number } | null;
    currentWeekStreak: number;
    longestWeekStreak: { weeks: number; from: string; to: string } | null;
    currentDayStreak: number;
    longestDayStreak: { days: number; from: string; to: string } | null;
  };
  activityBreakdown: { type: string; count: number; points: number }[];
  favoriteActivity: string | null;
  monthlyTrends: { month: string; points: number; count: number }[];
  seasonSummaries: {
    season: number;
    points: number;
    activityCount: number;
    miles: number;
    elevation: number;
    rank: number;
    isChampion: boolean;
  }[];
  cumulativeChart: {
    data: { date: string; [season: string]: string | number | null }[];
    seasons: number[];
    decStartIndex: number;
  };
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState<ProfileData | null>(null);
  const [season, setSeason] = useState(currentYear);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seasonOptions = Array.from(
    { length: currentYear - 2022 + 1 },
    (_, i) => 2022 + i
  ).reverse();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/profile/${userId}?season=${season}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [userId, season]);

  // Fill monthly trends for all 12 months (must be above early returns)
  const monthlyTrends = data?.monthlyTrends ?? [];
  const filledTrends = useMemo(() => {
    const map = new Map(monthlyTrends.map((t) => [t.month, t]));
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${season}-${String(i + 1).padStart(2, "0")}`;
      const existing = map.get(m);
      return {
        month: MONTH_NAMES[i],
        points: existing?.points ?? 0,
        count: existing?.count ?? 0,
      };
    });
  }, [monthlyTrends, season]);

  if (error) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Loading...
      </div>
    );
  }

  const { user, allTime, personalRecords, activityBreakdown, favoriteActivity, seasonSummaries, cumulativeChart } = data;
  const totalBreakdownPoints = activityBreakdown.reduce((s, b) => s + b.points, 0);

  return (
    <div className="px-4 py-4 max-w-full">
      {/* Breadcrumb */}
      <div className="mb-3">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Dashboard
        </Link>
        <span className="text-xs text-muted-foreground mx-1">/</span>
        <span className="text-xs font-medium">{user.name}</span>
      </div>

      {/* User Header */}
      <div
        className="border border-border mb-4 p-3 rounded-sm"
        style={{ backgroundColor: `${user.color}08` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: user.color }}
          >
            {user.name[0]}
          </div>
          <h1 className="text-lg font-bold">{user.name}</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Total Points" value={allTime.totalPoints.toFixed(1)} />
          <StatBox label="Activities" value={String(allTime.totalActivities)} />
          <StatBox label="Miles" value={allTime.totalMiles.toFixed(0)} />
          <StatBox label="Elevation" value={`${allTime.totalElevation.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft`} />
        </div>
      </div>

      {/* Cumulative Points Chart */}
      {cumulativeChart && cumulativeChart.data.length > 0 && (
        <div className="border border-border mb-4">
          <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
            Cumulative Points by Season
          </div>
          <div className="p-3">
            {mounted ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <LineChart
                    data={cumulativeChart.data}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      opacity={0.5}
                    />
                    {cumulativeChart.decStartIndex >= 0 && (
                      <ReferenceArea
                        x1={cumulativeChart.data[cumulativeChart.decStartIndex]?.date}
                        x2={cumulativeChart.data[cumulativeChart.data.length - 1]?.date}
                        fill="var(--muted-foreground)"
                        fillOpacity={0.1}
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.2}
                        strokeDasharray="4 2"
                      >
                        <Label
                          value="Rest Month"
                          position="insideTop"
                          style={{
                            fontSize: 11,
                            fill: "var(--muted-foreground)",
                            fontWeight: 600,
                            fontStyle: "italic",
                          }}
                          offset={10}
                        />
                      </ReferenceArea>
                    )}
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(val: string, index: number) => {
                        if (index === 0) return val.split(" ")[0];
                        const prev = cumulativeChart.data[index - 1]?.date as string;
                        if (prev && val.split(" ")[0] !== prev.split(" ")[0]) {
                          return val.split(" ")[0];
                        }
                        return "";
                      }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(val: any) => String(val)}
                    />
                    <Legend />
                    {cumulativeChart.seasons.map((s) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={String(s)}
                        stroke={SEASON_COLORS[s] || user.color}
                        strokeWidth={s === currentYear ? 3 : 1.5}
                        strokeOpacity={s === currentYear ? 1 : 0.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full" />
            )}
          </div>
        </div>
      )}

      {/* Personal Records */}
      <div className="border border-border mb-4">
        <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
          Personal Records
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {personalRecords.bestActivity && (
            <RecordCard
              color={user.color}
              icon="🏆"
              label="Best Activity"
              value={`${personalRecords.bestActivity.points.toFixed(1)} pts`}
              detail={personalRecords.bestActivity.title}
              sub={formatDate(personalRecords.bestActivity.date)}
            />
          )}
          {personalRecords.bestSeason && (
            <RecordCard
              color={user.color}
              icon="🥇"
              label="Best Season"
              value={`${personalRecords.bestSeason.points.toFixed(1)} pts`}
              sub={String(personalRecords.bestSeason.season)}
            />
          )}
          {personalRecords.bestMonth && (
            <RecordCard
              color={user.color}
              icon="🗓️"
              label="Best Month"
              value={`${personalRecords.bestMonth.points.toFixed(1)} pts`}
              sub={formatMonth(personalRecords.bestMonth.month)}
            />
          )}
          {personalRecords.longestDrought && (
            <RecordCard
              color={user.color}
              icon="🏜️"
              label="Longest Drought"
              value={`${personalRecords.longestDrought.days} days`}
              sub={`${formatDate(personalRecords.longestDrought.from)} – ${formatDate(personalRecords.longestDrought.to)}`}
            />
          )}
          <RecordCard
            color={user.color}
            icon="🔥"
            label="Current Streak"
            value={`${personalRecords.currentDayStreak}d / ${personalRecords.currentWeekStreak}w`}
            sub="days / weeks"
          />
          {(personalRecords.longestDayStreak || personalRecords.longestWeekStreak) && (
            <RecordCard
              color={user.color}
              icon="⚡"
              label="Longest Streak"
              value={`${personalRecords.longestDayStreak?.days ?? 0}d / ${personalRecords.longestWeekStreak?.weeks ?? 0}w`}
              sub="days / weeks"
            />
          )}
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="border border-border mb-4">
        <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
          Activity Breakdown
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Pie Chart */}
          <div className="flex items-center justify-center p-4">
            {mounted && activityBreakdown.length > 0 ? (
              <PieChart width={200} height={200}>
                <Pie
                  data={activityBreakdown}
                  dataKey="points"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  strokeWidth={1}
                >
                  {activityBreakdown.map((entry) => (
                    <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || "#888"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(1)} pts`}
                  labelFormatter={(label: any) => TYPE_LABELS[String(label)] || String(label)}
                />
              </PieChart>
            ) : (
              <div className="text-xs text-muted-foreground">No activities</div>
            )}
          </div>

          {/* Breakdown table */}
          <div className="p-3">
            {favoriteActivity && (
              <div className="mb-3 text-xs">
                <span className="text-muted-foreground">Favorite: </span>
                <span className="font-semibold" style={{ color: TYPE_COLORS[favoriteActivity] }}>
                  {TYPE_LABELS[favoriteActivity] || favoriteActivity}
                </span>
              </div>
            )}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70">
                  <th className="border border-border px-2 py-1 text-left font-semibold">Type</th>
                  <th className="border border-border px-2 py-1 text-right font-semibold">Count</th>
                  <th className="border border-border px-2 py-1 text-right font-semibold">Points</th>
                  <th className="border border-border px-2 py-1 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {activityBreakdown.map((b, i) => (
                  <tr key={b.type} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    <td className="border border-border px-2 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: TYPE_COLORS[b.type] || "#888" }}
                        />
                        {TYPE_LABELS[b.type] || b.type}
                      </span>
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums">{b.count}</td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                      {b.points.toFixed(1)}
                    </td>
                    <td className="border border-border px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {totalBreakdownPoints > 0 ? `${((b.points / totalBreakdownPoints) * 100).toFixed(0)}%` : "0%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="border border-border mb-4">
        <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border flex items-center justify-between">
          <span>Monthly Trends</span>
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
              className="px-2 py-0.5 text-xs font-bold border border-border bg-background tabular-nums"
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
        </div>
        <div className="p-3">
          {mounted ? (
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <BarChart data={filledTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === "points") return [`${Number(value).toFixed(1)} pts`, "Points"];
                    return [value, name];
                  }}
                  labelFormatter={(label: any) => String(label)}
                />
                <Bar dataKey="points" fill={user.color} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>

      {/* Season-by-Season Summary */}
      <div className="border border-border mb-4">
        <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
          Season History
        </div>
        {seasonSummaries.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">No season data</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/70">
                <th className="border border-border px-2 py-1.5 text-left font-semibold">Season</th>
                <th className="border border-border px-2 py-1.5 text-right font-semibold">Points</th>
                <th className="border border-border px-2 py-1.5 text-right font-semibold">Rank</th>
                <th className="border border-border px-2 py-1.5 text-right font-semibold">Acts</th>
                <th className="border border-border px-2 py-1.5 text-right font-semibold">Miles</th>
                <th className="border border-border px-2 py-1.5 text-right font-semibold">Elev</th>
                <th className="border border-border px-2 py-1.5 text-center font-semibold w-8">🏆</th>
              </tr>
            </thead>
            <tbody>
              {seasonSummaries.map((s, i) => (
                <tr
                  key={s.season}
                  className={
                    s.isChampion
                      ? "bg-amber-50/50 dark:bg-amber-950/10 font-semibold"
                      : i % 2 === 0
                        ? "bg-background"
                        : "bg-muted/30"
                  }
                >
                  <td className="border border-border px-2 py-1.5 tabular-nums font-semibold">{s.season}</td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                    {s.points.toFixed(1)}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                    <RankBadge rank={s.rank} />
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">{s.activityCount}</td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">{s.miles.toFixed(0)}</td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                    {s.elevation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-center">{s.isChampion ? "🏆" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-2 bg-background">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">{value}</div>
    </div>
  );
}

function RecordCard({
  color,
  icon,
  label,
  value,
  detail,
  sub,
}: {
  color: string;
  icon: string;
  label: string;
  value: string;
  detail?: string;
  sub?: string;
}) {
  return (
    <div
      className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ borderLeftColor: color, backgroundColor: `${color}08` }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${color}30`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div className="text-[10px] text-muted-foreground leading-tight mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">{value}</div>
      {detail && <div className="text-[10px] text-foreground font-medium truncate mt-0.5">{detail}</div>}
      {sub && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</div>}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-600 dark:text-amber-400 font-bold">1st</span>;
  if (rank === 2) return <span className="text-muted-foreground">2nd</span>;
  if (rank === 3) return <span className="text-muted-foreground">3rd</span>;
  return <span className="text-muted-foreground">{rank}th</span>;
}
