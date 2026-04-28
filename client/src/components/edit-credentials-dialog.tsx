import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface EditableUser {
  id: number;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
}

interface Props {
  user: EditableUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Query keys to invalidate after a successful save (e.g. ["/api/judges-with-events"]). */
  invalidateKeys?: string[];
}

/**
 * Dialog for an admin to update another user's credentials and basic profile
 * fields (username, password, name, email, phone). The password field is
 * optional - leaving it blank keeps the existing password.
 */
export function EditCredentialsDialog({ user, open, onOpenChange, invalidateKeys = [] }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setPassword("");
      setConfirmPassword("");
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!user) throw new Error("No user selected");
      return apiRequest("PUT", `/api/users/${user.id}`, payload);
    },
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({ title: "Saved", description: "User credentials updated" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!user) return;
    if (!username.trim()) {
      toast({ title: "Username is required", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (password && password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "The password and confirmation must be identical",
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      username: username.trim(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    if (password) {
      payload.password = password;
    }
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit credentials</DialogTitle>
          <DialogDescription>
            {user ? `Update login details for ${user.name}.` : ""}
            {" "}Leave the password fields blank to keep the existing password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ec-username">Username</Label>
            <Input
              id="ec-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              data-testid="edit-credentials-username"
            />
          </div>
          <div>
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="ec-email">Email</Label>
            <Input
              id="ec-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label htmlFor="ec-phone">Phone</Label>
            <Input
              id="ec-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+972..."
            />
          </div>
          <div>
            <Label htmlFor="ec-password">New password</Label>
            <Input
              id="ec-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              data-testid="edit-credentials-password"
            />
          </div>
          <div>
            <Label htmlFor="ec-password-confirm">Confirm new password</Label>
            <Input
              id="ec-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
