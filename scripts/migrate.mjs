/**
 * Migration runner for self-hosted deploys (Railway, Fly, a VPS, anywhere).
 *
 * Applies every .sql file in drizzle/migrations in filename order exactly once,
 * tracked in the table public._app_migrations.
 *
 * Usage:  DATABASE_URL=postgres://... bun run scripts/migrate.mjs
 * Skips silently (exit 0) when DATABASE_URL is not set, so the app can still boot
 * against a database that is managed elsewhere.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle", "migrations");
const rawUrl = (process.env.DATABASE_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "").trim();
// Strip accidental surrounding quotes (common when pasting into a host UI).
const url = rawUrl.replace(/^["']|["']$/g, "");

if (!url) {
  console.log("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

if (!/^postgres(ql)?:\/\/.+/i.test(url)) {
  console.error(
    "[migrate] DATABASE_URL is not a valid Postgres connection string " +
      "(it must start with postgresql:// ). Skipping migrations so the app can still boot.",
  );
  process.exit(0);
}

let sql;
try {
  sql = postgres(url, { max: 1, onnotice: () => {}, ssl: "prefer" });
} catch (error) {
  console.error("[migrate] could not connect with DATABASE_URL:", error?.message ?? error);
  process.exit(0);
}


try {
  await sql`
    create table if not exists public._app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  // Private media bucket used by Create Post. Idempotent: safe on every boot.
  await sql`
    insert into storage.buckets (id, name, public)
    values ('post-media', 'post-media', false)
    on conflict (id) do nothing
  `.catch((e) => console.warn("[migrate] could not ensure post-media bucket:", e.message));

  const applied = new Set(
    (await sql`select name from public._app_migrations`).map((r) => r.name),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    if (!body.trim()) continue;
    console.log(`[migrate] applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public._app_migrations (name) values (${file})`;
    });
    count += 1;
  }

  console.log(
    count === 0
      ? `[migrate] up to date (${files.length} migrations already applied)`
      : `[migrate] applied ${count} migration(s)`,
  );
} catch (error) {
  console.error("[migrate] failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
