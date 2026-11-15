// Read-only export of app rows and identity sequences. Run on a network that can reach the source.
import postgres from 'postgres';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
const out = resolve('data/migration');
await mkdir(out, { recursive: true });
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => value === null ? 'NULL' : "'" + value.replaceAll("'", "''") + "'";
const sql = postgres(process.env.SOURCE_DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
const counts = {};
let lines = ["BEGIN;", "SET LOCAL standard_conforming_strings = on;", "DO $$ BEGIN IF EXISTS (SELECT 1 FROM app.users) THEN RAISE EXCEPTION 'Refusing to overwrite existing accounts'; END IF; END $$;", "SET LOCAL session_replication_role = replica;"];
try {
 await sql.begin('isolation level repeatable read read only', async tx => {
  const tables = await tx`SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename`;
  lines.push('TRUNCATE ' + tables.map(t => 'app.' + quote(t.tablename)).join(', ') + ' RESTART IDENTITY CASCADE;');
  for (const {tablename} of tables) {
   const columns = await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='app' AND table_name=${tablename} ORDER BY ordinal_position`;
   const names = columns.map(c=>c.column_name);
   const rows = await tx.unsafe('SELECT ' + names.map(n=>quote(n)+'::text').join(',') + ' FROM app.'+quote(tablename));
   counts[tablename] = rows.length;
   for (const row of rows) lines.push('INSERT INTO app.'+quote(tablename)+' ('+names.map(quote).join(',')+') OVERRIDING SYSTEM VALUE VALUES ('+names.map(n=>literal(row[n])).join(',')+');');
  }
  const sequences = await tx`SELECT sequencename FROM pg_sequences WHERE schemaname='app'`;
  for (const {sequencename} of sequences) {
   const [state] = await tx.unsafe('SELECT last_value::text, is_called FROM app.'+quote(sequencename));
   lines.push('SELECT setval('+literal('app.'+quote(sequencename))+', '+state.last_value+', '+state.is_called+');');
  }
 });
} finally { await sql.end(); }
lines.push('COMMIT;');
const dump = lines.join('\n')+'\n';
await writeFile(join(out,'app-data.sql'), dump, {mode:0o600});
await writeFile(join(out,'manifest.json'), JSON.stringify({exportedAt:new Date().toISOString(), counts, sha256:createHash('sha256').update(dump).digest('hex')}, null,2));
// New target password; never reuse the source password.
const password = randomBytes(32).toString('base64url');
await writeFile(join(out,'target-database.env'), `DATABASE_URL=postgresql://ctf:${password}@db:5432/ctf\nDIRECT_DATABASE_URL=postgresql://ctf:${password}@db:5432/ctf\n`, {mode:0o600});
if (process.env.SOURCE_STORAGE_URL && process.env.SOURCE_STORAGE_KEY) {
 const headers = {apikey:process.env.SOURCE_STORAGE_KEY, Authorization:'Bearer '+process.env.SOURCE_STORAGE_KEY};
 const api = process.env.SOURCE_STORAGE_URL + '/storage/v1';
 async function walk(bucket, prefix='') {
  for (let offset=0;;offset+=100) {
   const response = await fetch(api+'/object/list/'+encodeURIComponent(bucket), {method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}})});
   if (!response.ok) throw new Error('Storage listing failed: '+response.status);
   const entries = await response.json();
   for (const entry of entries) {
    if (!entry.name || entry.name.includes('/') || entry.name === '.' || entry.name === '..') throw new Error('Unsafe storage path');
    const key = prefix ? prefix+'/'+entry.name : entry.name;
    if (!entry.id) { await walk(bucket,key); continue; }
    const file = await fetch(api+'/object/authenticated/'+encodeURIComponent(bucket)+'/'+key.split('/').map(encodeURIComponent).join('/'), {headers});
    if (!file.ok) throw new Error('Storage download failed: '+file.status);
    const target = join(out,'storage',bucket,...key.split('/'));
    await mkdir(resolve(target,'..'),{recursive:true});
    await writeFile(target,Buffer.from(await file.arrayBuffer()));
   }
   if (entries.length<100) break;
  }
 }
 const response = await fetch(api+'/bucket',{headers});
 if (!response.ok) throw new Error('Bucket listing failed: '+response.status);
 for (const bucket of await response.json()) { await walk(bucket.id); console.log('Exported storage bucket:',bucket.id); }
}
console.log('Export complete:', JSON.stringify(counts));
console.log('Private migration files written to data/migration (gitignored).');
