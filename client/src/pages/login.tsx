import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Redirect, useSearch } from "wouter";
import { Rocket, Lock, User, AlertTriangle, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useState, useEffect } from "react";
import { StarsBackground } from "@/components/stars-background";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { user, login, isLoggingIn } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const searchString = useSearch();
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get('error') === 'unauthorized') {
      setAuthError('Your email is not authorized to access this system. Please contact an administrator to be added to the approved list.');
    }
  }, [searchString]);
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (user) {
    return <Redirect to={user.role === 'admin' ? "/admin/dashboard" : "/judge/dashboard"} />;
  }

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login(values);
  }

  function handleGoogleLogin() {
    window.location.href = "/api/login";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <StarsBackground />
      {/* Decorative orbital rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/5 rounded-full animate-orbit pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-purple-500/5 rounded-full animate-orbit pointer-events-none" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

      <Card className="w-full max-w-md shadow-2xl border-cyan-500/10 relative z-10 glow-primary">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30 animate-float">
            <Rocket className="text-white h-7 w-7" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-wider font-display text-gradient">
            Orbit AI
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Space Olympics Management Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          
          {/* Google Login (Primary option for judges) */}
          <Button 
            onClick={handleGoogleLogin}
            className="w-full h-12 text-base font-semibold gap-3"
            data-testid="button-google-login"
          >
            <SiGoogle className="w-5 h-5" />
            Sign in with Google
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Admin Login Toggle */}
          {!showAdminLogin ? (
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={() => setShowAdminLogin(true)}
              data-testid="button-show-admin-login"
            >
              Admin Login with Username
            </Button>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Enter your ID" 
                            {...field} 
                            className="pl-10"
                            data-testid="input-username"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="password" 
                            placeholder="Enter password" 
                            {...field} 
                            className="pl-10"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold"
                  disabled={isLoggingIn}
                  data-testid="button-login-submit"
                >
                  {isLoggingIn && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {isLoggingIn ? "Authenticating..." : "Sign In"}
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full text-muted-foreground text-sm"
                  onClick={() => setShowAdminLogin(false)}
                >
                  Back to Google Login
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
