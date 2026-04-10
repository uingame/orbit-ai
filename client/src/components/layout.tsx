import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Calendar, Rocket, BarChart3, Menu, Users, ClipboardList, MessageSquare, Target, Mail } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { ManagerEventProvider } from "@/contexts/manager-event-context";
import { AdminEventProvider } from "@/contexts/admin-event-context";
import { StarsBackground } from "@/components/stars-background";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return <>{children}</>;

  const getDashboardLink = () => {
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'manager') return '/manager/dashboard';
    return '/judge/dashboard';
  };

  const NavLinks = () => (
    <>
      <Link href={getDashboardLink()}>
        <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('dashboard') ? 'text-primary' : 'text-muted-foreground'}`}>
          Dashboard
        </span>
      </Link>
      {user.role === 'admin' && (
        <>
          <Link href="/admin/events">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('events') ? 'text-primary' : 'text-muted-foreground'}`}>
              Events
            </span>
          </Link>
          <Link href="/admin/authorized-emails">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('authorized-emails') ? 'text-primary' : 'text-muted-foreground'}`}>
              Users
            </span>
          </Link>
        </>
      )}
      {user.role === 'manager' && (
        <>
          <Link href="/manager/manage">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.startsWith('/manager/manage') || location === '/manager/judges' || location === '/manager/assignments' || location === '/manager/team-tracking' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="link-manage">
              Manage
            </span>
          </Link>
          <Link href="/admin/authorized-emails">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('authorized-emails') ? 'text-primary' : 'text-muted-foreground'}`}>
              Invite
            </span>
          </Link>
          <Link href="/manager/judge-tracking">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location === '/manager/judge-tracking' ? 'text-primary' : 'text-muted-foreground'}`}>
              Progress
            </span>
          </Link>
          <Link href="/manager/messages">
            <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location === '/manager/messages' ? 'text-primary' : 'text-muted-foreground'}`}>
              Messages
            </span>
          </Link>
        </>
      )}
      {/* Leaderboard only visible to admin and manager, not judges */}
      {user.role !== 'judge' && (
        <Link href="/leaderboard">
          <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('leaderboard') ? 'text-primary' : 'text-muted-foreground'}`}>
            Leaderboard
          </span>
        </Link>
      )}
      <Link href="/results">
        <span className={`cursor-pointer font-medium transition-colors hover:text-primary ${location.includes('results') ? 'text-primary' : 'text-muted-foreground'}`}>
          Results
        </span>
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <StarsBackground />
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50" style={{ boxShadow: '0 1px 20px rgba(0, 170, 255, 0.08)' }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="text-xl font-bold font-display tracking-wider cursor-pointer flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                  <Rocket size={16} />
                </span>
                <span className="text-gradient">Orbit AI</span>
              </span>
            </Link>
            
            <nav className="hidden md:flex gap-6">
              <NavLinks />
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] bg-card border-r border-border">
                  <div className="flex flex-col gap-6 mt-8">
                    <NavLinks />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-4 rounded-full border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-cyan-400">
                    <UserIcon size={16} />
                  </div>
                  <span className="hidden sm:inline-block font-medium">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <div className="p-2 border-b border-border mb-2">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Signed in as</p>
                  <p className="font-medium truncate">{user.name}</p>
                </div>
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {user.role === 'manager' ? (
          <ManagerEventProvider>{children}</ManagerEventProvider>
        ) : user.role === 'admin' ? (
          <AdminEventProvider>{children}</AdminEventProvider>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
