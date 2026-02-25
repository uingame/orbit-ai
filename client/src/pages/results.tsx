import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Award, Download, Filter, FileText, Printer, Search, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Event, Team, Score, Station } from "@shared/schema";

type SortColumn = "rank" | "name" | "school" | "score";
type SortOrder = "asc" | "desc";

export default function ResultsPage() {
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rankingSearchTerm, setRankingSearchTerm] = useState("");
  const [rankingSortColumn, setRankingSortColumn] = useState<SortColumn>("rank");
  const [rankingSortOrder, setRankingSortOrder] = useState<SortOrder>("asc");

  const isJudge = user?.role === "judge";

  // For judges, use judge-scoped events; for others, use all events
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: isJudge ? ["/api/judge/events"] : ["/api/events"],
    queryFn: async () => {
      const url = isJudge ? "/api/judge/events" : "/api/events";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  // Auto-select first event when events load
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // For judges, use judge-scoped teams; for others, use all teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: isJudge 
      ? ["/api/judge/events", selectedEventId, "teams"] 
      : ["/api/events", selectedEventId, "teams"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const url = isJudge 
        ? `/api/judge/events/${selectedEventId}/teams` 
        : `/api/events/${selectedEventId}/teams`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  // For judges, use judge-scoped scores; for others, use all scores
  const { data: scores = [] } = useQuery<Score[]>({
    queryKey: isJudge 
      ? ["/api/judge/events", selectedEventId, "scores"] 
      : ["/api/events", selectedEventId, "scores"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const url = isJudge 
        ? `/api/judge/events/${selectedEventId}/scores` 
        : `/api/events/${selectedEventId}/scores`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ["/api/events", selectedEventId, "stations"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/stations`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  // Calculate team scores
  const teamScores = new Map<number, number>();
  scores.forEach(score => {
    const scoreValues = score.scores as Record<string, number>;
    const total = Object.values(scoreValues).reduce((sum, val) => sum + val, 0);
    teamScores.set(score.teamId, (teamScores.get(score.teamId) || 0) + total);
  });

  // Filter and rank teams
  const filteredTeams = teams.filter(t => categoryFilter === "all" || t.category === categoryFilter);
  const rankedTeams = filteredTeams
    .map(t => ({ ...t, calculatedScore: teamScores.get(t.id) || 0 }))
    .sort((a, b) => b.calculatedScore - a.calculatedScore);

  // Get unique categories
  const categories = Array.from(new Set(teams.map(t => t.category)));

  // Calculate station winners (best score per station)
  const stationWinners = stations.map(station => {
    const stationScores = scores.filter(s => s.stationId === station.id);
    const teamTotals = new Map<number, number>();
    stationScores.forEach(score => {
      const scoreValues = score.scores as Record<string, number>;
      const total = Object.values(scoreValues).reduce((sum, val) => sum + val, 0);
      teamTotals.set(score.teamId, (teamTotals.get(score.teamId) || 0) + total);
    });
    
    let bestTeamId = 0;
    let bestScore = 0;
    teamTotals.forEach((score, teamId) => {
      if (score > bestScore) {
        bestScore = score;
        bestTeamId = teamId;
      }
    });
    
    const winnerTeam = teams.find(t => t.id === bestTeamId);
    return { station, winnerTeam, bestScore };
  });

  const handleExportResults = () => {
    if (selectedEventId) {
      window.open(`/api/events/${selectedEventId}/export/results`, "_blank");
    }
  };

  const handlePrintPDF = () => {
    const selectedEvent = events.find(e => e.id === selectedEventId);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const categoryLabel = categoryFilter === "all" ? "All Categories" : categoryFilter;
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedEvent?.name || "Competition"} Results</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1a1a2e; border-bottom: 2px solid #4a4e69; padding-bottom: 10px; }
            h2 { color: #22223b; margin-top: 30px; }
            .info { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .rank-1 { background-color: #fef9c3; }
            .rank-2 { background-color: #f1f5f9; }
            .rank-3 { background-color: #fed7aa; }
            .prize { font-weight: bold; color: #b45309; }
            .station-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }
            .station-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${selectedEvent?.name || "Competition"} - Official Results</h1>
          <p class="info">Category: ${categoryLabel} | Generated: ${new Date().toLocaleDateString()}</p>
          
          <h2>Overall Rankings</h2>
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>School</th><th>Category</th><th>Score</th><th>Prize</th></tr>
            </thead>
            <tbody>
              ${rankedTeams.map((team, i) => `
                <tr class="${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}">
                  <td>${i + 1}</td>
                  <td>${team.name}</td>
                  <td>${team.schoolName}</td>
                  <td>${team.category}</td>
                  <td>${team.calculatedScore}</td>
                  <td class="prize">${i === 0 ? '1st Place' : i === 1 ? '2nd Place' : i === 2 ? '3rd Place' : ''}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <h2>Station Awards</h2>
          <table>
            <thead>
              <tr><th>Station</th><th>Winner</th><th>Score</th></tr>
            </thead>
            <tbody>
              ${stationWinners.map(({ station, winnerTeam, bestScore }) => `
                <tr>
                  <td>${station.name}</td>
                  <td>${winnerTeam?.name || "No scores yet"}</td>
                  <td>${winnerTeam ? bestScore + " pts" : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const getPrizeIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-slate-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return null;
  };

  const getPrizeBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">1st Place</Badge>;
    if (rank === 2) return <Badge className="bg-slate-400/20 text-slate-300 border-slate-400/30">2nd Place</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600/20 text-amber-500 border-amber-600/30">3rd Place</Badge>;
    return null;
  };

  const handleRankingSort = (column: SortColumn) => {
    if (rankingSortColumn === column) {
      setRankingSortOrder(rankingSortOrder === "asc" ? "desc" : "asc");
    } else {
      setRankingSortColumn(column);
      setRankingSortOrder("asc");
    }
  };

  const RankingSortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleRankingSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {rankingSortColumn === column && (
          <ArrowUpDown className={`h-4 w-4 transition-transform ${rankingSortOrder === "desc" ? "rotate-180" : ""}`} />
        )}
      </div>
    </TableHead>
  );

  const filteredAndSortedRankings = useMemo(() => {
    let filtered = rankedTeams.filter(
      (team) =>
        team.name.toLowerCase().includes(rankingSearchTerm.toLowerCase()) ||
        team.schoolName.toLowerCase().includes(rankingSearchTerm.toLowerCase()) ||
        team.category.toLowerCase().includes(rankingSearchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (rankingSortColumn === "rank") {
        // Rank order determined by array index
        aVal = rankedTeams.indexOf(a);
        bVal = rankedTeams.indexOf(b);
      } else if (rankingSortColumn === "score") {
        aVal = a.calculatedScore;
        bVal = b.calculatedScore;
      } else if (rankingSortColumn === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (rankingSortColumn === "school") {
        aVal = a.schoolName.toLowerCase();
        bVal = b.schoolName.toLowerCase();
      }

      if (aVal < bVal) return rankingSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return rankingSortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [rankedTeams, rankingSearchTerm, rankingSortColumn, rankingSortOrder]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Competition Results</h1>
          <p className="text-muted-foreground">View winners and export results</p>
        </div>
        {selectedEventId && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportResults} data-testid="button-export-results-csv">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={handlePrintPDF} data-testid="button-export-results-pdf">
              <FileText className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Event and Category Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-64">
            <Select
              value={selectedEventId?.toString() || ""}
              onValueChange={(val) => setSelectedEventId(Number(val))}
            >
              <SelectTrigger data-testid="select-event">
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEventId && categories.length > 0 && (
            <div className="w-64">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Trophy className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-bold">Select an Event</h3>
            <p className="text-muted-foreground">Choose an event to view the competition results</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Overall Winners */}
          <Card className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Overall Rankings {categoryFilter !== "all" && `- ${categoryFilter}`}
                </CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search teams or schools..."
                    value={rankingSearchTerm}
                    onChange={(e) => setRankingSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rankedTeams.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No results yet</p>
              ) : filteredAndSortedRankings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No teams match your search</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <RankingSortHeader column="rank" label="Rank" />
                        <RankingSortHeader column="name" label="Team" />
                        <RankingSortHeader column="school" label="School" />
                        <TableHead>Category</TableHead>
                        <TableHead>Language</TableHead>
                        <RankingSortHeader column="score" label="Score" />
                        <TableHead>Prize</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedRankings.map((team, displayIndex) => {
                        const actualIndex = rankedTeams.indexOf(team);
                        return (
                          <TableRow
                            key={team.id}
                            data-testid={`result-row-${team.id}`}
                            className="animate-in fade-in duration-300"
                            style={{ animationDelay: `${displayIndex * 50}ms` }}
                          >
                            <TableCell className="font-bold">
                              <div className="flex items-center gap-2">
                                {actualIndex < 3 && getPrizeIcon(actualIndex + 1)}
                                <span className={actualIndex < 3 ? "text-lg" : ""}>{actualIndex + 1}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{team.name}</TableCell>
                            <TableCell className="text-muted-foreground">{team.schoolName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{team.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{team.language}</Badge>
                            </TableCell>
                            <TableCell className="font-bold text-lg">{team.calculatedScore}</TableCell>
                            <TableCell>
                              {getPrizeBadge(actualIndex + 1)}
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

          {/* Station Winners */}
          {stationWinners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Station Awards
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Winner</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stationWinners.map(({ station, winnerTeam, bestScore }) => (
                      <TableRow key={station.id} data-testid={`station-winner-${station.id}`}>
                        <TableCell className="font-semibold">{station.name}</TableCell>
                        <TableCell>
                          {winnerTeam ? (
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                              <span className="text-sm">{winnerTeam.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No scores yet</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {winnerTeam ? (
                            <Badge variant="outline" className="text-xs">{bestScore} pts</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
