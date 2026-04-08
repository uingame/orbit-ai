import { oauthAccounts, authorizedEmails, type OAuthAccount, type UpsertOAuthAccount } from "@shared/models/auth";
import { users, events } from "@shared/schema";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";

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
      return account;
    }
    
    // New OAuth account - create app user and link it
    const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email || 'User';
    const username = `oauth_${userData.id}`;

    // Check if this email is in the authorized_emails table
    let role = 'judge'; // Default role
    let assignedEventIds: number[] = [];
    if (userData.email) {
      const normalizedEmail = userData.email.toLowerCase().trim();
      const [authorizedEmail] = await db
        .select()
        .from(authorizedEmails)
        .where(eq(authorizedEmails.email, normalizedEmail));

      if (authorizedEmail) {
        role = authorizedEmail.role;
        assignedEventIds = authorizedEmail.eventIds || [];
        console.log(`[Auth] Recognized authorized email ${normalizedEmail} with role: ${role}${assignedEventIds.length ? ` and ${assignedEventIds.length} event(s)` : ''}`);
      } else {
        console.log(`[Auth] Email ${normalizedEmail} not in authorized list, denying access`);
        throw new Error('Unauthorized: Email not in approved list');
      }
    }

    // Create a new app user with the determined role
    const [newAppUser] = await db.insert(users).values({
      username,
      password: '', // No password for OAuth users
      name: displayName,
      email: userData.email?.toLowerCase().trim() || null,
      role,
    }).returning();

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
