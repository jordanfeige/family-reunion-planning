/**
 * Apply US meta columns (origin_metro, home_city, home_state).
 * Usage: node --env-file=.env.local scripts/apply-us-meta.mjs
 *    or: vercel env run -e production -- node scripts/apply-us-meta.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

try {
  const before = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'user'
      and column_name in ('home_city', 'home_state')
    order by 1
  `;
  console.log("user home cols before:", before.map((r) => r.column_name));

  await sql`
    ALTER TABLE trip
      ADD COLUMN IF NOT EXISTS origin_metro text DEFAULT 'Sioux Falls, SD'
  `;
  await sql.unsafe(`
    ALTER TABLE survey_response
      ADD COLUMN IF NOT EXISTS home_city text,
      ADD COLUMN IF NOT EXISTS home_state text
  `);
  await sql.unsafe(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS home_city text,
      ADD COLUMN IF NOT EXISTS home_state text
  `);

  const after = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'user'
      and column_name in ('home_city', 'home_state')
    order by 1
  `;
  console.log("user home cols after:", after.map((r) => r.column_name));
  console.log("US meta migration applied.");
} catch (err) {
  console.error(err?.message || err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
