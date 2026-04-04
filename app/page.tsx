"use client";

import { useEffect, useState } from "react";
import { formatMonth, formatDate } from "@/lib/utils";

interface TypeBreakdown {
  type: string;
  count: number;
  totalPoints: number;
  totalMiles: number | null;
  totalElevation: number | null;
  totalDuration: number | null;
  totalPoundsLifted: number | null;
}

interface Champion {
  year: number;
  champion: { name: string; color: string; points: number } | null;
}

interface Shamer {
  year: number;
  shamer: { name: string; color: string; points: number } | null;
}

interface RecordEntry {
  holder: string;
  color: string;
  value: number;
  season: number;
  title?: string;
  date?: string;
}

interface GroupRecord {
  season: number;
  total: number;
}

interface Records {
  highestScoring: RecordEntry | null;
  longestRide: RecordEntry | null;
  longestRun: RecordEntry | null;
  mountainGoat: RecordEntry | null;
  heaviestHaybailz: RecordEntry | null;
  mostPointsSeason: RecordEntry | null;
  mostActivitiesSeason: RecordEntry | null;
  mostMilesSeason: RecordEntry | null;
  mostElevationSeason: RecordEntry | null;
  biggestDecember: RecordEntry | null;
  leastPointsSeason: RecordEntry | null;
  highestMonth: { month: string; total: number } | null;
  highestIndividualMonth: { holder: string; color: string; value: number; season: number; month: string } | null;
  mostCombinedPointsSeason: GroupRecord | null;
  mostCombinedMilesSeason: GroupRecord | null;
  mostCombinedElevationSeason: GroupRecord | null;
  mostCombinedActivitiesSeason: GroupRecord | null;
  highestDay: { date: string; total: number } | null;
  lowestMonth: { month: string; total: number } | null;
  longestDrought: { holder: string; color: string; season: number; days: number; from: string; to: string } | null;
  activeDrought: { holder: string; color: string; days: number; since: string } | null;
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [shameList, setShameList] = useState<Shamer[]>([]);
  const [records, setRecords] = useState<Records | null>(null);
  const [breakdown, setBreakdown] = useState<TypeBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data once on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/leaderboard/history").then((r) => r.json()),
      fetch("/api/leaderboard/records").then((r) => r.json()),
      fetch("/api/activities/breakdown").then((r) => r.json()),
    ])
      .then(([historyData, recordsData, breakdownData]) => {
        setChampions(historyData.champions || []);
        setShameList(historyData.shameList || []);
        setRecords(recordsData);
        setBreakdown(breakdownData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Loading...
      </div>
    );
  }


  // Hall of Fame: only completed seasons with a champion
  const hallOfFame = champions.filter(
    (c) => c.year < currentYear && c.champion !== null
  );

  const hallOfShame = shameList.filter(
    (s) => s.year < currentYear && s.shamer !== null
  );

  return (
    <div className="px-4 py-4 max-w-full">
      <h1 className="text-lg font-bold mb-3">The Almanac</h1>

      {/* Activity Type Breakdown */}
      {breakdown.length > 0 && (() => {
        const totalPoints = breakdown.reduce((s, b) => s + b.totalPoints, 0);
        const totalCount = breakdown.reduce((s, b) => s + b.count, 0);
        const typeConfig: Record<string, { icon: string; label: string; metric: (b: TypeBreakdown) => string }> = {
          ride: { icon: "\uD83D\uDEB4", label: "Riding", metric: (b) => `${(b.totalMiles ?? 0).toFixed(0)} mi` },
          run: { icon: "\uD83C\uDFC3", label: "Running", metric: (b) => `${(b.totalMiles ?? 0).toFixed(0)} mi` },
          weight_training: { icon: "\uD83C\uDFCB\uFE0F", label: "Haybailz", metric: (b) => `${((b.totalPoundsLifted ?? 0) / 1000).toFixed(0)}k lbs` },
          swimming: { icon: "\uD83C\uDFCA", label: "Swimming", metric: (b) => `${(b.totalMiles ?? 0).toFixed(1)} mi` },
        };
        return (
          <div className="border border-border mb-4">
            <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border flex items-center justify-between">
              <span>Farming Breakdown — All Time</span>
              <span className="font-normal text-muted-foreground">{totalCount.toLocaleString()} activities · {totalPoints.toFixed(0)} pts</span>
            </div>
            <div className="divide-y divide-border">
              {breakdown.map((b) => {
                const cfg = typeConfig[b.type] || { icon: "\u2753", label: b.type, metric: () => "" };
                const pctOfPoints = totalPoints > 0 ? (b.totalPoints / totalPoints) * 100 : 0;
                const pctOfCount = totalCount > 0 ? (b.count / totalCount) * 100 : 0;
                return (
                  <div key={b.type} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="text-base w-6 text-center shrink-0">{cfg.icon}</div>
                    <div className="w-20 shrink-0">
                      <div className="text-xs font-semibold">{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">{cfg.metric(b)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1 items-center mb-1">
                        <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-amber-500/80 dark:bg-amber-400/70 rounded-sm transition-all duration-500"
                            style={{ width: `${pctOfPoints}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-400 w-14 text-right shrink-0">
                          {b.totalPoints.toFixed(0)} pts
                        </span>
                      </div>
                      <div className="flex gap-1 items-center">
                        <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground/30 rounded-sm transition-all duration-500"
                            style={{ width: `${pctOfCount}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground w-14 text-right shrink-0">
                          {b.count} acts
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums w-10 text-right shrink-0">
                      {Math.round(pctOfPoints)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Hall of Fame + Hall of Shame */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Hall of Fame */}
        <div className="border border-border">
          <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
            Hall of Fame
          </div>
          {hallOfFame.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No champions yet
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <tbody>
                {hallOfFame.map((c, i) => (
                  <tr
                    key={c.year}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}
                  >
                    <td className="border-b border-border px-2 py-1.5 tabular-nums font-semibold">
                      {c.year}
                    </td>
                    <td className="border-b border-border px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.champion!.color }}
                        />
                        {c.champion!.name}
                      </span>
                    </td>
                    <td className="border-b border-border px-2 py-1.5 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {c.champion!.points.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Hall of Shame */}
        <div className="border border-border">
          <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
            Hall of Shame
            <span className="font-normal text-muted-foreground ml-1">(Most December pts)</span>
          </div>
          {hallOfShame.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No data yet
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <tbody>
                {hallOfShame.map((s, i) => (
                  <tr
                    key={s.year}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}
                  >
                    <td className="border-b border-border px-2 py-1.5 tabular-nums font-semibold">
                      {s.year}
                    </td>
                    <td className="border-b border-border px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.shamer!.color }}
                        />
                        {s.shamer!.name}
                      </span>
                    </td>
                    <td className="border-b border-border px-2 py-1.5 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                      {s.shamer!.points.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* All-Time Records */}
      {records && (
        <div className="border border-border mb-4">
          <div className="px-2 py-1.5 bg-muted/70 text-xs font-semibold border-b border-border">
            All-Time Records
          </div>

          {/* Single Activity */}
          <div className="px-2 pt-2 pb-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Single Activity
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <RecordCard
              icon="🏆"
              label="Highest Scoring Activity"
              record={records.highestScoring}
              format={(v) => `${Number(v).toFixed(1)} pts`}
              showTitle
            />
            <RecordCard
              icon="🚴"
              label="Longest Ride"
              record={records.longestRide}
              format={(v) => `${Number(v).toFixed(1)} mi`}
              showTitle
            />
            <RecordCard
              icon="🏃"
              label="Longest Run"
              record={records.longestRun}
              format={(v) => `${Number(v).toFixed(1)} mi`}
              showTitle
            />
            <RecordCard
              icon="⛰️"
              label="Mountain Goat"
              record={records.mountainGoat}
              format={(v) => `${Number(v).toLocaleString()} ft`}
              showTitle
            />
            <RecordCard
              icon="🏋️"
              label="Heaviest Haybailz"
              record={records.heaviestHaybailz}
              format={(v) => `${Number(v).toLocaleString()} lbs`}
              showTitle
            />
          </div>

          {/* Season */}
          <div className="px-2 pt-2 pb-0.5 border-t border-border">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Season
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <RecordCard
              icon="🥇"
              label="Most Points (Season)"
              record={records.mostPointsSeason}
              format={(v) => `${Number(v).toFixed(1)} pts`}
            />
            <RecordCard
              icon="📊"
              label="Most Activities (Season)"
              record={records.mostActivitiesSeason}
              format={(v) => `${Number(v)} acts`}
            />
            <RecordCard
              icon="🛣️"
              label="Most Miles (Season)"
              record={records.mostMilesSeason}
              format={(v) => `${Number(v).toFixed(0)} mi`}
            />
            <RecordCard
              icon="🧗"
              label="Most Elevation (Season)"
              record={records.mostElevationSeason}
              format={(v) => `${Number(v).toLocaleString()} ft`}
            />
            {records.highestIndividualMonth && (
              <div
                className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{
                  borderLeftColor: records.highestIndividualMonth.color,
                  backgroundColor: `${records.highestIndividualMonth.color}08`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${records.highestIndividualMonth.color}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="text-[10px] text-muted-foreground leading-tight mb-1">
                  🗓️ Best Month (Individual)
                </div>
                <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {Number(records.highestIndividualMonth.value).toFixed(1)} pts
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: records.highestIndividualMonth.color }}
                  />
                  <span className="text-[10px] text-foreground font-medium truncate">
                    {records.highestIndividualMonth.holder}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {formatMonth(records.highestIndividualMonth.month)}
                  </span>
                </div>
              </div>
            )}
            <RecordCard
              icon="😈"
              label="December Offender"
              record={records.biggestDecember}
              format={(v) => `${Number(v).toFixed(1)} pts`}
            />
            <RecordCard
              icon="🐌"
              label="Least Points (Season)"
              record={records.leastPointsSeason}
              format={(v) => `${Number(v).toFixed(1)} pts`}
            />
            {records.longestDrought && (
              <div
                className="border border-border p-2 border-l-2 flex items-start gap-3 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{
                  borderLeftColor: records.longestDrought.color,
                  backgroundColor: `${records.longestDrought.color}08`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${records.longestDrought.color}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground leading-tight mb-1">
                    🏜️ Longest Drought
                  </div>
                  <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    {records.longestDrought.days} days
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: records.longestDrought.color }}
                    />
                    <span className="text-[10px] text-foreground font-medium truncate">
                      {records.longestDrought.holder}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {formatDate(records.longestDrought.from)} – {formatDate(records.longestDrought.to)}
                  </div>
                </div>
                {records.activeDrought && records.activeDrought.days > 0 && (
                  <div className="border-l border-border/50 pl-3 shrink-0 text-right">
                    <div className="text-[10px] text-muted-foreground leading-tight mb-1">Active</div>
                    <div className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                      {records.activeDrought.days}d
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: records.activeDrought.color }}
                      />
                      <span className="text-[10px] text-foreground font-medium">
                        {records.activeDrought.holder}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group */}
          <div className="px-2 pt-2 pb-0.5 border-t border-border">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Group
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <GroupRecordCard
              icon="🥇"
              label="Most Combined Points (Season)"
              record={records.mostCombinedPointsSeason}
              format={(v) => `${Number(v).toFixed(1)} pts`}
            />
            <GroupRecordCard
              icon="🛣️"
              label="Most Combined Miles (Season)"
              record={records.mostCombinedMilesSeason}
              format={(v) => `${Number(v).toFixed(0)} mi`}
            />
            <GroupRecordCard
              icon="🧗"
              label="Most Combined Elevation (Season)"
              record={records.mostCombinedElevationSeason}
              format={(v) => `${Number(v).toLocaleString()} ft`}
            />
            <GroupRecordCard
              icon="📊"
              label="Most Combined Activities (Season)"
              record={records.mostCombinedActivitiesSeason}
              format={(v) => `${Number(v)} acts`}
            />
            {records.highestMonth && (
              <div
                className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{ borderLeftColor: "#D4A017", backgroundColor: "#D4A01715" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px #D4A01730"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="text-[10px] text-muted-foreground leading-tight mb-1">
                  🔥 Highest Output Month
                </div>
                <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {Number(records.highestMonth.total).toFixed(1)} pts
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatMonth(records.highestMonth.month)} · All competitors
                </div>
              </div>
            )}
            {records.highestDay && (
              <div
                className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{ borderLeftColor: "#D4A017", backgroundColor: "#D4A01715" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px #D4A01730"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="text-[10px] text-muted-foreground leading-tight mb-1">
                  📅 Highest Output Day
                </div>
                <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {Number(records.highestDay.total).toFixed(1)} pts
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDate(records.highestDay.date)} · All competitors
                </div>
              </div>
            )}
            {records.lowestMonth && (
              <div
                className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{ borderLeftColor: "#D4A017", backgroundColor: "#D4A01715" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px #D4A01730"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="text-[10px] text-muted-foreground leading-tight mb-1">
                  😴 Lowest Output Month
                </div>
                <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {Number(records.lowestMonth.total).toFixed(1)} pts
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatMonth(records.lowestMonth.month)} · All competitors
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function RecordCard({
  icon,
  label,
  record,
  format,
  showTitle,
}: {
  icon: string;
  label: string;
  record: RecordEntry | null;
  format: (v: number) => string;
  showTitle?: boolean;
}) {
  if (!record) return null;
  return (
    <div
      className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        borderLeftColor: record.color,
        backgroundColor: `${record.color}15`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${record.color}30`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div className="text-[10px] text-muted-foreground leading-tight mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
        {format(record.value)}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: record.color }}
        />
        <span className="text-[10px] text-foreground font-medium truncate">
          {record.holder}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {record.season}
        </span>
      </div>
      {showTitle && record.title && (
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {record.title}
        </div>
      )}
    </div>
  );
}

function GroupRecordCard({
  icon,
  label,
  record,
  format,
}: {
  icon: string;
  label: string;
  record: GroupRecord | null;
  format: (v: number) => string;
}) {
  if (!record) return null;
  const accentColor = "#D4A017";
  return (
    <div
      className="border border-border p-2 border-l-2 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        borderLeftColor: accentColor,
        backgroundColor: `${accentColor}08`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}30`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div className="text-[10px] text-muted-foreground leading-tight mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
        {format(record.total)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {record.season} · All competitors
      </div>
    </div>
  );
}
