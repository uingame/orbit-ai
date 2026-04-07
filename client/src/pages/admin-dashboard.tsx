import { useEvents } from "@/hooks/use-events";
import { useScores } from "@/hooks/use-scores";
import { useTeams } from "@/hooks/use-teams";
import { useStations } from "@/hooks/use-stations";
import { useSlots } from "@/hooks/use-slots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Plus, ArrowRight, Activity, Calendar, Bell, MessageSquare, Send, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
  // We'll just monitor the first active event for the dashboard summary
  const activeEvent = events?.find(e => e.isActive);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading mission control...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Mission Control</h1>
          <p className="text-muted-foreground">Welcome back, Commander. System status: Optimal.</p>
        </div>
        <div className="flex gap-2">
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

      {!activeEvent ? (
        <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold">No Active Events</h3>
            <p className="text-muted-foreground max-w-sm">
              There are no events currently marked as active. Create a new event or activate an existing one to see live stats.
            </p>
            <Link href="/admin/events">
              <Button variant="outline">Go to Events</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <LiveEventMonitor eventId={activeEvent.id} eventName={activeEvent.name} />
      )}
    </div>
  );
}

function LiveEventMonitor({ eventId, eventName }: { eventId: number, eventName: string }) {
  const { data: scores } = useScores(eventId);
  const { data: teams } = useTeams(eventId);
  const { data: stations } = useStations(eventId);
  const { data: slots } = useSlots(eventId);

  // Fetch all judges for the scoring matrix
  const { data: allJudges = [] } = useQuery({
    queryKey: ["/api/judges"],
    queryFn: async () => {
      const res = await fetch("/api/judges");
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
          <div className="space-y-3">
            {activeJudges.map(judge => {
              const lastSlot = getLastSlotForJudge(judge.id);
              return (
                <div
                  key={judge.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                  data-testid={`judge-notification-row-${judge.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{judge.username}</h4>
                      <p className="text-sm text-muted-foreground">
                        {judge.phone || "No phone"}
                      </p>
                      {lastSlot && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Last: {getStationName(lastSlot.stationId)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(lastSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
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
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
