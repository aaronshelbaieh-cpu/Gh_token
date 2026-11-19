# Global Events Directory (GED)

UK-wide Event Supplier Intelligence Database — discover, store, categorise and manage event suppliers by location and service.

## Status

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Database schema | ✅ In progress (this PR) |
| 2 | Backend API | Pending |
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

## Compliance boundaries

- Public business information only
- Respect robots.txt, rate limits, GDPR, PECR
- Suppression / opt-out list enforced in schema
- No personal (non-business) contact collection
