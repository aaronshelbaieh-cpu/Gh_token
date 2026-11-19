# Phase 2 — Backend API Architecture

## Goal

Expose a production HTTP API over the Phase 1 PostgreSQL schema for supplier CRM, campaigns, exports, and admin operations.

## Stack choice

| Option | Verdict |
|--------|---------|
| NestJS | Capable but heavier for this phase |
| Express + raw SQL | Fine, less structure |
| **Fastify + Zod + pg** | **Recommended** — fast, typed validation, thin SQL layer matching our schema |

Why not an ORM yet: Phase 1 SQL is the source of truth (partial unique indexes, recursive location CTEs, views). A thin `pg` layer keeps those features explicit.

## Architecture

```
Client / Admin UI (Phase 5)
        │
        ▼
┌───────────────────────┐
│  Fastify API (Phase 2)│
│  routes → services →  │
│  PostgreSQL (Phase 1) │
└───────────────────────┘
        │
        ├── CSV/XLSX files on disk (EXPORT_DIR)
        └── audit_logs + suppression_list
```

## Module map

```
api/src/
  app.ts                 # Fastify bootstrap + error handling
  index.ts               # process entry
  config.ts              # Zod-validated env
  db/pool.ts             # connection pool + transactions
  lib/                   # normalize, audit, errors
  schemas/               # Zod request contracts
  routes/                # HTTP adapters
  services/              # business logic
```

## Endpoint groups

1. **Catalogue** — categories, services, locations  
2. **Suppliers** — search, CRUD, verify, merge  
3. **Campaigns** — filter criteria + materialised membership  
4. **Exports** — CSV/XLSX lead files matching the supplier JSON shape  
5. **Admin** — overview, duplicate candidates, audit logs, suppressions  

## Design decisions

### 1. Soft delete via `archived` status

Deletes set `status = 'archived'` so discovery/dedupe history remains intact.

### 2. Shared filter builder

`buildSupplierFilters()` powers supplier search, campaign estimates, materialisation, and ad-hoc exports — one semantics surface for CRM + marketing.

### 3. Nation / location ancestry in SQL

Campaigns like “All Florists in Wales” resolve via recursive CTEs over `locations`, not denormalised nation columns on suppliers.

### 4. Suppression checked on write

Creating/updating contacts that match `suppression_list` returns `409 SUPPRESSED_CONTACT`. Admin suppressions also flip matching suppliers to `suppressed`.

### 5. Export jobs are durable rows

`lead_exports` tracks status, path, row count, and filter snapshot for auditability.

## Files created

See `api/` directory listing in the Phase 2 PR.

## Out of scope

- Discovery scraping (Phase 3)
- Automated dedupe worker (Phase 4)
- Admin UI (Phase 5)
- AuthN/AuthZ (recommended before production exposure; not required for Phase 2 core CRUD)

## Next phase

**Phase 3 — Supplier discovery engine:** generate UK service×location search queries and ingest publicly available business data through this API.
