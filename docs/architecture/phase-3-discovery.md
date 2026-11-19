# Phase 3 — Supplier Discovery Engine

## Goal

Automatically generate UK service × location search queries, discover candidate businesses, extract **public business** contact data, and ingest into the GED supplier database — with robots.txt, rate limits, GDPR/PECR, and suppression enforcement.

## Architecture

```
services × locations
        │
        ▼
 discovery_queries   ("Florist Swansea", "Wedding DJ Cardiff", …)
        │
        ▼
 discovery_runs  ──► SearchProvider (mock | manual | future Places/Bing)
        │
        ▼
 discovery_candidates
        │
        ├─ robots.txt cache + per-host rate limit
        ├─ HTML extract (business email/phone/socials only)
        └─ ingest → suppliers (dedupe + suppression)
```

## Compliance boundaries

| Rule | Implementation |
|------|----------------|
| Public business info only | Extractor + ingest filters |
| No personal emails | Reject free-mail domains (`gmail`, `yahoo`, …) |
| robots.txt | Checked + cached per host before fetch |
| Rate limits | Sliding window: ≥2s/host, ≤30/min global |
| Suppression / opt-out | Checked before supplier create |
| No SERP scraping | Providers are pluggable; default `mock` / `manual` only |

Production search should use licensed APIs (Google Places, Bing Web Search, etc.) behind the `SearchProvider` interface — not HTML scraping of search engines.

## Query generation

Uses service `search_aliases` when present:

- `Wedding Florist` + `Swansea` → `Wedding Florist Swansea`
- Falls back to service name: `Floristry Swansea`

Priority: cities (10) < towns (20) < counties (50).

## Providers

| Provider | Purpose |
|----------|---------|
| `mock` | Deterministic offline hits (`*.example`) for tests |
| `manual` | Seed known public business URLs via API |
| *(extensible)* | Implement `SearchProvider` for Places/Bing |

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/discovery/queries/generate` | Build query combinations |
| GET | `/discovery/queries` | List queries |
| GET | `/discovery/stats` | Pending / status counts |
| POST | `/discovery/runs` | Create (+ optional execute) run |
| POST | `/discovery/runs/:id/execute` | Execute queued run |
| GET | `/discovery/runs/:id/candidates` | Inspect candidates |

## CLI

```bash
cd api
npm run discovery:generate -- --service floristry --locations city,town
npm run discovery:run -- --name "Florists smoke" --service floristry --max 5
npm run discovery:stats
```

## Files

```
db/migrations/006_discovery.sql
api/src/discovery/**
api/src/routes/discovery.ts
api/src/schemas/discovery.ts
api/scripts/discovery-cli.ts
api/scripts/smoke-discovery.ts
```

## Next phase

**Phase 4 — Deduplication engine:** score and merge near-duplicates beyond exact website/email/phone matches.
