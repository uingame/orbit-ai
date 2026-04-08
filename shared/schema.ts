import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";
export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("judge"), // "admin", "manager" or "judge"
  name: text("name").notNull(),
  email: text("email"), // Optional email address (used for Google login + invitations)
  phone: text("phone"),
  languages: text("languages").array(), // ["English", "Hebrew", "Arabic"]
  avatarUrl: text("avatar_url"),
  restrictions: text("restrictions"), // Text-based restrictions (e.g., "Cannot judge on weekends", "Only Hebrew events")
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  location: text("location"),
  note: text("note"),
  isActive: boolean("is_active").default(true),
  managerId: integer("manager_id"),
  judgeIds: integer("judge_ids").array(),
});

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  rubric: jsonb("rubric").notNull(), // { criteria: [{ name, maxPoints, note? }] }
  note: text("note"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  schoolName: text("school_name").notNull(),
  city: text("city"),
  country: text("country"),
  category: text("category").notNull(),
  language: text("language").notNull(),
  totalScore: integer("total_score").default(0),
});

export const scheduleSlots = pgTable("schedule_slots", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  stationId: integer("station_id").notNull(),
  teamId: integer("team_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  judgeIds: integer("judge_ids").array(), // Array of user IDs
  captainJudgeId: integer("captain_judge_id"),
  status: text("status").default("pending"), // pending, ongoing, complete, behind
});

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull(),
  teamId: integer("team_id").notNull(),
  stationId: integer("station_id").notNull(),
  judgeId: integer("judge_id").notNull(),
  scores: jsonb("scores").notNull(), // { criteria1: 5, criteria2: 8 }
  feedback: text("feedback"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  judgeId: integer("judge_id").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiFeedbackSessions = pgTable("ai_feedback_sessions", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull(),
  judgeId: integer("judge_id").notNull(),
  teamId: integer("team_id").notNull(),
  stationId: integer("station_id").notNull(),
  suggestedScores: jsonb("suggested_scores"), // { criterion: points }
  suggestedFeedback: text("suggested_feedback"),
  keywords: text("keywords").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiFeedbackMessages = pgTable("ai_feedback_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // optional extra data
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const stationsRelations = relations(stations, ({ one }) => ({
  event: one(events, {
    fields: [stations.eventId],
    references: [events.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
  event: one(events, {
    fields: [teams.eventId],
    references: [events.id],
  }),
}));

export const scheduleSlotsRelations = relations(scheduleSlots, ({ one }) => ({
  event: one(events, { fields: [scheduleSlots.eventId], references: [events.id] }),
  station: one(stations, { fields: [scheduleSlots.stationId], references: [stations.id] }),
  team: one(teams, { fields: [scheduleSlots.teamId], references: [teams.id] }),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  slot: one(scheduleSlots, { fields: [scores.slotId], references: [scheduleSlots.id] }),
  team: one(teams, { fields: [scores.teamId], references: [teams.id] }),
  station: one(stations, { fields: [scores.stationId], references: [stations.id] }),
  judge: one(users, { fields: [scores.judgeId], references: [users.id] }),
}));

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertStationSchema = createInsertSchema(stations).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, totalScore: true });
export const insertScheduleSlotSchema = createInsertSchema(scheduleSlots).omit({ id: true, status: true });
export const insertScoreSchema = createInsertSchema(scores).omit({ id: true, timestamp: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, isRead: true, createdAt: true });
export const insertAiFeedbackSessionSchema = createInsertSchema(aiFeedbackSessions).omit({ id: true, createdAt: true });
export const insertAiFeedbackMessageSchema = createInsertSchema(aiFeedbackMessages).omit({ id: true, createdAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Station = typeof stations.$inferSelect;
export type InsertStation = z.infer<typeof insertStationSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type ScheduleSlot = typeof scheduleSlots.$inferSelect;
export type InsertScheduleSlot = z.infer<typeof insertScheduleSlotSchema>;

export type Score = typeof scores.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type AiFeedbackSession = typeof aiFeedbackSessions.$inferSelect;
export type InsertAiFeedbackSession = z.infer<typeof insertAiFeedbackSessionSchema>;

export type AiFeedbackMessage = typeof aiFeedbackMessages.$inferSelect;
export type InsertAiFeedbackMessage = z.infer<typeof insertAiFeedbackMessageSchema>;
