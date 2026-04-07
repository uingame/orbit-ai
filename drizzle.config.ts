import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = process.env.DATABASE_URL;
const isLocalDb =
  databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  },
});
