interface ScoreBreakdownProps {
  breakdown: Record<string, { label: string; points: number }>;
  modifiedPoints: number;
}

export function ScoreBreakdown({ breakdown, modifiedPoints }: ScoreBreakdownProps) {
  const items = Object.entries(breakdown);

  return (
    <div className="space-y-1 text-sm">
      {items.map(([key, item]) => (
        <div key={key} className="flex justify-between">
          <span className="text-muted-foreground">{item.label}</span>
          <span
            className={
              item.points >= 0
                ? "text-amber-700 dark:text-amber-400 font-medium"
                : "text-red-500 font-medium"
            }
          >
            {item.points >= 0 ? "+" : ""}
            {item.points.toFixed(2)} pts
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-1 font-bold">
        <span>Total</span>
        <span className="text-amber-700 dark:text-amber-400">
          {modifiedPoints.toFixed(2)} pts
        </span>
      </div>
    </div>
  );
}
