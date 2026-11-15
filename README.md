# SPIDEY tracXer — Search the SpiderXman

Spider-Man–themed beginner CTF for a live 75-minute college event (EYE club, PSG Tech). Next.js 15 + PostgreSQL in Docker.

## Setup

The app uses self-hosted PostgreSQL, private local file storage, and same-origin polling. See [self-hosted deployment](docs/self-hosted.md) for Jenkins/Compose deployment, data migration, and backups.

Install dependencies with pnpm install, configure .env.local from .env.example, apply migrations with pnpm db:push, and start pnpm dev. Seed is destructive and only for empty disposable development databases.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` | Run or build the app |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Code checks and formatting |
| `pnpm test` | Unit and integration tests. Needs `.env.local` and **wipes the dev app tables**, so run `pnpm seed` afterwards |
| `pnpm db:push` | Applies migrations to `DIRECT_DATABASE_URL` |
| `pnpm seed` | Wipes and reloads dev data. Writes `seed-output/` (gitignored). Refuses other databases unless `--force` |
| `pnpm gen-secrets` | Prints a `.env.local` block with fresh secrets |
| `pnpm bench:argon2` | Times one hash and 100 concurrent hashes for each profile in TRD §5.1 |

## Folder map
```text
docs/                 PRD, TRD, app flow, design brief, schema, implementation plan
db/migrations/  SQL source of truth (never use drizzle-kit push)
scripts/              seed, gen-secrets, db-push, bench-argon2
src/lib/              env, db, crypto, auth, flags, variants
tests/                unit and integration
QUESTIONS_TEMPLATE.md format for the organisers' questions
```

## Docs
[PRD](docs/01-PRD.md) · [TRD](docs/02-TRD.md) · [App flow](docs/03-App-Flow.md) · [Design brief](docs/04-Design-Brief.md) · [Backend schema](docs/05-Backend-Schema.md) · [Implementation plan](docs/06-Implementation-Plan.md)

## Deployment under /ctf

The app is built with Next.js basePath /ctf. Rebuild the image after changing this prefix. Use deploy/nginx.conf as the proxy configuration; preserve the /ctf prefix upstream. Validate with nginx -t before reloading Nginx. If TLS terminates at an earlier proxy, configure X-Forwarded-Proto to reflect that trusted HTTPS connection.
