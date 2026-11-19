# GED API (Phase 2)

TypeScript + Fastify backend for the Global Events Directory.

## Stack

- **Fastify 5** — HTTP server
- **pg** — PostgreSQL driver
- **Zod** — request validation
- **ExcelJS** — XLSX exports

## Setup

```bash
cd api
cp .env.example .env
# Edit DATABASE_URL if needed
npm install
npm run dev
```

Default: `http://127.0.0.1:3000`

## Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` `/ready` | Liveness / DB readiness |
| GET | `/categories` `/services` `/locations` | Catalogue |
| GET | `/suppliers` | Search + CRM filters |
| POST/PATCH/DELETE | `/suppliers` | CRUD |
| POST | `/suppliers/:id/verify` | Verify contacts |
| POST | `/suppliers/merge` | Merge duplicates |
| GET/POST/PATCH | `/campaigns` | Campaign builder |
| POST | `/campaigns/:id/materialize` | Snapshot members |
| POST | `/exports` | CSV / XLSX lead export |
| GET | `/exports/:id/download` | Download file |
| GET | `/admin/overview` | Dashboard counters |
| POST | `/admin/suppressions` | GDPR/PECR opt-out |

### Supplier search filters

`category`, `service`, `county`, `town`, `nation`, `minRating`, `hasEmail`, `hasPhone`, `q`, `status`

Example:

```bash
curl 'http://127.0.0.1:3000/suppliers?service=floristry&nation=wales&hasEmail=true'
```

### Campaign example

```bash
curl -X POST http://127.0.0.1:3000/campaigns \
  -H 'content-type: application/json' \
  -d '{
    "name": "All Florists in Wales",
    "filterCriteria": {
      "serviceSlugs": ["floristry"],
      "nation": "wales",
      "hasEmail": true
    }
  }'
```

## Scripts

```bash
npm run typecheck
npm run build
npm start
npm run test:smoke
```
