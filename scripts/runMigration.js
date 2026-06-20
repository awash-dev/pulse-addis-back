/**
 * Minimal, dependency-free SQL migration runner for the Pulse Addis backend.
 *
 * - Reads every *.sql file in ./db/migrations (sorted by filename).
 * - Tracks applied migrations in the "_Migration" table.
 * - Runs each pending file as a single multi-statement query (the `pg` driver
 *   supports this via the simple query protocol; the migration files are written
 *   to be idempotent so re-runs are safe).
 *
 * Usage:  npm run migrate
 */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const db = require("../configure/dbClient");

const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

const ensureMigrationTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "_Migration" (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

const listApplied = async () => {
  const { rows } = await db.query(
    `SELECT name FROM "_Migration" ORDER BY name ASC`
  );
  return new Set(rows.map((r) => r.name));
};

const listFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

const run = async () => {
  await ensureMigrationTable();
  const applied = await listApplied();
  const files = listFiles();

  if (files.length === 0) {
    console.log("ℹ️  No migration files found in", MIGRATIONS_DIR);
    return;
  }

  const client = await db.pool.connect();
  let appliedCount = 0;

  try {
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`✓ skipped (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`▶ applying: ${file}`);

      await client.query("BEGIN");
      try {
        // Multi-statement execution: pg runs the whole file on the simple
        // query protocol. Transaction-wrapped so a failure rolls back cleanly.
        await client.query(sql);
        await client.query(
          `INSERT INTO "_Migration" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file]
        );
        await client.query("COMMIT");
        appliedCount += 1;
        console.log(`✅ applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ failed: ${file}`);
        console.error("   ", err.message);
        throw err;
      }
    }

    console.log(
      `\n🎉 Migration complete. ${appliedCount} new migration(s) applied, ${files.length} total.`
    );
  } finally {
    client.release();
    await db.pool.end();
  }
};

run().catch((err) => {
  console.error("\n⛔ Migration run aborted:", err.message);
  process.exit(1);
});
