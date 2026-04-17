import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth";
import { setupAuth as setupReplitAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { sendInvitationEmail } from "./email";
import { findEventConflicts, formatConflictError } from "@shared/event-conflicts";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Google OAuth - only enable when we have the required configuration.
  // This avoids installing a second session middleware during local
  // development when Google credentials aren't set.
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    await setupReplitAuth(app);
    registerAuthRoutes(app);
  }

  // Local Auth (username/password for admins)
  setupAuth(app);

  // AI Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // === Events ===
  app.get(api.events.list.path, async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    const role = (req.user as any).role;
    
    // Judges must use the judge-scoped endpoint
    if (role === "judge") {
      res.status(403).json({ message: "Judges must use /api/judge/events" });
      return;
    }
    
    const events = await storage.getEvents();
    
    // Admins can see all events
    if (role === "admin") {
      res.json(events);
      return;
    }
    
    // Managers can only see events they manage
    if (role === "manager") {
      const managerId = (req.user as any).id;
      const managerEvents = events.filter(e => e.managerId === managerId);
      res.json(managerEvents);
      return;
    }
    
    // Default: return empty for unknown roles
    res.json([]);
  });

  app.post(api.events.create.path, async (req, res) => {
    // Judges cannot create events
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot create events" });
      return;
    }
    if (!req.body.name?.trim()) { res.status(400).json({ message: "Event name is required" }); return; }
    if (!req.body.date) { res.status(400).json({ message: "Event date is required" }); return; }
    try {
      const eventData = {
        ...req.body,
        date: typeof req.body.date === 'string' ? new Date(req.body.date) : req.body.date,
      };
      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create event" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    // Judges cannot update events
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update events" });
      return;
    }
    const eventData = {
      ...req.body,
      date: typeof req.body.date === 'string' ? new Date(req.body.date) : req.body.date,
    };
    const event = await storage.updateEvent(Number(req.params.id), eventData);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json(event);
  });

  app.put("/api/events/:id/judges", async (req, res) => {
    // Judges cannot update event assignments
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update event assignments" });
      return;
    }
    const eventId = Number(req.params.id);
    const judgeIds: number[] = req.body.judgeIds || [];

    // Check for judge scheduling conflicts (same-day events)
    const targetEvent = await storage.getEvent(eventId);
    if (!targetEvent) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const allEvents = await storage.getEvents();
    const targetDate = new Date(targetEvent.date).toDateString();
    const overlappingEvents = allEvents.filter(
      (e) => e.id !== eventId && new Date(e.date).toDateString() === targetDate
    );

    const conflicts: { judgeId: number; eventName: string }[] = [];
    for (const judgeId of judgeIds) {
      for (const otherEvent of overlappingEvents) {
        if (otherEvent.judgeIds?.includes(judgeId)) {
          conflicts.push({ judgeId, eventName: otherEvent.name });
        }
      }
    }
    if (conflicts.length > 0) {
      const judges = await storage.getJudges();
      const details = conflicts.map((c) => {
        const judge = judges.find((j) => j.id === c.judgeId);
        return `${judge?.name || `Judge #${c.judgeId}`} is already assigned to "${c.eventName}" on the same day`;
      });
      res.status(400).json({ message: "Judge scheduling conflict", conflicts, details });
      return;
    }

    const event = await storage.updateEventJudges(eventId, judgeIds);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    // Judges cannot delete events
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot delete events" });
      return;
    }
    try {
      await storage.deleteEvent(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete event" });
    }
  });

  app.post("/api/events/:id/duplicate", async (req, res) => {
    // Judges cannot duplicate events
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot duplicate events" });
      return;
    }
    const newEvent = await storage.duplicateEvent(Number(req.params.id));
    if (!newEvent) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.status(201).json(newEvent);
  });

  app.get("/api/managers", async (req, res) => {
    // Only admins can view manager list
    if (req.isAuthenticated() && (req.user as any)?.role !== "admin") {
      res.status(403).json({ message: "Only admins can view manager list" });
      return;
    }
    const managers = await storage.getManagers();
    res.json(managers);
  });

  app.get("/api/managers-with-events", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.role !== "admin") {
      res.status(403).json({ message: "Only admins can view manager list" });
      return;
    }
    const managers = await storage.getManagersWithEvents();
    res.json(managers);
  });

  app.put("/api/events/:id/manager", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.role !== "admin") {
      res.status(403).json({ message: "Only admins can update event manager" });
      return;
    }
    const eventId = Number(req.params.id);
    const managerId: number | null = req.body.managerId ?? null;
    const event = await storage.updateEvent(eventId, { managerId });
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json(event);
  });

  app.delete("/api/managers/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.role !== "admin") {
      res.status(403).json({ message: "Only admins can delete managers" });
      return;
    }
    const managerId = Number(req.params.id);
    // Clear managerId from any events assigned to this manager
    const allEvents = await storage.getEvents();
    for (const event of allEvents) {
      if (event.managerId === managerId) {
        await storage.updateEvent(event.id, { managerId: null });
      }
    }
    await storage.deleteUser(managerId);
    res.status(204).send();
  });

  app.get("/api/judges", async (req, res) => {
    // Judges cannot view list of all judges
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot view judge list" });
      return;
    }
    const judges = await storage.getJudges();
    res.json(judges);
  });

  app.get("/api/judges-with-events", async (req, res) => {
    // Judges cannot view list of all judges
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot view judge list" });
      return;
    }
    const judges = await storage.getJudgesWithEvents();
    res.json(judges);
  });

  app.post("/api/judges", async (req, res) => {
    // Judges cannot create judges
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot create judges" });
      return;
    }
    try {
      const judge = await storage.createUser({ ...req.body, role: "judge" });
      res.status(201).json(judge);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create judge" });
    }
  });

  app.put("/api/judges/:id", async (req, res) => {
    // Judges cannot update judges
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update judges" });
      return;
    }
    const judge = await storage.updateUser(Number(req.params.id), req.body);
    if (!judge) {
      res.status(404).json({ message: "Judge not found" });
      return;
    }
    res.json(judge);
  });

  app.delete("/api/judges/:id", async (req, res) => {
    // Judges cannot delete judges
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot delete judges" });
      return;
    }
    await storage.deleteUser(Number(req.params.id));
    res.status(204).send();
  });

  // === Judge-Scoped Endpoints (for judges to see only their assignments) ===
  app.get("/api/judge/events", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const judgeId = (req.user as any).id;
    const judgeEvents = await storage.getJudgeEvents(judgeId);
    res.json(judgeEvents);
  });

  app.get("/api/judge/events/:eventId/teams", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const judgeId = (req.user as any).id;
    const eventId = Number(req.params.eventId);
    const teamIds = await storage.getJudgeTeamIds(eventId, judgeId);
    
    // Get the full team objects for these IDs
    const allTeams = await storage.getTeams(eventId);
    const judgeTeams = allTeams.filter(team => teamIds.includes(team.id));
    res.json(judgeTeams);
  });

  app.get("/api/judge/events/:eventId/slots", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const judgeId = (req.user as any).id;
    const eventId = Number(req.params.eventId);
    const judgeSlots = await storage.getJudgeSlots(eventId, judgeId);
    res.json(judgeSlots);
  });

  app.get("/api/judge/events/:eventId/scores", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const judgeId = (req.user as any).id;
    const eventId = Number(req.params.eventId);
    const judgeScores = await storage.getJudgeScores(eventId, judgeId);
    res.json(judgeScores);
  });

  // === Stations ===
  app.get(api.stations.list.path, async (req, res) => {
    const eventId = Number(req.params.eventId);
    // For judges, verify they are assigned to this event
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      const judgeId = (req.user as any).id;
      const judgeEvents = await storage.getJudgeEvents(judgeId);
      if (!judgeEvents.some(e => e.id === eventId)) {
        res.status(403).json({ message: "You are not assigned to this event" });
        return;
      }
    }
    const stations = await storage.getStations(eventId);
    res.json(stations);
  });

  app.post(api.stations.create.path, async (req, res) => {
    // Judges cannot create stations
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot create stations" });
      return;
    }
    if (!req.body.name?.trim()) { res.status(400).json({ message: "Station name is required" }); return; }
    if (!req.body.rubric?.criteria?.length) { res.status(400).json({ message: "Station must have at least one rubric criterion" }); return; }
    try {
      const station = await storage.createStation(req.body);
      res.status(201).json(station);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create station" });
    }
  });

  app.put("/api/stations/:id", async (req, res) => {
    // Judges cannot update stations
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update stations" });
      return;
    }
    const station = await storage.updateStation(Number(req.params.id), req.body);
    if (!station) {
      res.status(404).json({ message: "Station not found" });
      return;
    }
    res.json(station);
  });

  app.delete("/api/stations/:id", async (req, res) => {
    // Judges cannot delete stations
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot delete stations" });
      return;
    }
    try {
      await storage.deleteStation(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete station" });
    }
  });

  // === Teams ===
  app.get(api.teams.list.path, async (req, res) => {
    // Judges must use the judge-scoped endpoint
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges must use /api/judge/events/:eventId/teams" });
      return;
    }
    const teams = await storage.getTeams(Number(req.params.eventId));
    res.json(teams);
  });

  app.post(api.teams.create.path, async (req, res) => {
    // Judges cannot create teams
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot create teams" });
      return;
    }
    if (!req.body.name?.trim()) { res.status(400).json({ message: "Team name is required" }); return; }
    try {
      const team = await storage.createTeam(req.body);
      res.status(201).json(team);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create team" });
    }
  });

  app.put("/api/teams/:id", async (req, res) => {
    // Judges cannot update teams
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update teams" });
      return;
    }
    const team = await storage.updateTeam(Number(req.params.id), req.body);
    if (!team) {
      res.status(404).json({ message: "Team not found" });
      return;
    }
    res.json(team);
  });

  app.delete("/api/teams/:id", async (req, res) => {
    // Judges cannot delete teams
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot delete teams" });
      return;
    }
    try {
      await storage.deleteTeam(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete team" });
    }
  });

  // === Slots ===
  app.get(api.slots.list.path, async (req, res) => {
    // Judges must use the judge-scoped endpoint
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges must use /api/judge/events/:eventId/slots" });
      return;
    }
    const slots = await storage.getSlots(Number(req.params.eventId));
    res.json(slots);
  });

  app.post(api.slots.create.path, async (req, res) => {
    // Judges cannot create slots
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot create slots" });
      return;
    }
    if (!req.body.eventId) { res.status(400).json({ message: "Event ID is required" }); return; }
    if (!req.body.teamId) { res.status(400).json({ message: "Team ID is required" }); return; }
    if (!req.body.stationId) { res.status(400).json({ message: "Station ID is required" }); return; }
    try {
      const slotData = {
        ...req.body,
        startTime: typeof req.body.startTime === 'string' ? new Date(req.body.startTime) : req.body.startTime,
        endTime: typeof req.body.endTime === 'string' ? new Date(req.body.endTime) : req.body.endTime,
      };
      const slot = await storage.createSlot(slotData);
      res.status(201).json(slot);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create slot" });
    }
  });

  app.put("/api/slots/:id", async (req, res) => {
    // Judges cannot update slots
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot update slots" });
      return;
    }
    const slotData = {
      ...req.body,
      startTime: typeof req.body.startTime === 'string' ? new Date(req.body.startTime) : req.body.startTime,
      endTime: typeof req.body.endTime === 'string' ? new Date(req.body.endTime) : req.body.endTime,
    };
    const slot = await storage.updateSlot(Number(req.params.id), slotData);
    if (!slot) {
      res.status(404).json({ message: "Slot not found" });
      return;
    }
    res.json(slot);
  });

  app.delete("/api/slots/:id", async (req, res) => {
    // Judges cannot delete slots
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot delete slots" });
      return;
    }
    try {
      await storage.deleteSlot(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete slot" });
    }
  });

  // === Scores ===
  app.get(api.scores.list.path, async (req, res) => {
    // Judges must use the judge-scoped endpoint
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges must use /api/judge/events/:eventId/scores" });
      return;
    }
    const scores = await storage.getScores(Number(req.params.eventId));
    res.json(scores);
  });

  app.post(api.scores.create.path, async (req, res) => {
    if (!req.body.slotId) { res.status(400).json({ message: "Slot ID is required" }); return; }
    if (!req.body.scores || typeof req.body.scores !== "object") { res.status(400).json({ message: "Scores object is required" }); return; }

    try {
      const slot = await storage.getSlotById(req.body.slotId);
      if (!slot) { res.status(404).json({ message: "Slot not found" }); return; }

      // If judge is submitting, validate they are assigned to this slot
      const judgeId = req.isAuthenticated() && (req.user as any)?.role === "judge"
        ? (req.user as any).id
        : req.body.judgeId;

      if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
        if (!slot.judgeIds || !slot.judgeIds.includes(judgeId)) {
          res.status(403).json({ message: "You are not assigned to this slot" });
          return;
        }
      }

      // Check for duplicate score (same slot + same judge)
      const existingScores = await storage.getScores(slot.eventId);
      const duplicate = existingScores.find(
        (s) => s.slotId === req.body.slotId && s.judgeId === (req.body.judgeId || judgeId)
      );
      if (duplicate) {
        res.status(409).json({ message: "Score already submitted for this slot by this judge" });
        return;
      }

      // Validate scores against station rubric
      const stationsList = await storage.getStations(slot.eventId);
      const station = stationsList.find((s) => s.id === (req.body.stationId || slot.stationId));
      if (station?.rubric?.criteria) {
        const rubricCriteria = station.rubric.criteria as Array<{ name: string; maxPoints: number }>;
        const submittedScores = req.body.scores as Record<string, number>;

        for (const [criterion, value] of Object.entries(submittedScores)) {
          if (typeof value !== "number" || value < 0) {
            res.status(400).json({ message: `Score for "${criterion}" must be a non-negative number` });
            return;
          }
          const rubricItem = rubricCriteria.find((c) => c.name === criterion);
          if (!rubricItem) {
            res.status(400).json({ message: `Unknown criterion: "${criterion}". Valid criteria: ${rubricCriteria.map((c) => c.name).join(", ")}` });
            return;
          }
          if (value > rubricItem.maxPoints) {
            res.status(400).json({ message: `Score for "${criterion}" (${value}) exceeds maximum of ${rubricItem.maxPoints}` });
            return;
          }
        }
      }

      const score = await storage.createScore(req.body);
      res.status(201).json(score);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to submit score" });
    }
  });

  // === CSV Export ===
  app.get("/api/events/:eventId/export/teams", async (req, res) => {
    // Judges cannot export data
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot export data" });
      return;
    }
    const teams = await storage.getTeams(Number(req.params.eventId));
    const csv = ["name,schoolName,category,language"];
    teams.forEach(t => csv.push(`"${t.name}","${t.schoolName}","${t.category}","${t.language}"`));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=teams.csv");
    res.send(csv.join("\n"));
  });

  app.get("/api/events/:eventId/export/stations", async (req, res) => {
    // Judges cannot export data
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot export data" });
      return;
    }
    const stations = await storage.getStations(Number(req.params.eventId));
    const csv = ["name,rubric"];
    stations.forEach(s => csv.push(`"${s.name}","${JSON.stringify(s.rubric).replace(/"/g, '""')}"`));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=stations.csv");
    res.send(csv.join("\n"));
  });

  app.get("/api/events/:eventId/export/results", async (req, res) => {
    // Judges cannot export data
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot export data" });
      return;
    }
    const teams = await storage.getTeams(Number(req.params.eventId));
    const scores = await storage.getScores(Number(req.params.eventId));
    const stations = await storage.getStations(Number(req.params.eventId));
    
    // Calculate total scores per team
    const teamScores = new Map<number, number>();
    scores.forEach(score => {
      const scoreValues = score.scores as Record<string, number>;
      const total = Object.values(scoreValues).reduce((sum, val) => sum + val, 0);
      teamScores.set(score.teamId, (teamScores.get(score.teamId) || 0) + total);
    });

    const csv = ["rank,teamName,schoolName,category,language,totalScore"];
    const rankedTeams = teams
      .map(t => ({ ...t, calculatedScore: teamScores.get(t.id) || 0 }))
      .sort((a, b) => b.calculatedScore - a.calculatedScore);
    
    rankedTeams.forEach((t, i) => {
      csv.push(`${i + 1},"${t.name}","${t.schoolName}","${t.category}","${t.language}",${t.calculatedScore}`);
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv.join("\n"));
  });

  // === CSV Import ===
  app.post("/api/events/:eventId/import/teams", async (req, res) => {
    // Judges cannot import teams
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot import teams" });
      return;
    }
    const eventId = Number(req.params.eventId);
    const { data } = req.body; // Array of team objects
    const created = [];
    for (const row of data) {
      const team = await storage.createTeam({
        eventId,
        name: row.name,
        schoolName: row.schoolName,
        city: row.city || null,
        category: row.category,
        language: row.language,
      });
      created.push(team);
    }
    res.status(201).json({ imported: created.length, teams: created });
  });

  app.post("/api/events/:eventId/import/stations", async (req, res) => {
    // Judges cannot import stations
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot import stations" });
      return;
    }
    const eventId = Number(req.params.eventId);
    const { data } = req.body; // Array of station objects
    const created = [];
    for (const row of data) {
      const station = await storage.createStation({
        eventId,
        name: row.name,
        rubric: typeof row.rubric === 'string' ? JSON.parse(row.rubric) : row.rubric,
      });
      created.push(station);
    }
    res.status(201).json({ imported: created.length, stations: created });
  });

  app.post("/api/import/judges", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userRole = (req.user as any)?.role;
    if (userRole !== "admin" && userRole !== "manager") {
      res.status(403).json({ message: "Only admins and managers can import judges" });
      return;
    }
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ message: "No data provided" });
      return;
    }
    if (data.length > 100) {
      res.status(400).json({ message: "Maximum 100 judges per import" });
      return;
    }
    const inviterUser = req.user as any;
    const created = [];
    const errors = [];
    let emailsSent = 0;
    let emailsFailed = 0;
    for (const row of data) {
      try {
        if (!row.name || !row.username) {
          errors.push({ row, error: "Missing required fields: name and username" });
          continue;
        }
        const normalizedEmail = row.email ? String(row.email).toLowerCase().trim() : null;
        const existing = await storage.getUserByUsername(row.username);
        if (existing) {
          errors.push({ row, error: `Username "${row.username}" already exists` });
          continue;
        }
        const judge = await storage.createUser({
          username: row.username,
          password: row.password || "password",
          role: "judge",
          name: row.name,
          email: normalizedEmail,
          phone: row.phone || null,
          languages: row.languages && typeof row.languages === 'string' ? row.languages.split(";").map((l: string) => l.trim()) : ["English"],
          restrictions: row.restrictions || null,
        });
        created.push(judge);

        // If email was provided, also create authorized_email entry and send invitation
        if (normalizedEmail) {
          try {
            const existingAuth = await storage.getAuthorizedEmailByEmail(normalizedEmail);
            if (!existingAuth) {
              await storage.createAuthorizedEmail({
                email: normalizedEmail,
                role: "judge",
                name: row.name,
                createdBy: inviterUser.id,
              });
            }
            const result = await sendInvitationEmail({
              to: normalizedEmail,
              recipientName: row.name,
              role: "judge",
              inviterName: inviterUser.name,
            });
            if (result.ok) emailsSent++;
            else emailsFailed++;
          } catch (emailErr: any) {
            console.error(`[Import] Failed to send invitation to ${normalizedEmail}:`, emailErr);
            emailsFailed++;
          }
        }
      } catch (error: any) {
        errors.push({ row, error: error.message });
      }
    }
    res.status(201).json({
      imported: created.length,
      errors: errors.length,
      emailsSent,
      emailsFailed,
      judges: created,
      errorDetails: errors,
    });
  });

  // === AI Feedback Assistant ===
  app.post("/api/slots/:slotId/ai-session", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const judgeId = (req.user as any).id;
    const slotId = Number(req.params.slotId);

    // Get slot by ID directly
    const slot = await storage.getSlotById(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }
    if (!slot.judgeIds?.includes(judgeId)) {
      return res.status(403).json({ message: "You are not assigned to this slot" });
    }

    // Check if session exists, otherwise create
    let session = await storage.getAiSession(slotId, judgeId);
    if (!session) {
      session = await storage.createAiSession({
        slotId,
        judgeId,
        teamId: slot.teamId,
        stationId: slot.stationId,
      });
    }

    // Get existing messages
    const messages = await storage.getAiSessionMessages(session.id);
    res.json({ session, messages });
  });

  app.post("/api/ai-sessions/:sessionId/messages", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const judgeId = (req.user as any).id;
    const sessionId = Number(req.params.sessionId);
    const { content, keywords } = req.body;

    // Get session and verify ownership
    const session = await storage.getAiSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.judgeId !== judgeId) {
      return res.status(403).json({ message: "You do not have access to this session" });
    }

    const existingMessages = await storage.getAiSessionMessages(sessionId);
    
    // Save user message
    const userMessage = await storage.createAiMessage({
      sessionId,
      role: "user",
      content,
      metadata: keywords ? { keywords } : null,
    });

    // Get context for AI (station rubric, team info) from the session data
    const stationId = session.stationId;
    const teamId = session.teamId;

    // Get station and team info
    const slot = await storage.getSlotById(session.slotId);
    if (!slot) {
      return res.status(400).json({ message: "Slot not found" });
    }

    const stations = await storage.getStations(slot.eventId);
    const teams = await storage.getTeams(slot.eventId);

    const station = stations.find(s => s.id === stationId);
    const team = teams.find(t => t.id === teamId);
    const rubric = station?.rubric as any;

    // Build conversation history
    const conversationHistory = existingMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    conversationHistory.push({ role: "user", content });

    // Call OpenAI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const systemPrompt = `You are an AI assistant helping a judge score a team's performance at a Space Olympics competition.

Team: ${team?.name || "Unknown"} from ${team?.schoolName || "Unknown School"}
Category: ${team?.category || "Unknown"}
Station: ${station?.name || "Unknown Station"}
Rubric Criteria: ${JSON.stringify(rubric?.criteria || [], null, 2)}

Your role:
1. Help the judge articulate their observations into constructive feedback
2. Suggest scores based on the rubric criteria when the judge provides observations
3. Ensure feedback is encouraging and constructive for students
4. If the judge mentions keywords or observations, translate them into rubric-aligned scores
5. Keep responses concise and mobile-friendly

When suggesting scores, respond with JSON in this format at the end of your message:
{"suggestedScores": {"criterionName": score}, "keywords": ["keyword1"], "feedback": "constructive feedback summary"}

Always be encouraging and focus on growth areas rather than criticism.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
        max_completion_tokens: 500,
      });

      const aiResponseContent = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

      // Save assistant message
      const assistantMessage = await storage.createAiMessage({
        sessionId,
        role: "assistant",
        content: aiResponseContent,
      });

      // Try to parse suggested scores from the response
      let suggestedScores = null;
      let suggestedFeedback = null;
      let extractedKeywords: string[] = [];
      
      const jsonMatch = aiResponseContent.match(/\{[\s\S]*"suggestedScores"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestedScores = parsed.suggestedScores;
          suggestedFeedback = parsed.feedback;
          extractedKeywords = parsed.keywords || [];
          
          // Update session with suggestions
          await storage.updateAiSession(sessionId, {
            suggestedScores,
            suggestedFeedback,
            keywords: extractedKeywords,
          });
        } catch (e) {
          // JSON parsing failed, that's ok
        }
      }

      res.json({
        userMessage,
        assistantMessage,
        suggestedScores,
        suggestedFeedback,
        keywords: extractedKeywords,
      });
    } catch (error: any) {
      console.error("OpenAI error:", error);
      res.status(500).json({ message: "AI service error", error: error.message });
    }
  });

  app.post("/api/ai-sessions/:sessionId/apply", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const sessionId = Number(req.params.sessionId);
    const { slotId } = req.body;
    const judgeId = (req.user as any).id;

    // Get the session to retrieve suggested scores
    const session = await storage.getAiSession(slotId, judgeId);
    if (!session || session.id !== sessionId) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({
      suggestedScores: session.suggestedScores,
      suggestedFeedback: session.suggestedFeedback,
      keywords: session.keywords,
    });
  });

  // === Notifications ===
  app.post("/api/notifications/send", async (req, res) => {
    // Only admins/managers can send notifications
    if (req.isAuthenticated() && (req.user as any)?.role === "judge") {
      res.status(403).json({ message: "Judges cannot send notifications" });
      return;
    }
    const { judgeId, message } = req.body;
    const judge = await storage.getUser(judgeId);
    if (!judge) {
      return res.status(404).json({ message: "Judge not found" });
    }
    
    // Always store notification in database for in-app display
    const notification = await storage.createNotification({ judgeId, message });
    
    // Check for Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken || !fromNumber) {
      // Log the notification attempt (SMS not configured)
      console.log(`[Notification] SMS not configured. Would send to ${judge.phone}: "${message}"`);
      return res.json({ 
        success: true, 
        method: "in-app",
        message: "Notification saved (SMS not configured)",
        notification
      });
    }
    
    // If Twilio is configured, also send SMS
    if (!judge.phone) {
      return res.json({ 
        success: true, 
        method: "in-app",
        message: "Notification saved (no phone number for SMS)",
        notification
      });
    }
    
    try {
      const twilio = await import('twilio');
      const client = twilio.default(accountSid, authToken);
      await client.messages.create({
        body: message,
        from: fromNumber,
        to: judge.phone,
      });
      res.json({ success: true, method: "sms+in-app", message: "SMS sent and notification saved", notification });
    } catch (error: any) {
      console.error("Twilio error:", error);
      res.json({ success: true, method: "in-app", message: "Notification saved (SMS failed)", notification });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const judgeId = (req.user as any).id;
    const notificationsList = await storage.getNotifications(judgeId);
    res.json(notificationsList);
  });

  // Get all notifications (for managers/admins)
  app.get("/api/notifications/all", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const role = (req.user as any).role;
    if (role === "judge") {
      return res.status(403).json({ message: "Judges cannot access all notifications" });
    }
    const allNotifications = await storage.getAllNotifications();
    
    // Managers can only see notifications for judges in their events
    if (role === "manager") {
      const managerId = (req.user as any).id;
      const events = await storage.getEvents();
      const managerEvents = events.filter(e => e.managerId === managerId);
      const managerJudgeIds = new Set<number>();
      managerEvents.forEach(e => e.judgeIds?.forEach(id => managerJudgeIds.add(id)));
      const filtered = allNotifications.filter(n => managerJudgeIds.has(n.judgeId));
      res.json(filtered);
      return;
    }
    
    res.json(allNotifications);
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = (req.user as any).id;
    
    // Verify ownership before marking as read
    const notificationsList = await storage.getNotifications(userId);
    const notification = notificationsList.find(n => n.id === Number(req.params.id));
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    
    const updated = await storage.markNotificationRead(Number(req.params.id));
    res.json(updated);
  });

  // === Authorized Emails Management (for email-based role recognition) ===
  app.get("/api/authorized-emails", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const role = (req.user as any).role;
    // Only admins and managers can view authorized emails
    if (role !== "admin" && role !== "manager") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const emails = await storage.getAuthorizedEmails();
    // Managers can only see judges, admins can see all
    if (role === "manager") {
      res.json(emails.filter(e => e.role === "judge"));
    } else {
      res.json(emails);
    }
  });

  app.post("/api/authorized-emails", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const { email, role, name, eventIds } = req.body;

    // Validate role is one of allowed values
    const allowedRoles = ["admin", "manager", "judge"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ message: "Invalid role. Must be admin, manager, or judge" });
      return;
    }

    // Only admins and managers can access this endpoint
    if (userRole !== "admin" && userRole !== "manager") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Managers can only add judges - strict server-side enforcement
    if (userRole === "manager" && role !== "judge") {
      res.status(403).json({ message: "Managers can only add judges" });
      return;
    }

    // Validate eventIds - must be an array of numbers
    const normalizedEventIds: number[] = Array.isArray(eventIds)
      ? eventIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];

    // Check for date conflicts among selected events
    if (normalizedEventIds.length > 1) {
      const allEvents = await storage.getEvents();
      const conflicts = findEventConflicts(normalizedEventIds, allEvents);
      if (conflicts.length > 0) {
        res.status(400).json({
          message: formatConflictError(conflicts, allEvents),
          conflicts,
        });
        return;
      }
    }

    // Admin role cannot be scoped to specific events
    if (role === "admin" && normalizedEventIds.length > 0) {
      res.status(400).json({
        message: "Admins have access to all events - event assignment is not applicable",
      });
      return;
    }

    try {
      const authorizedEmail = await storage.createAuthorizedEmail({
        email: email.toLowerCase().trim(),
        role,
        name,
        eventIds: normalizedEventIds.length > 0 ? normalizedEventIds : null,
        createdBy: userId,
      });

      // Fetch event details for the email (if any events were assigned)
      const assignedEvents = normalizedEventIds.length > 0
        ? (await storage.getEvents()).filter(e => normalizedEventIds.includes(e.id))
        : [];

      // Fire-and-collect: send invitation email (don't fail the request if email fails)
      const inviter = req.user as any;
      const emailResult = await sendInvitationEmail({
        to: authorizedEmail.email,
        recipientName: name,
        role: role as "admin" | "manager" | "judge",
        inviterName: inviter?.name,
        events: assignedEvents.map(e => ({ name: e.name, date: e.date, location: e.location })),
      });

      res.status(201).json({ ...authorizedEmail, emailSent: emailResult.ok, emailError: emailResult.error });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to add authorized email" });
    }
  });

  app.post("/api/authorized-emails/:id/resend", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userRole = (req.user as any).role;
    if (userRole !== "admin" && userRole !== "manager") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const target = await storage.getAuthorizedEmailById(req.params.id);
    if (!target) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    if (userRole === "manager" && target.role !== "judge") {
      res.status(403).json({ message: "Managers can only resend judge invitations" });
      return;
    }

    const inviter = req.user as any;
    const assignedEvents = target.eventIds && target.eventIds.length > 0
      ? (await storage.getEvents()).filter(e => target.eventIds!.includes(e.id))
      : [];
    const result = await sendInvitationEmail({
      to: target.email,
      recipientName: target.name,
      role: target.role as "admin" | "manager" | "judge",
      inviterName: inviter?.name,
      events: assignedEvents.map(e => ({ name: e.name, date: e.date, location: e.location })),
    });

    if (result.ok) {
      res.json({ success: true, message: "Invitation resent" });
    } else {
      res.status(500).json({ success: false, message: result.error || "Failed to send invitation" });
    }
  });

  app.delete("/api/authorized-emails/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userRole = (req.user as any).role;
    
    // Get the email to check if manager is trying to delete non-judge
    const emailToDelete = await storage.getAuthorizedEmailById(req.params.id);
    if (!emailToDelete) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    
    if (userRole === "manager" && emailToDelete.role !== "judge") {
      res.status(403).json({ message: "Managers can only remove judges" });
      return;
    }
    if (userRole !== "admin" && userRole !== "manager") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    
    await storage.deleteAuthorizedEmail(req.params.id);
    res.status(204).send();
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  // Ensure admin user exists (even if events already exist)
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    await storage.createUser({
      username: "admin",
      password: "password",
      role: "admin",
      name: "System Admin",
      languages: ["English"],
    });
  }

  // Ensure manager user exists (even if events already exist)
  const existingManager = await storage.getUserByUsername("manager");
  if (!existingManager) {
    await storage.createUser({
      username: "manager",
      password: "password",
      role: "manager",
      name: "Event Manager",
      languages: ["English"],
    });
  }

  const events = await storage.getEvents();
  if (events.length === 0) {
    // Create Users (only if they don't exist)
    const admin = await storage.getUserByUsername("admin") || await storage.createUser({
      username: "admin",
      password: "password",
      role: "admin",
      name: "System Admin",
      languages: ["English"],
    });

    const manager = await storage.getUserByUsername("manager") || await storage.createUser({
      username: "manager",
      password: "password",
      role: "manager",
      name: "Event Manager",
      languages: ["English"],
    });

    const judge = await storage.getUserByUsername("judge1") || await storage.createUser({
      username: "judge1",
      password: "password",
      role: "judge",
      name: "Judge Dredd",
      languages: ["English"],
    });

    const judge2 = await storage.getUserByUsername("judge2") || await storage.createUser({
      username: "judge2",
      password: "password",
      role: "judge",
      name: "Judge Smith",
      languages: ["English"],
    });

    const judge3 = await storage.getUserByUsername("judge3") || await storage.createUser({
      username: "judge3",
      password: "password",
      role: "judge",
      name: "Judge Johnson",
      languages: ["English"],
    });

    // Create Event (assign to manager with judges)
    const event = await storage.createEvent({
      name: "Space Olympics 2025",
      date: new Date(),
      location: "Mars Base Alpha",
      managerId: manager.id,
      judgeIds: [judge.id, judge2.id, judge3.id],
    });

    // Create Stations
    const station1 = await storage.createStation({
      eventId: event.id,
      name: "Rover Navigation",
      rubric: {
        criteria: [
          { name: "Speed", maxPoints: 10 },
          { name: "Accuracy", maxPoints: 10 },
          { name: "Innovation", maxPoints: 5 },
        ]
      },
    });

    const station2 = await storage.createStation({
      eventId: event.id,
      name: "Zero-G Repair",
      rubric: {
        criteria: [
          { name: "Technique", maxPoints: 15 },
          { name: "Safety", maxPoints: 10 },
        ]
      },
    });

    // Create Teams
    const team1 = await storage.createTeam({
      eventId: event.id,
      name: "Apollo Juniors",
      schoolName: "Armstrong Elementary",
      category: "ElementarySchool",
      language: "English",
    });

    const team2 = await storage.createTeam({
      eventId: event.id,
      name: "Curiosity Rovers",
      schoolName: "Gagarin Middle School",
      category: "MiddleSchool",
      language: "English",
    });

    // Create Schedule Slots
    // Slot 1: Team 1 at Station 1 with Judge 1
    await storage.createSlot({
      eventId: event.id,
      stationId: station1.id,
      teamId: team1.id,
      startTime: new Date(Date.now() + 1000 * 60 * 60), // In 1 hour
      endTime: new Date(Date.now() + 1000 * 60 * 90),   // 30 mins later
      judgeIds: [judge.id],
      captainJudgeId: judge.id,
    });

     // Slot 2: Team 2 at Station 1 (Behind schedule example - status is computed)
    await storage.createSlot({
      eventId: event.id,
      stationId: station1.id,
      teamId: team2.id,
      startTime: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      endTime: new Date(Date.now() - 1000 * 60 * 30),   // 30 mins ago
      judgeIds: [judge.id],
      captainJudgeId: judge.id,
    });
  }
}
