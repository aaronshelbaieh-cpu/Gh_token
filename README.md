# Global Events Directory (GED)

UK-wide Event Supplier Intelligence Database — discover, store, categorise and manage event suppliers by location and service.

## Status

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Database schema | ✅ Complete |
| 2 | Backend API | ✅ In progress (this PR) |
| 3 | Supplier discovery engine | Pending |
| 4 | Deduplication engine | Pending |
| 5 | Admin dashboard | Pending |
| 6 | Campaign builder | Pending |
| 7 | Reporting and analytics | Pending |

## Phase 1 — Database

PostgreSQL schema with required tables, indexes, foreign keys, uniqueness constraints, duplicate prevention, GED service catalogue seed, and UK location scaffold.

```bash
# Requires local PostgreSQL
chmod +x scripts/apply_migrations.sh
./scripts/apply_migrations.sh ged
```

See [docs/architecture/phase-1-database.md](docs/architecture/phase-1-database.md).

## Phase 2 — Backend API

TypeScript Fastify API for supplier CRM search, campaigns, CSV/XLSX exports, and admin endpoints.

```bash
cd api
cp .env.example .env
npm install
npm run dev
# smoke test
npm run test:smoke
```

See [api/README.md](api/README.md) and [docs/architecture/phase-2-api.md](docs/architecture/phase-2-api.md).

## Compliance boundaries

- Public business information only
- Respect robots.txt, rate limits, GDPR, PECR
- Suppression / opt-out list enforced in schema
- No personal (non-business) contact collection
