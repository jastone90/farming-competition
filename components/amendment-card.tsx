import { cn } from "@/lib/utils";
import { VoteIndicator } from "./vote-indicator";

interface AmendmentCardProps {
  number: number;
  title: string;
  description: string;
  proposerName: string;
  status: "voting" | "approved" | "rejected" | "deferred";
  votingOpensAt: string;
  votingClosesAt?: string | null;
  rejectionCommentary?: string | null;
  users: { id: number; name: string; color: string }[];
  votes: { userId: number; vote: "yee" | "nah" }[];
  currentUserId?: number | null;
  onVote?: (vote: "yee" | "nah") => void;
}

export function AmendmentCard({
  number,
  title,
  description,
  proposerName,
  status,
  votingOpensAt,
  rejectionCommentary,
  users,
  votes,
  currentUserId,
  onVote,
}: AmendmentCardProps) {
  const yeeCount = votes.filter((v) => v.vote === "yee").length;
  const nahCount = votes.filter((v) => v.vote === "nah").length;
  const supermajority = Math.ceil(users.length * 3 / 4);
  const hasVoted =
    currentUserId && votes.some((v) => v.userId === currentUserId);
  const isVoting = status === "voting";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        status === "approved" && "border-green-500/30 bg-card",
        status === "rejected" && "border-red-500/20 bg-card opacity-70",
        status === "voting" &&
          "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10",
        status === "deferred" && "border-border bg-card opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "shrink-0 rounded-lg px-2 py-1 text-xs font-bold",
            status === "approved" &&
              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            status === "rejected" &&
              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            status === "voting" &&
              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
            status === "deferred" && "bg-muted text-muted-foreground"
          )}
        >
          #{number}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {(isVoting || status === "rejected") && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>Proposed by {proposerName}</span>
            <span>·</span>
            <span>
              {new Date(votingOpensAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {status === "rejected" && rejectionCommentary && (
            <p className="mt-2 text-sm font-bold text-red-600 dark:text-red-400">
              {rejectionCommentary}
            </p>
          )}

          <div className="mt-3">
            {isVoting ? (
              <VoteIndicator users={users} votes={votes} />
            ) : (
              <div className="flex items-center gap-2">
                <VoteIndicator users={users} votes={votes} compact />
                <span className="text-xs font-medium text-muted-foreground">
                  ({yeeCount}-{nahCount})
                </span>
              </div>
            )}
          </div>

          {isVoting && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${(yeeCount / supermajority) * 100}%` }}
                  />
                </div>
                <span>{yeeCount}/{supermajority} needed</span>
              </div>
              {currentUserId && !hasVoted && onVote && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onVote("yee")}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 transition-colors"
                  >
                    Yee ✓
                  </button>
                  <button
                    onClick={() => onVote("nah")}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
                  >
                    Nah ✗
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
