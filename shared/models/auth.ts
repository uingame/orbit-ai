import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// OAuth accounts table - links external providers to app users
// Maps Replit Auth (Google, etc.) to our existing users table
export const oauthAccounts = pgTable("oauth_accounts", {
  id: varchar("id").primaryKey(), // The sub from OIDC provider
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  linkedUserId: integer("linked_user_id"), // Links to our app's users table
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertOAuthAccount = typeof oauthAccounts.$inferInsert;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;

// Authorized emails table - pre-approved emails with assigned roles
// When a user logs in with Google, we check this table to assign their role
export const authorizedEmails = pgTable("authorized_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  role: varchar("role").notNull(), // "admin", "manager", or "judge"
  name: varchar("name"), // Optional display name
  eventIds: integer("event_ids").array(), // Events this user should be assigned to after sign-up
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by"), // User ID who added this email
});

export type AuthorizedEmail = typeof authorizedEmails.$inferSelect;
export type InsertAuthorizedEmail = typeof authorizedEmails.$inferInsert;
