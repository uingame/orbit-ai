import { useEvents } from "@/hooks/use-events";
import { useScores } from "@/hooks/use-scores";
import { useTeams } from "@/hooks/use-teams";
import { useStations } from "@/hooks/use-stations";
import { useSlots } from "@/hooks/use-slots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Plus, ArrowRight, Activity, Calendar, Bell, MessageSquare, Send, User, Loader2, Phone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAdminEvent } from "@/contexts/admin-event-context";
import { motion } from "framer-motion";
import { ScoringMatrix } from "@/components/scoring-matrix";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType, ScheduleSlot, Station } from "@shared/schema";

export default function AdminDashboard() {
  const { data: events, isLoading } = useEvents();
  const { selectedEventId, setSelectedEventId } = useAdminEvent();

  // Auto-select the first active event on first load if nothing is selected yet
  useEffect(() => {
    if (!events || events.length === 0) return;
    if (selectedEventId && events.some(e => e.id === selectedEventId)) return;
    const firstActive = events.find(e => e.isActive);
    const firstAvailable = firstActive || events[0];
    if (firstAvailable) {
      setSelectedEventId(firstAvailable.id);
    }
  }, [events, selectedEventId, setSelectedEventId]);

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading mission control...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Mission Control</h1>
          <p className="text-muted-foreground">Welcome back, Commander. System status: Optimal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/judges">
            <Button variant="outline" className="shadow-lg">
              <User className="mr-2 h-4 w-4" /> Manage Judges
            </Button>
          </Link>
          <Link href="/admin/events">
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Calendar className="mr-2 h-4 w-4" /> Manage Events
            </Button>
          </Link>
        </div>
      </div>

      {/* Event selector - drives all admin tabs */}
      <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <Calendar className="h-4 w-4" />
              Active Event:
            </div>
            <Select
              value={selectedEventId?.toString() || ""}
              onValueChange={(v) => setSelectedEventId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full sm:w-80" data-testid="select-admin-event">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {(events || []).length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No events available</div>
                ) : (
                  (events || []).map(event => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name} {event.isActive ? "" : "(inactive)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <p className="text-xs text-muted-foreground sm:ml-auto">
                This selection applies across all admin tabs.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedEvent ? (
        <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold">No Event Selected</h3>
            <p className="text-muted-foreground max-w-sm">
              {(events || []).length === 0
                ? "There are no events yet. Create your first event to get started."
                : "Choose an event from the selector above to see live stats."}
            </p>
            {(events || []).length === 0 && (
              <Link href="/admin/events">
                <Button variant="outline">Go to Events</Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <LiveEventMonitor eventId={selectedEvent.id} eventName={selectedEvent.name} />
      )}
    </div>
  );
}

function LiveEventMonitor({ eventId, eventName }: { eventId: number, eventName: string }) {
  const { data: scores } = useScores(eventId);
  const { data: teams } = useTeams(eventId);
  const { data: stations } = useStations(eventId);
  const { data: slots } = useSlots(eventId);

  // Fetch all judges with their event assignments
  const { data: allJudges = [] } = useQuery({
    queryKey: ["/api/judges-with-events"],
    queryFn: async () => {
      const res = await fetch("/api/judges-with-events");
      if (!res.ok) throw new Error("Failed to fetch judges");
      return res.json();
    },
  });

  const teamList = teams || [];
  const stationList = stations || [];
  const scoreList = scores || [];
  const slotList = slots || [];

  // Calculate stats
  const totalSlots = slotList.length;
  const completedSlots = scoreList.length;
  const progress = totalSlots > 0 ? (completedSlots / totalSlots) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Overall Progress" 
          value={`${Math.round(progress)}%`}
          subtitle={`${completedSlots}/${totalSlots} evaluations`}
          color="text-primary"
        />
        <StatCard 
          title="Active Teams" 
          value={teamList.length.toString()}
          subtitle="Competing now"
          color="text-secondary"
        />
        <StatCard 
          title="Stations Online" 
          value={stationList.length.toString()}
          subtitle="Reporting scores"
          color="text-accent"
        />
      </div>

      {/* Full Scoring Progress Matrix with Team/Station/Judge views */}
      <ScoringMatrix
        teams={teamList}
        stations={stationList}
        slots={slotList}
        scores={scoreList}
        judges={allJudges}
      />

      {/* Judge Notifications Panel */}
      <JudgeNotificationsPanel 
        judges={allJudges}
        slots={slotList}
        stations={stationList}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: { title: string, value: string, subtitle: string, color: string }) {
  return (
    <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <h2 className={`text-4xl font-bold mb-1 font-display ${color}`}>{value}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function JudgeNotificationsPanel({ 
  judges, 
  slots, 
  stations 
}: { 
  judges: UserType[]; 
  slots: ScheduleSlot[]; 
  stations: Station[];
}) {
  const { toast } = useToast();
  const [selectedJudge, setSelectedJudge] = useState<UserType | null>(null);
  const [message, setMessage] = useState("Ensure your scores are up to date");
  const [dialogOpen, setDialogOpen] = useState(false);

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ judgeId, message }: { judgeId: number; message: string }) => {
      return apiRequest("POST", `/api/notifications/send`, { judgeId, message });
    },
    onSuccess: () => {
      toast({ title: "Notification Sent", description: `Message sent to ${selectedJudge?.username}` });
      setDialogOpen(false);
      setMessage("Ensure your scores are up to date");
    },
    onError: () => {
      toast({ title: "Notification Failed", description: "Could not send notification. SMS not configured.", variant: "destructive" });
    },
  });

  const getLastSlotForJudge = (judgeId: number) => {
    const judgeSlots = slots.filter(s => s.judgeIds?.includes(judgeId) || s.captainJudgeId === judgeId);
    if (judgeSlots.length === 0) return null;
    return judgeSlots.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )[0];
  };

  const getStationName = (stationId: number) => {
    return stations.find(s => s.id === stationId)?.name || "Unknown Station";
  };

  const activeJudges = judges.filter(j => j.role === "judge");

  const handleNotify = (judge: UserType) => {
    setSelectedJudge(judge);
    setMessage("Ensure your scores are up to date");
    setDialogOpen(true);
  };

  const handleSend = () => {
    if (selectedJudge) {
      sendNotificationMutation.mutate({ judgeId: selectedJudge.id, message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Active Judges & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeJudges.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No active judges found</p>
        ) : (
          <Table>
            <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
              <TableRow>
                <TableHead>Judge</TableHead>
                <TableHead className="hidden md:table-cell">Events</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Last Station</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeJudges.map(judge => {
                const lastSlot = getLastSlotForJudge(judge.id);
                const assignedEvents: { id: number; name: string }[] = (judge as any).assignedEvents || [];
                return (
                  <TableRow key={judge.id} data-testid={`judge-notification-row-${judge.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          {judge.username}
                          <div className="sm:hidden text-xs text-muted-foreground font-normal">
                            {judge.phone || "No phone"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {assignedEvents.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedEvents.slice(0, 2).map((event) => (
                            <Badge key={event.id} variant="outline" className="text-xs bg-blue-500/5 border-blue-500/20 text-blue-500">
                              {event.name}
                            </Badge>
                          ))}
                          {assignedEvents.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{assignedEvents.length - 2}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {judge.phone ? (
                        <span className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {judge.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">No phone</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {lastSlot ? (
                        <Badge variant="outline" className="text-xs">{getStationName(lastSlot.stationId)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {lastSlot
                        ? new Date(lastSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={dialogOpen && selectedJudge?.id === judge.id} onOpenChange={(open) => {
                        if (!open) setDialogOpen(false);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNotify(judge)}
                            data-testid={`button-notify-judge-${judge.id}`}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" /> Notify
                          </Button>
                        </DialogTrigger>
                        <DialogContent aria-describedby={undefined}>
                          <DialogHeader>
                            <DialogTitle>Send Notification to {judge.username}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <Label>Phone Number</Label>
                              <Input value={judge.phone || "Not set"} disabled className="bg-muted" />
                            </div>
                            <div>
                              <Label>Message</Label>
                              <Input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter your message"
                                data-testid="input-notification-message"
                              />
                            </div>
                            <Button
                              onClick={handleSend}
                              disabled={!message.trim() || sendNotificationMutation.isPending}
                              className="w-full"
                              data-testid="button-send-notification"
                            >
                              {sendNotificationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                              {sendNotificationMutation.isPending ? "Sending..." : "Send Notification"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
