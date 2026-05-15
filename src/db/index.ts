import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  sql: ReturnType<typeof postgres> | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase Postgres URL to .env.local — see .env.example.",
    );
  }
  const client = postgres(url, { prepare: false, max: 10 });
  return { client, db: drizzle(client, { schema }) };
}

export function getDb() {
  if (!globalForDb.db || !globalForDb.sql) {
    const { client, db } = createClient();
    globalForDb.sql = client;
    globalForDb.db = db;
  }
  return globalForDb.db;
}
