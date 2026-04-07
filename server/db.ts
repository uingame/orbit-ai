import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const isLocalDb =
  databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
