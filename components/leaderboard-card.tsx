import { cn } from "@/lib/utils";

interface LeaderboardCardProps {
  rank: number;
  name: string;
  color: string;
  totalPoints: number;
  weeklyActivities: number;
  maxPoints: number;
  trend: "up" | "down" | "same";
  isLeader: boolean;
}

export function LeaderboardCard({
  rank,
  name,
  color,
  totalPoints,
  weeklyActivities,
  maxPoints,
  trend,
  isLeader,
}: LeaderboardCardProps) {
  const pctWidth = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "–";
  const trendColor =
    trend === "up"
      ? "text-green-500"
      : trend === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-all",
        isLeader
          ? "border border-amber-300/50 bg-primary/5 shadow-md shadow-amber-200/40 dark:shadow-amber-900/20"
          : "shadow-sm shadow-stone-200/50 dark:shadow-none bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-muted-foreground w-6 text-center font-serif">
          {rank}
        </span>
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: color }}
        >
          {name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold truncate">{name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold">
                {totalPoints.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">pts</span>
              <span className={cn("text-sm font-medium", trendColor)}>
                {trendIcon}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pctWidth}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {weeklyActivities} this week
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
