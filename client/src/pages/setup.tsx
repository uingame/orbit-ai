import { useEffect, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Rocket, AlertTriangle, Loader2, Lock, User as UserIcon, Mail, ShieldCheck } from "lucide-react";
import { StarsBackground } from "@/components/stars-background";

interface InviteInfo {
  email: string;
  role: "admin" | "manager" | "judge";
  name?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "System Administrator",
  manager: "Event Manager",
  judge: "Judge",
};

/**
 * Self-onboarding page reached from the invitation email's "Set up account"
 * link. Verifies the one-time token, then lets the invitee choose a username
 * and password. On success they are auto-logged in and redirected to the
 * dashboard for their role.
 */
export default function Setup() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const token = new URLSearchParams(search).get("token") || "";

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("Missing invitation token. Please use the link from your invitation email.");
      setLoadingInvite(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/setup/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setTokenError(body.message || "This invitation link is invalid or has already been used.");
          }
          return;
        }
        const data: InviteInfo = await res.json();
        if (cancelled) return;
        setInvite(data);
        setName(data.name || "");
        // Suggest a username from the email's local-part by default.
        const suggested = data.email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "");
        setUsername(suggested);
      } catch (err: any) {
        if (!cancelled) {
          setTokenError("Could not reach the server. Please check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (done) {
    // Re-route to the right dashboard after a successful auto-login.
    if (!invite) return <Redirect to="/login" />;
    if (invite.role === "admin") return <Redirect to="/admin/dashboard" />;
    if (invite.role === "manager") return <Redirect to="/manager/dashboard" />;
    return <Redirect to="/judge/dashboard" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;

    if (username.trim().length < 3) {
      toast({ title: "Username too short", description: "At least 3 characters.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/setup/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: name.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not create account",
          description: body.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
      // Refresh the auth cache so /api/user picks up the new session.
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Welcome to Orbit AI!", description: "Your account is ready." });
      if (body.mustLogin) {
        navigate("/login");
      } else {
        setDone(true);
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <StarsBackground />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/5 rounded-full animate-orbit pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-cyan-500/10 relative z-10 glow-primary">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-2 shadow-lg shadow-cyan-500/30">
            <Rocket className="text-white h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-wider font-display text-gradient">
            Set up your account
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Choose a username and password for Orbit AI
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {loadingInvite && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Verifying invitation...
            </div>
          )}

          {!loadingInvite && tokenError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{tokenError}</AlertDescription>
            </Alert>
          )}

          {!loadingInvite && invite && (
            <>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 text-cyan-500" />
                  <span>{invite.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-cyan-500" />
                  <span>{ROLE_LABELS[invite.role] || invite.role}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="setup-name">Full name</Label>
                  <Input
                    id="setup-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <Label htmlFor="setup-username">Username</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className="pl-10"
                      data-testid="setup-username"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="setup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pl-10"
                      data-testid="setup-password"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="setup-confirm">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={submitting}
                  data-testid="setup-submit"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {submitting ? "Creating account..." : "Create account"}
                </Button>

                <p className="text-center text-xs text-muted-foreground pt-2">
                  Prefer Google? You can also{" "}
                  <a href="/login" className="text-cyan-500 hover:underline">
                    sign in with Google
                  </a>
                  {" "}using {invite.email}.
                </p>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
