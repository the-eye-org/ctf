// Apply ordered SQL migrations without an external CLI.
import { readdir, readFile } from 'node:fs/promises';
import postgres from 'postgres';
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error('DIRECT_DATABASE_URL is not set');
const sql = postgres(url, { prepare: false, max: 1 });
async function main() {
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(74281039)`;
    await tx`CREATE SCHEMA IF NOT EXISTS migrations`;
    await tx`CREATE TABLE IF NOT EXISTS migrations.applied (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const name of (await readdir('db/migrations')).filter((n) => n.endsWith('.sql')).sort()) {
      if ((await tx`SELECT name FROM migrations.applied WHERE name = ${name}`).length) continue;
      await tx.unsafe(await readFile(`db/migrations/${name}`, 'utf8'));
      await tx`INSERT INTO migrations.applied (name) VALUES (${name})`;
      console.log(`Applied ${name}`);
    }
  });
} finally {
  await sql.end();
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
