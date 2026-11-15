# Deployment without Supabase

This deployment uses PostgreSQL 17 on an internal Compose network, a persistent database volume, and a persistent private workspace-file volume. No database port is published. Live boards poll the app every five seconds. Uploads are limited to 32 MiB per file and require an admin session plus a short-lived signed upload URL.

## First deployment

1. Choose a database password and percent-encode special characters in the connection URLs. Set both GitHub Actions secrets DATABASE_URL and DIRECT_DATABASE_URL to `postgresql://ctf:PASSWORD@db:5432/ctf`. Keep the existing app signing/encryption secrets when importing existing data.
2. Configure Jenkins as Pipeline from SCM using the repository Jenkinsfile. Retain the psgdcgit username/password credential. The agent needs Docker Compose v2 with `up --wait` support.
3. Build and push the image. Jenkins starts PostgreSQL, applies ordered migrations, and starts the app on port 8005. Runtime configuration stays embedded in the image as requested. Anyone with image access can extract it.
4. An empty database has no accounts. Import existing data before cutover. Do not run seed against an imported/live database: it wipes tables.

## Existing data cutover

Use a machine where the old database is reachable. Stop writes on the old application, take an app-schema dump using `pg_dump --schema=app --no-owner --no-acl` (use PostgreSQL client version compatible with the source), and separately export all objects from the old private workspaces bucket. Transfer the dump/files through an approved private channel to the Jenkins workspace/server. Restore the dump into a NEW empty PostgreSQL volume with psql before applying new migrations. For a full app schema dump, mark the migration filenames present in the source as applied in migrations.applied; do not replay schema creation migrations over restored tables. Copy each exported workspace folder into the workspace_data volume. Verify accounts, scores, file downloads, uploads and board refresh before enabling writes. Retain the old project until migration is verified.

## Backups and operations

Never run `docker compose down -v`: it deletes persistent data. Back up PostgreSQL using pg_dump and archive the workspace_data volume to storage outside this host. Verify restores before the event. Changing the embedded database password does not change the password of an initialized database; coordinate an ALTER ROLE with the image update. Container startup alone does not verify database access.

For local development: use a local PostgreSQL instance, set both database URLs in .env.local, run `pnpm db:push`, and run `pnpm dev`. SQL migrations now live in db/migrations; the Supabase CLI is no longer used. WORKSPACE_STORAGE_DIR defaults to ./data/workspaces. Do not commit data, dumps, or runtime-env.json.
## Prepared one-time import through Jenkins

A read-only snapshot was exported to the ignored data/migration directory. Set both GitHub database URL secrets from target-database.env, then build a new image. Keep the six original app secrets to preserve encrypted data and token hashes. In Jenkins credentials, upload ctf-migration.tar.gz as a Secret file with ID ctf-migration-archive. Use the updated Jenkinsfile in Pipeline script, select Build with Parameters, and enable RESTORE_EXISTING_DATA for the first import only. It applies schema migrations first, restores data only when app.users is empty, then copies workspace files to the persistent volume. All three legacy buckets are included in the archive; only workspaces is needed by the current runtime (the exported challenge_assets table is empty). Keep the archive private.

The snapshot is not a continuously synchronized replica. Stop writes to the old site and take a fresh snapshot immediately before final cutover if any records changed after export. Verify counts against manifest.json and sign-in/file downloads on the target. Do not delete the source until target validation and off-host backups are complete.
