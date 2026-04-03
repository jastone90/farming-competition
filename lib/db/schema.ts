import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  stravaAthleteId: text("strava_athlete_id"),
  stravaAccessToken: text("strava_access_token"),
  stravaRefreshToken: text("strava_refresh_token"),
  stravaTokenExpiresAt: integer("strava_token_expires_at"),
  color: text("color").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  source: text("source", { enum: ["strava", "manual"] }).notNull(),
  stravaActivityId: text("strava_activity_id"),
  title: text("title").notNull(),
  type: text("type", {
    enum: [
      "ride",
      "run",
      "weight_training",
      "swimming",
    ],
  }).notNull(),
  isIndoor: integer("is_indoor", { mode: "boolean" }).notNull().default(false),
  withChild: integer("with_child", { mode: "boolean" }).notNull().default(false),
  distanceMiles: real("distance_miles"),
  durationMinutes: real("duration_minutes"),
  elevationGainFeet: real("elevation_gain_feet"),
  caloriesBurned: real("calories_burned"),
  poundsLifted: real("pounds_lifted"),
  rawPoints: real("raw_points").notNull().default(0),
  modifiedPoints: real("modified_points").notNull().default(0),
  pointBreakdown: text("point_breakdown").notNull().default("{}"),
  activityDate: text("activity_date").notNull(),
  season: integer("season").notNull(),
  engineVersion: text("engine_version"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const scoringEngineVersions = sqliteTable("scoring_engine_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: text("version").notNull(),
  summary: text("summary").notNull(),
  effectiveDate: text("effective_date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const amendments = sqliteTable("amendments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposedByUserId: integer("proposed_by_user_id")
    .notNull()
    .references(() => users.id),
  status: text("status", {
    enum: ["voting", "approved", "rejected", "deferred"],
  }).notNull(),
  effectiveDate: text("effective_date"),
  season: integer("season").notNull(),
  votingOpensAt: text("voting_opens_at").notNull(),
  votingClosesAt: text("voting_closes_at"),
  rejectionCommentary: text("rejection_commentary"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amendmentId: integer("amendment_id")
    .notNull()
    .references(() => amendments.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  vote: text("vote", { enum: ["yee", "nah"] }).notNull(),
  castAt: text("cast_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const scoringRules = sqliteTable("scoring_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amendmentId: integer("amendment_id").references(() => amendments.id),
  ruleType: text("rule_type", {
    enum: [
      "base_biking",
      "base_running",
      "base_swimming",
      "indoor_modifier",
      "elevation_bonus",
      "general_physical",
      "calorie_scoring",
      "handicap",
      "weight_training",
      "kidz_multiplier",
    ],
  }).notNull(),
  config: text("config").notNull().default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  effectiveSeason: integer("effective_season").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action", {
    enum: [
      "activity_create",
      "activity_delete",
      "amendment_propose",
      "amendment_withdraw",
      "vote_cast",
      "pin_change",
      "user_create",
      "color_change",
      "strava_sync",
    ],
  }).notNull(),
  entityType: text("entity_type", {
    enum: ["activity", "amendment", "vote", "user"],
  }).notNull(),
  entityId: integer("entity_id"),
  metadata: text("metadata").notNull().default("{}"),
  isSketch: integer("is_sketch", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const seasons = sqliteTable("seasons", {
  year: integer("year").primaryKey(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  championUserId: integer("champion_user_id").references(() => users.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Amendment = typeof amendments.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type ScoringRule = typeof scoringRules.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type ScoringEngineVersion = typeof scoringEngineVersions.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
