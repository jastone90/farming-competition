import type { ActivityType } from "@/lib/scoring/types";

/** Human-readable labels for each activity type (competition names). */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  ride: "Ride",
  run: "Run",
  weight_training: "Haybailz",
  swimming: "Swim",
};

/** Chart / badge colors per activity type. */
export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  ride: "#3B82F6",
  run: "#22C55E",
  swimming: "#06B6D4",
  weight_training: "#F59E0B",
};
