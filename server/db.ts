import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL;
const isLocalDb =
  rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

const databaseUrl =
  isLocalDb || rawUrl.includes("sslmode=")
    ? rawUrl
    : rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=no-verify";

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
