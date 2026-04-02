"use client";

import { useEffect, useState } from "react";
import { TrendChart } from "@/components/trend-chart";

interface ChampionData {
  year: number;
  champion: { name: string; color: string; points: number } | null;
}

export default function HistoryPage() {
  const [chartData, setChartData] = useState<{ season: string; [key: string]: string | number }[]>([]);
  const [historyUsers, setHistoryUsers] = useState<{ name: string; color: string }[]>([]);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [records, setRecords] = useState<{
    bestSeason: {
      holder: string;
      color: string;
      points: number;
      season: number;
    } | null;
  }>({ bestSeason: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/history")
      .then((r) => r.json())
      .then((d) => {
        setChartData(d.chartData || []);
        setHistoryUsers(d.users || []);
        setChampions(d.champions || []);
        setRecords(d.records || { bestSeason: null });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">Loading...</div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-full">
      <h1 className="text-lg font-bold mb-3">History</h1>

      {/* Trend Chart - keep as-is, charts are charts */}
      {chartData.length > 0 && (
        <div className="border border-border p-3 mb-4 bg-background">
          <p className="text-xs font-semibold mb-2">Points by Season</p>
          <TrendChart data={chartData} users={historyUsers} />
        </div>
      )}

      {/* Season Champions Table */}
      <div className="border border-border mb-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/70">
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Season</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Champion</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {champions.map((c, i) => (
              <tr
                key={c.year}
                className={`hover:bg-amber-50 dark:hover:bg-amber-950/20 ${
                  i % 2 === 0 ? "bg-background" : "bg-muted/30"
                }`}
              >
                <td className="border border-border px-2 py-1 tabular-nums font-semibold">{c.year}</td>
                <td className="border border-border px-2 py-1">
                  {c.champion ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.champion.color }}
                      />
                      {c.champion.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </td>
                <td className="border border-border px-2 py-1 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                  {c.champion ? c.champion.points.toFixed(1) : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All-Time Records Table */}
      <div className="border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/70">
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Record</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Holder</th>
              <th className="border border-border px-2 py-1.5 text-right font-semibold">Value</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold">Season</th>
            </tr>
          </thead>
          <tbody>
            {records.bestSeason && (
              <tr className="bg-background hover:bg-amber-50 dark:hover:bg-amber-950/20">
                <td className="border border-border px-2 py-1 font-semibold">Most Points (Season)</td>
                <td className="border border-border px-2 py-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: records.bestSeason.color }}
                    />
                    {records.bestSeason.holder}
                  </span>
                </td>
                <td className="border border-border px-2 py-1 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                  {records.bestSeason.points.toFixed(1)}
                </td>
                <td className="border border-border px-2 py-1 tabular-nums">{records.bestSeason.season}</td>
              </tr>
            )}
            {!records.bestSeason && (
              <tr className="bg-background">
                <td className="border border-border px-2 py-1 text-muted-foreground" colSpan={4}>
                  No records yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
