import { oauthAccounts, authorizedEmails, type OAuthAccount, type UpsertOAuthAccount } from "@shared/models/auth";
import { users, events } from "@shared/schema";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";

/**
 * Build a kebab/dot-case username from a display name or email.
 * Examples:
 *   "Yossi Yadgar" → "yossi.yadgar"
 *   "John O'Brien" → "john.obrien"
 *   "user@example.com" (fallback) → "user"
 */
function buildBaseUsername(name: string, email: string | null): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  if (cleaned && cleaned.length >= 2) return cleaned;
  if (email) {
    const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9.-]/g, "");
    if (local) return local;
  }
  return "user";
}

/**
 * Ensures the username is unique in the users table. If the base username is
 * taken, appends an incrementing counter (e.g. "yossi.yadgar.2").
 */
async function ensureUniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let counter = 1;
  // Try up to 1000 attempts
  while (counter < 1000) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate));
    if (!existing) return candidate;
    counter++;
    candidate = `${base}.${counter}`;
  }
  // Extreme fallback
  return `${base}.${Date.now()}`;
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<OAuthAccount | undefined>;
  upsertUser(user: UpsertOAuthAccount): Promise<OAuthAccount>;
  getLinkedAppUser(oauthId: string): Promise<typeof users.$inferSelect | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<OAuthAccount | undefined> {
    const [account] = await db.select().from(oauthAccounts).where(eq(oauthAccounts.id, id));
    return account;
  }

  async upsertUser(userData: UpsertOAuthAccount): Promise<OAuthAccount> {
    // First, check if this OAuth account exists
    const existing = await this.getUser(userData.id!);

    if (existing) {
      // Update existing OAuth account
      const [account] = await db
        .update(oauthAccounts)
        .set({ ...userData, updatedAt: new Date() })
        .where(eq(oauthAccounts.id, userData.id!))
        .returning();

      // Back-fill: if the linked app user still has an ugly "oauth_..." username
      // (from before we started generating friendly names), rename it now.
      if (account.linkedUserId) {
        const [linkedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, account.linkedUserId));
        if (linkedUser && linkedUser.username.startsWith("oauth_")) {
          const displayName =
            [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
            linkedUser.name ||
            userData.email ||
            "User";
          const base = buildBaseUsername(displayName, userData.email || null);
          const newUsername = await ensureUniqueUsername(base);
          const updates: Partial<typeof users.$inferInsert> = { username: newUsername };
          // Also fix the name if the existing one is blank/placeholder
          if (!linkedUser.name || linkedUser.name.toLowerCase() === "user") {
            updates.name = displayName;
          }
          // And backfill the email if missing
          if (!linkedUser.email && userData.email) {
            updates.email = userData.email.toLowerCase().trim();
          }
          await db.update(users).set(updates).where(eq(users.id, linkedUser.id));
          console.log(
            `[Auth] Migrated legacy OAuth username "${linkedUser.username}" → "${newUsername}"`,
          );
        }
      }

      return account;
    }
    
    // New OAuth account - create app user and link it
    const displayName =
      [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
      userData.email ||
      "User";

    // Check if this email is in the authorized_emails table
    let role = "judge"; // Default role
    let assignedEventIds: number[] = [];
    let authorizedName: string | null = null;
    if (userData.email) {
      const normalizedEmail = userData.email.toLowerCase().trim();
      const [authorizedEmail] = await db
        .select()
        .from(authorizedEmails)
        .where(eq(authorizedEmails.email, normalizedEmail));

      if (authorizedEmail) {
        role = authorizedEmail.role;
        assignedEventIds = authorizedEmail.eventIds || [];
        authorizedName = authorizedEmail.name || null;
        console.log(
          `[Auth] Recognized authorized email ${normalizedEmail} with role: ${role}${assignedEventIds.length ? ` and ${assignedEventIds.length} event(s)` : ""}`,
        );
      } else {
        console.log(`[Auth] Email ${normalizedEmail} not in authorized list, denying access`);
        throw new Error("Unauthorized: Email not in approved list");
      }
    }

    // Pick the best name available: authorized_emails.name > Google profile > email > "User"
    const finalName = authorizedName || displayName;

    // Build a friendly, unique username based on the real name (e.g. "yossi.yadgar").
    // If that collides with an existing user, fall back to appending a counter.
    const normalizedEmail = userData.email?.toLowerCase().trim() || null;
    const baseUsername = buildBaseUsername(finalName, normalizedEmail);
    const username = await ensureUniqueUsername(baseUsername);

    // Create a new app user with the determined role
    const [newAppUser] = await db
      .insert(users)
      .values({
        username,
        password: "", // No password for OAuth users
        name: finalName,
        email: normalizedEmail,
        role,
      })
      .returning();

    // Assign the user to the events that were set on the authorized_emails row
    if (assignedEventIds.length > 0 && (role === "judge" || role === "manager")) {
      try {
        const eventRows = await db.select().from(events).where(inArray(events.id, assignedEventIds));
        for (const event of eventRows) {
          if (role === "manager") {
            // Only assign as manager if the event doesn't already have one
            if (!event.managerId) {
              await db.update(events).set({ managerId: newAppUser.id }).where(eq(events.id, event.id));
            }
          } else if (role === "judge") {
            const currentJudgeIds = event.judgeIds || [];
            if (!currentJudgeIds.includes(newAppUser.id)) {
              await db
                .update(events)
                .set({ judgeIds: [...currentJudgeIds, newAppUser.id] })
                .where(eq(events.id, event.id));
            }
          }
        }
        console.log(`[Auth] Assigned user ${newAppUser.id} to ${eventRows.length} event(s)`);
      } catch (assignErr) {
        console.error(`[Auth] Failed to assign user to events:`, assignErr);
      }
    }

    // Create the OAuth account linked to the new app user
    const [account] = await db
      .insert(oauthAccounts)
      .values({
        ...userData,
        linkedUserId: newAppUser.id,
      })
      .returning();

    return account;
  }

  async getLinkedAppUser(oauthId: string): Promise<typeof users.$inferSelect | undefined> {
    const oauthAccount = await this.getUser(oauthId);
    if (!oauthAccount?.linkedUserId) return undefined;
    
    const [appUser] = await db.select().from(users).where(eq(users.id, oauthAccount.linkedUserId));
    return appUser;
  }
}

export const authStorage = new AuthStorage();
