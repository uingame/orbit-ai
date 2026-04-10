import { useState, useMemo } from "react";
import { useEvents } from "@/hooks/use-events";
import { useScores } from "@/hooks/use-scores";
import { useTeams } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalAdminEvent } from "@/contexts/admin-event-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Lock, Search, ArrowUpDown, Download, Calendar } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { Link, Redirect } from "wouter";

type SortColumn = "name" | "school" | "city" | "country" | "language" | "score";
type SortOrder = "asc" | "desc";

export default function Leaderboard() {
  const { user } = useAuth();
  const { data: events } = useEvents();
  const adminEventContext = useOptionalAdminEvent();
  const isAdmin = user?.role === "admin";

  // Judges cannot access the leaderboard
  if (user?.role === "judge") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Lock className="w-24 h-24 text-muted mb-6" />
        <h1 className="text-4xl font-bold font-display mb-4">Access Restricted</h1>
        <p className="text-muted-foreground text-lg">The leaderboard is not available for judges.</p>
        <p className="text-muted-foreground">Please use the Results page to view your assigned teams.</p>
      </div>
    );
  }

  // Admin: use the shared context. Others: auto-pick first active event.
  const selectedEvent =
    isAdmin && adminEventContext?.selectedEventId
      ? events?.find(e => e.id === adminEventContext.selectedEventId)
      : events?.find(e => e.isActive);

  if (!selectedEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Trophy className="w-24 h-24 text-muted mb-6" />
        <h1 className="text-4xl font-bold font-display mb-4">Leaderboard Offline</h1>
        <p className="text-muted-foreground text-lg mb-6">
          {isAdmin
            ? "Choose an event from the Dashboard to see its leaderboard."
            : "Results will appear here when an event is live."}
        </p>
        {isAdmin && (
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" /> Go to Dashboard
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4 animate-in fade-in duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-4">
          {selectedEvent.name}
        </h1>
        <p className="text-xl text-muted-foreground">Live Results</p>
      </div>

      <LeaderboardContent eventId={selectedEvent.id} />
    </div>
  );
}

function LeaderboardContent({ eventId }: { eventId: number }) {
  const { data: teams } = useTeams(eventId);
  const { data: scores } = useScores(eventId);

  if (!teams || !scores) return <div className="text-center">Loading rankings...</div>;

  // Calculate total scores
  const teamScores = teams.map(team => {
    const teamScores = scores.filter(s => s.teamId === team.id);
    const totalPoints = teamScores.reduce((acc, curr) => {
      // Sum values of the scores json object
      const points = Object.values(curr.scores as Record<string, number>).reduce((a, b) => a + b, 0);
      return acc + points;
    }, 0);
    
    return { ...team, totalPoints };
  });

  const elementaryTeams = teamScores
    .filter(t => t.category === "ElementarySchool")
    .sort((a, b) => b.totalPoints - a.totalPoints);
    
  const middleTeams = teamScores
    .filter(t => t.category === "MiddleSchool")
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Tabs defaultValue="elementary" className="space-y-8">
      <div className="flex justify-center">
        <TabsList className="bg-white/5 p-1 rounded-full border border-white/10">
          <TabsTrigger value="elementary" className="rounded-full px-8 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Elementary School
          </TabsTrigger>
          <TabsTrigger value="middle" className="rounded-full px-8 py-2 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
            Middle School
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="elementary">
        <RankingList teams={elementaryTeams} />
      </TabsContent>
      
      <TabsContent value="middle">
        <RankingList teams={middleTeams} />
      </TabsContent>
    </Tabs>
  );
}

function RankingList({ teams }: { teams: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder(column === "score" ? "desc" : "asc");
    }
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortColumn === column && (
          <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} />
        )}
      </div>
    </TableHead>
  );

  const filteredAndSortedTeams = useMemo(() => {
    let filtered = teams.filter(
      (team) =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.country || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.language.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === "score") {
        aVal = a.totalPoints;
        bVal = b.totalPoints;
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [teams, searchTerm, sortColumn, sortOrder]);

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Teams ({filteredAndSortedTeams.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV("leaderboard.csv", ["Rank", "Team", "School", "City", "Country", "Language", "Score"], filteredAndSortedTeams.map((team) => {
                  const rank = teams.indexOf(team) + 1;
                  return [
                    String(rank),
                    team.name,
                    team.schoolName || "",
                    team.city || "",
                    team.country || "",
                    team.language || "",
                    String(team.totalPoints),
                  ];
                }))
              }
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, school, city, country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No teams registered in this category yet.</p>
          </div>
        ) : filteredAndSortedTeams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No teams match your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <SortHeader column="name" label="Team Name" />
                  <SortHeader column="school" label="School" />
                  <SortHeader column="city" label="City" />
                  <SortHeader column="country" label="Country" />
                  <SortHeader column="language" label="Language" />
                  <SortHeader column="score" label="Score" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTeams.map((team, idx) => {
                  const rank = teams.indexOf(team) + 1;
                  return (
                    <TableRow
                      key={team.id}
                      className="animate-in fade-in duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="text-center font-bold">
                        <div className={`
                          inline-flex w-8 h-8 rounded-full items-center justify-center font-bold text-sm
                          ${rank === 1 ? 'bg-yellow-500 text-black' : 
                            rank === 2 ? 'bg-slate-300 text-black' :
                            rank === 3 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}
                        `}>
                          {rank}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-muted-foreground">{team.schoolName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{team.city || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{team.country || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{team.language}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-lg text-primary">{team.totalPoints}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
