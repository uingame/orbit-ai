import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Setup from "@/pages/setup";
import AdminDashboard from "@/pages/admin-dashboard";
import JudgeDashboard from "@/pages/judge-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import ManagerManage from "@/pages/manager-manage";
import ManagerTeamTracking from "@/pages/manager-team-tracking";
import ManagerJudgeTracking from "@/pages/manager-judge-tracking";
import ManagerMessages from "@/pages/manager-messages";
import Leaderboard from "@/pages/leaderboard";
import AdminEventManagement from "@/pages/admin-event-management";
import AdminAuthorizedEmails from "@/pages/admin-authorized-emails";
import AdminJudges from "@/pages/admin-judges";
import AdminManagers from "@/pages/admin-managers";
import ResultsPage from "@/pages/results";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ component: Component, role }: { component: React.ComponentType, role?: 'admin' | 'judge' | 'manager' }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) return <Redirect to="/login" />;

  if (role && user.role !== role) {
    if (user.role === 'admin') return <Redirect to="/admin/dashboard" />;
    if (user.role === 'manager') return <Redirect to="/manager/dashboard" />;
    return <Redirect to="/judge/dashboard" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/setup" component={Setup} />

      <Route path="/admin/dashboard">
        {() => <ProtectedRoute component={AdminDashboard} role="admin" />}
      </Route>
      
      <Route path="/admin/events">
        {() => <ProtectedRoute component={AdminEventManagement} role="admin" />}
      </Route>
      
      <Route path="/admin/authorized-emails">
        {() => <ProtectedRoute component={AdminAuthorizedEmails} />}
      </Route>

      <Route path="/admin/judges">
        {() => <ProtectedRoute component={AdminJudges} role="admin" />}
      </Route>

      <Route path="/admin/managers">
        {() => <ProtectedRoute component={AdminManagers} role="admin" />}
      </Route>
      
      <Route path="/results">
        {() => <ProtectedRoute component={ResultsPage} />}
      </Route>

      <Route path="/manager/dashboard">
        {() => <ProtectedRoute component={ManagerDashboard} role="manager" />}
      </Route>
      
      <Route path="/manager/manage">
        {() => <ProtectedRoute component={ManagerManage} role="manager" />}
      </Route>

      <Route path="/manager/judges">
        {() => <Redirect to="/manager/manage" />}
      </Route>
      
      <Route path="/manager/assignments">
        {() => <Redirect to="/manager/manage" />}
      </Route>
      
      <Route path="/manager/team-tracking">
        {() => <Redirect to="/manager/manage" />}
      </Route>
      
      <Route path="/manager/judge-tracking">
        {() => <ProtectedRoute component={ManagerJudgeTracking} role="manager" />}
      </Route>
      
      <Route path="/manager/messages">
        {() => <ProtectedRoute component={ManagerMessages} role="manager" />}
      </Route>
      
      <Route path="/judge/dashboard">
        {() => <ProtectedRoute component={JudgeDashboard} role="judge" />}
      </Route>

      <Route path="/leaderboard">
        <Layout>
          <Leaderboard />
        </Layout>
      </Route>

      <Route path="/">
        {() => <Redirect to="/login" />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
