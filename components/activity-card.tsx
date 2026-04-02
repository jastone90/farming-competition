import { cn } from "@/lib/utils";

const typeEmoji: Record<string, string> = {
  ride: "🚴",
  run: "🏃",
  weight_training: "🏋️",
  swimming: "🏊",
};

interface ActivityCardProps {
  title: string;
  type: string;
  source: "strava" | "manual";
  isIndoor: boolean;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  elevationGainFeet?: number | null;
  caloriesBurned?: number | null;
  modifiedPoints: number;
  pointBreakdown: Record<string, { label: string; points: number }>;
  activityDate: string;
  userName: string;
  userColor: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

export function ActivityCard({
  title,
  type,
  source,
  isIndoor,
  distanceMiles,
  durationMinutes,
  elevationGainFeet,
  caloriesBurned,
  modifiedPoints,
  pointBreakdown,
  activityDate,
  userName,
  userColor,
  onDelete,
  canDelete,
}: ActivityCardProps) {
  const emoji = typeEmoji[type] || "💪";
  const date = new Date(activityDate);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-2xl shadow-sm shadow-stone-200/50 dark:shadow-none bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl shrink-0">{emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{title}</span>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  source === "strava"
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                )}
              >
                {source === "strava" ? "Strava" : "Manual"}
              </span>
              {isIndoor && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Indoor
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {distanceMiles != null && distanceMiles > 0 && (
                <span>{distanceMiles.toFixed(1)} mi</span>
              )}
              {durationMinutes != null && durationMinutes > 0 && (
                <span>{Math.round(durationMinutes)} min</span>
              )}
              {elevationGainFeet != null && elevationGainFeet > 0 && (
                <span>{Math.round(elevationGainFeet)} ft elev</span>
              )}
              {caloriesBurned != null && caloriesBurned > 0 && (
                <span>{Math.round(caloriesBurned)} cal</span>
              )}
            </div>
            <div className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
              {Object.values(pointBreakdown)
                .map((b) => `${b.points >= 0 ? "+" : ""}${b.points.toFixed(1)} ${b.label.split("=")[0].trim()}`)
                .join(" · ")}{" "}
              = <span className="font-bold">{modifiedPoints.toFixed(1)} pts</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: userColor }}
            >
              {userName[0]}
            </div>
            <span className="text-xs text-muted-foreground">{userName}</span>
          </div>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
            +{modifiedPoints.toFixed(1)}
          </span>
          {canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-destructive hover:underline mt-1"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
