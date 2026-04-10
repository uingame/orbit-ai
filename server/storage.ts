import { db } from "./db";
import {
  users, events, stations, teams, scheduleSlots, scores, notifications, aiFeedbackSessions, aiFeedbackMessages,
  type InsertUser, type InsertEvent, type InsertStation, type InsertTeam, type InsertScheduleSlot, type InsertScore, type InsertNotification, type InsertAiFeedbackSession, type InsertAiFeedbackMessage,
  type User, type Event, type Station, type Team, type ScheduleSlot, type Score, type Notification, type AiFeedbackSession, type AiFeedbackMessage
} from "@shared/schema";
import { authorizedEmails, type AuthorizedEmail, type InsertAuthorizedEmail } from "@shared/models/auth";
import { eq, and, inArray } from "drizzle-orm";

export interface IStorage {
  // User/Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(userId: number): Promise<void>;
  getJudges(): Promise<User[]>;
  getManagers(): Promise<User[]>;
  getJudgesWithEvents(): Promise<(User & { assignedEvents: Event[] })[]>;

  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventsByManager(managerId: number): Promise<Event[]>;
  getJudgeEvents(judgeId: number): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(eventId: number, data: Partial<InsertEvent>): Promise<Event | undefined>;
  updateEventJudges(eventId: number, judgeIds: number[]): Promise<Event | undefined>;
  deleteEvent(eventId: number): Promise<boolean>;
  duplicateEvent(eventId: number): Promise<Event | undefined>;

  // Stations
  getStations(eventId: number): Promise<Station[]>;
  createStation(station: InsertStation): Promise<Station>;
  updateStation(stationId: number, data: Partial<InsertStation>): Promise<Station | undefined>;
  deleteStation(stationId: number): Promise<boolean>;

  // Teams
  getTeams(eventId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(teamId: number, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(teamId: number): Promise<boolean>;

  // Schedule
  getSlots(eventId: number): Promise<ScheduleSlot[]>;
  getSlotById(slotId: number): Promise<ScheduleSlot | undefined>;
  getJudgeSlots(eventId: number, judgeId: number): Promise<ScheduleSlot[]>;
  getJudgeTeamIds(eventId: number, judgeId: number): Promise<number[]>;
  createSlot(slot: InsertScheduleSlot): Promise<ScheduleSlot>;
  updateSlot(slotId: number, data: Partial<InsertScheduleSlot>): Promise<ScheduleSlot | undefined>;
  deleteSlot(slotId: number): Promise<boolean>;

  // Scores
  getScores(eventId: number): Promise<Score[]>;
  getJudgeScores(eventId: number, judgeId: number): Promise<Score[]>;
  createScore(score: InsertScore): Promise<Score>;

  // Notifications
  getNotifications(judgeId: number): Promise<Notification[]>;
  getAllNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(notificationId: number): Promise<Notification | undefined>;

  // AI Feedback Sessions
  getAiSession(slotId: number, judgeId: number): Promise<AiFeedbackSession | undefined>;
  getAiSessionById(sessionId: number): Promise<AiFeedbackSession | undefined>;
  createAiSession(session: InsertAiFeedbackSession): Promise<AiFeedbackSession>;
  updateAiSession(sessionId: number, data: Partial<InsertAiFeedbackSession>): Promise<AiFeedbackSession | undefined>;
  getAiSessionMessages(sessionId: number): Promise<AiFeedbackMessage[]>;
  createAiMessage(message: InsertAiFeedbackMessage): Promise<AiFeedbackMessage>;

  // Authorized Emails
  getAuthorizedEmails(): Promise<AuthorizedEmail[]>;
  getAuthorizedEmailById(id: string): Promise<AuthorizedEmail | undefined>;
  getAuthorizedEmailByEmail(email: string): Promise<AuthorizedEmail | undefined>;
  createAuthorizedEmail(data: InsertAuthorizedEmail): Promise<AuthorizedEmail>;
  deleteAuthorizedEmail(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(userId: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
    return updated;
  }

  async deleteUser(userId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getJudges(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "judge"));
  }

  async getManagers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "manager"));
  }

  async getJudgesWithEvents(): Promise<(User & { assignedEvents: Event[] })[]> {
    const judges = await this.getJudges();
    const allEvents = await this.getEvents();
    
    return judges.map(judge => {
      const assignedEvents = allEvents.filter(event => 
        event.judgeIds?.includes(judge.id)
      );
      return {
        ...judge,
        assignedEvents,
      };
    });
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventsByManager(managerId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.managerId, managerId));
  }

  async getJudgeEvents(judgeId: number): Promise<Event[]> {
    // Get events where judge is assigned (via event.judgeIds or has slots assigned)
    const allEvents = await this.getEvents();
    const judgeEvents: Event[] = [];
    
    for (const event of allEvents) {
      // Check if judge is in event.judgeIds
      if (event.judgeIds?.includes(judgeId)) {
        judgeEvents.push(event);
        continue;
      }
      
      // Check if judge has any slots in this event
      const slots = await this.getSlots(event.id);
      const hasSlots = slots.some(slot => slot.judgeIds?.includes(judgeId));
      if (hasSlots) {
        judgeEvents.push(event);
      }
    }
    
    return judgeEvents;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(eventId: number, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, eventId)).returning();
    return updated;
  }

  async updateEventJudges(eventId: number, judgeIds: number[]): Promise<Event | undefined> {
    const [updated] = await db.update(events).set({ judgeIds }).where(eq(events.id, eventId)).returning();
    return updated;
  }

  async deleteEvent(eventId: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, eventId));
    return true;
  }

  async duplicateEvent(eventId: number): Promise<Event | undefined> {
    const originalEvent = await this.getEvent(eventId);
    if (!originalEvent) return undefined;

    // Create new event with copied data
    const newEvent = await this.createEvent({
      name: `${originalEvent.name} (Copy)`,
      date: new Date(),
      location: originalEvent.location,
      managerId: originalEvent.managerId,
      judgeIds: originalEvent.judgeIds || [],
    });

    // Get and duplicate stations
    const originalStations = await this.getStations(eventId);
    const stationIdMap = new Map<number, number>();
    for (const station of originalStations) {
      const newStation = await this.createStation({
        eventId: newEvent.id,
        name: station.name,
        rubric: station.rubric as { criteria: { name: string; maxPoints: number }[] },
      });
      stationIdMap.set(station.id, newStation.id);
    }

    // Get and duplicate teams
    const originalTeams = await this.getTeams(eventId);
    const teamIdMap = new Map<number, number>();
    for (const team of originalTeams) {
      const newTeam = await this.createTeam({
        eventId: newEvent.id,
        name: team.name,
        schoolName: team.schoolName,
        category: team.category,
        language: team.language,
      });
      teamIdMap.set(team.id, newTeam.id);
    }

    // Get and duplicate schedule slots with mapped IDs
    const originalSlots = await this.getSlots(eventId);
    for (const slot of originalSlots) {
      const newTeamId = teamIdMap.get(slot.teamId);
      const newStationId = stationIdMap.get(slot.stationId);
      if (newTeamId && newStationId) {
        await this.createSlot({
          eventId: newEvent.id,
          teamId: newTeamId,
          stationId: newStationId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          judgeIds: slot.judgeIds || [],
          captainJudgeId: slot.captainJudgeId,
        });
      }
    }

    return newEvent;
  }

  // Stations
  async getStations(eventId: number): Promise<Station[]> {
    return await db.select().from(stations).where(eq(stations.eventId, eventId));
  }

  async createStation(station: InsertStation): Promise<Station> {
    const [newStation] = await db.insert(stations).values(station).returning();
    return newStation;
  }

  async updateStation(stationId: number, data: Partial<InsertStation>): Promise<Station | undefined> {
    const [updated] = await db.update(stations).set(data).where(eq(stations.id, stationId)).returning();
    return updated;
  }

  async deleteStation(stationId: number): Promise<boolean> {
    await db.delete(stations).where(eq(stations.id, stationId));
    return true;
  }

  // Teams
  async getTeams(eventId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.eventId, eventId));
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(teamId: number, data: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(data).where(eq(teams.id, teamId)).returning();
    return updated;
  }

  async deleteTeam(teamId: number): Promise<boolean> {
    await db.delete(teams).where(eq(teams.id, teamId));
    return true;
  }

  // Schedule
  async getSlots(eventId: number): Promise<ScheduleSlot[]> {
    return await db.select().from(scheduleSlots).where(eq(scheduleSlots.eventId, eventId));
  }

  async getSlotById(slotId: number): Promise<ScheduleSlot | undefined> {
    const [slot] = await db.select().from(scheduleSlots).where(eq(scheduleSlots.id, slotId));
    return slot;
  }

  async getJudgeSlots(eventId: number, judgeId: number): Promise<ScheduleSlot[]> {
    // Get all slots for event, then filter by judgeIds containing this judge
    const allSlots = await this.getSlots(eventId);
    return allSlots.filter(slot => slot.judgeIds?.includes(judgeId));
  }

  async getJudgeTeamIds(eventId: number, judgeId: number): Promise<number[]> {
    // Get unique team IDs from slots assigned to this judge
    const judgeSlots = await this.getJudgeSlots(eventId, judgeId);
    const teamIds = new Set<number>();
    for (const slot of judgeSlots) {
      if (slot.teamId) {
        teamIds.add(slot.teamId);
      }
    }
    return Array.from(teamIds);
  }

  async createSlot(slot: InsertScheduleSlot): Promise<ScheduleSlot> {
    const [newSlot] = await db.insert(scheduleSlots).values(slot).returning();
    return newSlot;
  }

  async updateSlot(slotId: number, data: Partial<InsertScheduleSlot>): Promise<ScheduleSlot | undefined> {
    const [updated] = await db.update(scheduleSlots).set(data).where(eq(scheduleSlots.id, slotId)).returning();
    return updated;
  }

  async deleteSlot(slotId: number): Promise<boolean> {
    await db.delete(scheduleSlots).where(eq(scheduleSlots.id, slotId));
    return true;
  }

  // Scores
  async getScores(eventId: number): Promise<Score[]> {
    const result = await db.select({ score: scores })
      .from(scores)
      .innerJoin(stations, eq(scores.stationId, stations.id))
      .where(eq(stations.eventId, eventId));
    return result.map(r => r.score);
  }

  async getJudgeScores(eventId: number, judgeId: number): Promise<Score[]> {
    // Get scores only for teams assigned to this judge
    const judgeTeamIds = await this.getJudgeTeamIds(eventId, judgeId);
    if (judgeTeamIds.length === 0) return [];
    
    const allScores = await this.getScores(eventId);
    return allScores.filter(score => judgeTeamIds.includes(score.teamId));
  }

  async createScore(score: InsertScore): Promise<Score> {
    const [newScore] = await db.insert(scores).values(score).returning();
    // Also update slot status to 'complete'
    await db.update(scheduleSlots)
      .set({ status: "complete" })
      .where(eq(scheduleSlots.id, score.slotId));
    return newScore;
  }

  // Notifications
  async getNotifications(judgeId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.judgeId, judgeId));
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).orderBy(notifications.createdAt);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationRead(notificationId: number): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();
    return updated;
  }

  // AI Feedback Sessions
  async getAiSession(slotId: number, judgeId: number): Promise<AiFeedbackSession | undefined> {
    const [session] = await db.select().from(aiFeedbackSessions)
      .where(and(eq(aiFeedbackSessions.slotId, slotId), eq(aiFeedbackSessions.judgeId, judgeId)));
    return session;
  }

  async getAiSessionById(sessionId: number): Promise<AiFeedbackSession | undefined> {
    const [session] = await db.select().from(aiFeedbackSessions).where(eq(aiFeedbackSessions.id, sessionId));
    return session;
  }

  async createAiSession(session: InsertAiFeedbackSession): Promise<AiFeedbackSession> {
    const [newSession] = await db.insert(aiFeedbackSessions).values(session).returning();
    return newSession;
  }

  async updateAiSession(sessionId: number, data: Partial<InsertAiFeedbackSession>): Promise<AiFeedbackSession | undefined> {
    const [updated] = await db.update(aiFeedbackSessions).set(data).where(eq(aiFeedbackSessions.id, sessionId)).returning();
    return updated;
  }

  async getAiSessionMessages(sessionId: number): Promise<AiFeedbackMessage[]> {
    return await db.select().from(aiFeedbackMessages).where(eq(aiFeedbackMessages.sessionId, sessionId));
  }

  async createAiMessage(message: InsertAiFeedbackMessage): Promise<AiFeedbackMessage> {
    const [newMessage] = await db.insert(aiFeedbackMessages).values(message).returning();
    return newMessage;
  }

  // Authorized Emails
  async getAuthorizedEmails(): Promise<AuthorizedEmail[]> {
    return await db.select().from(authorizedEmails);
  }

  async getAuthorizedEmailById(id: string): Promise<AuthorizedEmail | undefined> {
    const [email] = await db.select().from(authorizedEmails).where(eq(authorizedEmails.id, id));
    return email;
  }

  async getAuthorizedEmailByEmail(email: string): Promise<AuthorizedEmail | undefined> {
    const [result] = await db.select().from(authorizedEmails).where(eq(authorizedEmails.email, email.toLowerCase().trim()));
    return result;
  }

  async createAuthorizedEmail(data: InsertAuthorizedEmail): Promise<AuthorizedEmail> {
    const [newEmail] = await db.insert(authorizedEmails).values(data).returning();
    return newEmail;
  }

  async deleteAuthorizedEmail(id: string): Promise<void> {
    await db.delete(authorizedEmails).where(eq(authorizedEmails.id, id));
  }
}

export const storage = new DatabaseStorage();
