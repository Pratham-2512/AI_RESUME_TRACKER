/**
 * Apply all SQL migrations to the database without the Supabase CLI.
 * Usage:
 *   set DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@db.<ref>.supabase.co:5432/postgres
 *   node scripts/apply-migration.mjs
 *
 * Get the connection string: Supabase dashboard → Settings → Database →
 * "Connection string" → URI (use the direct connection, port 5432). The password
 * is the DB password you set when creating the project.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (see header of this file).");
  process.exit(1);
}

const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected. Applying", files.length, "migration(s)…");

for (const f of files) {
  const sql = readFileSync(join(migrationsDir, f), "utf8");
  console.log("→", f);
  await client.query(sql);
}

// optional seed
try {
  const seed = readFileSync(join(__dirname, "..", "supabase", "seed.sql"), "utf8");
  await client.query(seed);
  console.log("→ seed.sql");
} catch { /* no seed */ }

await client.end();
console.log("✅ Done.");
