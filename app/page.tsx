"use client";

import { useEffect, useState, useCallback } from "react";
import { CumulativeChart } from "@/components/cumulative-chart";

interface LeaderboardEntry {
  userId: number;
  name: string;
  color: string;
  totalPoints: number;
  activityCount: number;
  totalMiles: number;
}

interface CumulativeData {
  data: { date: string; [userName: string]: string | number | null }[];
  users: { name: string; color: string }[];
  decStartIndex: number;
}

interface Champion {
  year: number;
  champion: { name: string; color: string; points: number } | null;
}

interface Shamer {
  year: number;
  shamer: { name: string; color: string; points: number } | null;
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [season, setSeason] = useState(currentYear);
  const [data, setData] = useState<{
    season: number;
    leaderboard: LeaderboardEntry[];
  } | null>(null);
  const [amendmentCount, setAmendmentCount] = useState(0);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [shameList, setShameList] = useState<Shamer[]>([]);
  const [cumulative, setCumulative] = useState<CumulativeData | null>(null);

  const seasonOptions = Array.from(
    { length: currentYear - 2022 + 1 },
    (_, i) => 2022 + i
  ).reverse();

  // Season-dependent fetches
  const loadSeason = useCallback(() => {
    setData(null);

    Promise.all([
      fetch(`/api/leaderboard?season=${season}`).then((r) => r.json()),
      fetch(`/api/leaderboard/cumulative?season=${season}`).then((r) => r.json()),
      fetch("/api/amendments").then((r) => r.json()),
    ])
      .then(([leaderboardData, cumulativeData, amendmentsData]) => {
        setData(leaderboardData);
        setCumulative(cumulativeData);
        const voting = amendmentsData.amendments?.filter(
          (a: { status: string }) => a.status === "voting"
        );
        setAmendmentCount(voting?.length || 0);
      })
      .catch(console.error);
  }, [season]);

  useEffect(() => {
    loadSeason();
  }, [loadSeason]);

  // Hall of Fame — fetch once on mount
  useEffect(() => {
    fetch("/api/leaderboard/history")
      .then((r) => r.json())
      .then((d) => {
        setChampions(d.champions || []);
        setShameList(d.shameList || []);
      })
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Loading...
      </div>
    );
  }

  const { leaderboard } = data;
  const maxPoints = Math.max(...leaderboard.map((l) => l.totalPoints), 1);
  const totalActivities = leaderboard.reduce((sum, l) => sum + l.activityCount, 0);
  const totalMiles = leaderboard.reduce((s, l) => s + l.totalMiles, 0);
  const leaderPoints = leaderboard[0]?.totalPoints ?? 0;

  const isPastSeason = season < currentYear;
  const now = new Date();
  const seasonStart = new Date(season, 1, 1);
  const weekNumber = isPastSeason
    ? 48
    : Math.max(
        1,
        Math.ceil(
          (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
      );
  const progressPct = isPastSeason ? 100 : Math.min((weekNumber / 48) * 100, 100);

  // Hall of Fame: only completed seasons with a champion
  const hallOfFame = champions.filter(
    (c) => c.year < currentYear && c.champion !== null
  );

  const hallOfShame = shameList.filter(
    (s) => s.year < currentYear && s.shamer !== null
  );

  return (
    <div className="px-4 py-4 max-w-full">
      {/* Season Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Dashboard</h1>
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
                <option key={y} value={y}>
                  {y}
                </option>
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
            Feb 1 – Dec 31 · Week {weekNumber}/48
          </span>
        </div>
      </div>
      <div className="h-1 bg-muted mb-4 border border-border">
        <div
          className="h-full bg-amber-600 dark:bg-amber-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Standings Table */}
      <div className="border border-border mb-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/70">
              <th className="border border-border px-2 py-1.5 text-left font-semibold w-8">#</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Competitor</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Total Pts</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Gap</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Acts</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Pts/Act</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Miles</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold" style={{ width: "20%" }}>
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, i) => {
              const pct =
                maxPoints > 0 ? (entry.totalPoints / maxPoints) * 100 : 0;
              const gap = leaderPoints - entry.totalPoints;
              const ptsPerAct = entry.activityCount > 0 ? entry.totalPoints / entry.activityCount : 0;

              return (
                <tr
                  key={entry.userId}
                  className={`hover:bg-amber-50 dark:hover:bg-amber-950/20 ${
                    i === 0
                      ? "bg-amber-50/50 dark:bg-amber-950/10 font-semibold"
                      : i % 2 === 0
                        ? "bg-background"
                        : "bg-muted/30"
                  }`}
                >
                  <td className="border border-border px-2 py-1.5 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="border border-border px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.name}
                    </span>
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                    {entry.totalPoints.toFixed(1)}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {i === 0 ? "\u2013" : `-${gap.toFixed(1)}`}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                    {entry.activityCount}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                    {ptsPerAct.toFixed(1)}
                  </td>
                  <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                    {entry.totalMiles.toFixed(0)}
                  </td>
                  <td className="border border-border px-2 py-1.5">
                    <div className="h-3 bg-muted rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: entry.color,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/70 font-semibold">
              <td className="border border-border px-2 py-1.5" colSpan={2}>
                TOTALS
              </td>
              <td className="border border-border px-2 py-1.5 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                {leaderboard.reduce((s, l) => s + l.totalPoints, 0).toFixed(1)}
              </td>
              <td className="border border-border px-2 py-1.5"></td>
              <td className="border border-border px-2 py-1.5"></td>
              <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                {totalActivities}
              </td>
              <td className="border border-border px-2 py-1.5"></td>
              <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                {totalMiles.toFixed(0)}
              </td>
              <td className="border border-border px-2 py-1.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

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

      {/* Stats Row */}
      <div className="border border-border">
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr className="bg-muted/30">
              <td className="border border-border px-2 py-1.5 font-semibold w-1/4">
                Active Votes
              </td>
              <td className="border border-border px-2 py-1.5 tabular-nums">
                {amendmentCount}
              </td>
              <td className="border border-border px-2 py-1.5 font-semibold w-1/4">
                Total Activities
              </td>
              <td className="border border-border px-2 py-1.5 tabular-nums">
                {totalActivities}
              </td>
            </tr>
            <tr className="bg-background">
              <td className="border border-border px-2 py-1.5 font-semibold">
                Total Miles
              </td>
              <td className="border border-border px-2 py-1.5 tabular-nums">
                {totalMiles.toFixed(0)}
              </td>
              <td className="border border-border px-2 py-1.5 font-semibold">
                Current Week
              </td>
              <td className="border border-border px-2 py-1.5 tabular-nums">
                W{weekNumber}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
