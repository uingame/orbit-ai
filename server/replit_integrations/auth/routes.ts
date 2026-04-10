import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./googleAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user - returns the linked app user, not the OAuth account
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const oauthId = req.user.claims.sub;
      // Return the linked app user (with role, etc.)
      const appUser = await authStorage.getLinkedAppUser(oauthId);
      if (!appUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(appUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
