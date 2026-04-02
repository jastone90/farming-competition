import { cn } from "@/lib/utils";

interface VoteIndicatorProps {
  users: { id: number; name: string; color: string }[];
  votes: { userId: number; vote: "yee" | "nah" }[];
  compact?: boolean;
}

export function VoteIndicator({ users, votes, compact }: VoteIndicatorProps) {
  return (
    <div className={cn("flex gap-2", compact ? "gap-1" : "gap-3")}>
      {users.map((user) => {
        const vote = votes.find((v) => v.userId === user.id);
        const isYee = vote?.vote === "yee";
        const isNah = vote?.vote === "nah";
        const isPending = !vote;

        if (compact) {
          return (
            <span
              key={user.id}
              className={cn(
                "text-xs font-medium",
                isYee && "text-green-600 dark:text-green-400",
                isNah && "text-red-500",
                isPending && "text-muted-foreground"
              )}
            >
              {user.name[0]}
              {isYee ? "✓" : isNah ? "✗" : "?"}
            </span>
          );
        }

        return (
          <div
            key={user.id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-2 min-w-[60px]",
              isYee && "border-green-500/40 bg-green-50 dark:bg-green-950/20",
              isNah && "border-red-500/40 bg-red-50 dark:bg-red-950/20",
              isPending && "border-border bg-stone-50 dark:bg-stone-900"
            )}
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: user.color }}
            >
              {user.name[0]}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                isYee && "text-green-600 dark:text-green-400",
                isNah && "text-red-500",
                isPending && "text-muted-foreground"
              )}
            >
              {isYee ? "Yee ✓" : isNah ? "Nah ✗" : "Pending"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
