import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const rawUrl = process.env.DATABASE_URL;
const isLocalDb =
  rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

const databaseUrl =
  isLocalDb || rawUrl.includes("sslmode=")
    ? rawUrl
    : rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=no-verify";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  extensionsFilters: ["postgis"],
  schemaFilter: ["public"],
  tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"],
});
