# Phase 1 — Database Architecture

## Goal

Establish the PostgreSQL foundation for **Global Events Directory (GED)**: a UK-wide event supplier intelligence database that can later expand to other countries.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application / Workers                    │
│         (Phase 2 API · Phase 3 Discovery · Phase 5 Admin)    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        PostgreSQL                            │
│                                                              │
│  categories ──< services                                     │
│       ▲              ▲                                       │
│       │              │                                       │
│  suppliers >── supplier_services                             │
│       │                                                      │
│       ├── location_id → locations (tree)                     │
│       ├── supplier_contacts                                  │
│       ├── supplier_socials                                   │
│       └── master_supplier_id (merge graph)                   │
│                                                              │
│  campaigns ──< campaign_suppliers >── suppliers              │
│       │                                                      │
│       └── lead_exports                                       │
│                                                              │
│  suppression_list · audit_logs                               │
└─────────────────────────────────────────────────────────────┘
```

## Required tables delivered

| Table | Role |
|-------|------|
| `categories` | Top-level GED families (Venues, Food & Drink, …) |
| `services` | Searchable services + `search_aliases` for query generation |
| `locations` | Hierarchical geography (`country` → `nation` → `county` → `city`/`town`) |
| `suppliers` | Master business records |
| `supplier_contacts` | Business email / phone / contact page |
| `supplier_socials` | Facebook, Instagram, LinkedIn, Google Business, … |
| `campaigns` | Segment definitions via `filter_criteria` JSONB |
| `lead_exports` | CSV/XLSX export jobs |
| `audit_logs` | Append-only change history |

## Supporting tables (recommended)

| Table | Why |
|-------|-----|
| `supplier_services` | One supplier can offer multiple services |
| `campaign_suppliers` | Materialised campaign membership for stable exports |
| `suppression_list` | GDPR / PECR opt-out enforcement |

## Design decisions

### 1. UUID primary keys

**Options:** serial integers vs UUIDs.  
**Choice:** UUIDs (`gen_random_uuid()`).  
**Why:** Discovery workers will insert concurrently across regions; UUIDs avoid ID collisions and simplify later merge/sync.

### 2. Hierarchical locations with `country_code`

**Options:** flat town table vs tree.  
**Choice:** Adjacency-list tree + ISO `country_code`.  
**Why:** Campaigns like “All Florists in Wales” need ancestor filters; multi-country expansion only requires new roots.

### 3. Contacts and socials as child tables

**Options:** columns on `suppliers` vs normalised children.  
**Choice:** Children.  
**Why:** Multiple emails/phones over time, verification flags, and uniqueness for duplicate rules without sparse nullable columns.

### 4. Duplicate prevention at the database layer

Partial unique indexes on:

- `suppliers.website_normalised`
- `suppliers.google_business_url_norm`
- `supplier_contacts.value_normalised` (email / phone)

Merged / archived / suppressed rows are excluded so survivors can keep identifiers after a merge.

### 5. Campaign filters as JSONB

**Options:** rigid filter columns vs JSONB criteria.  
**Choice:** JSONB `filter_criteria` + optional `campaign_suppliers` snapshot.  
**Why:** Segmentation needs will grow (rating, has_email, multi-location) without schema churn; snapshots keep exports reproducible.

### 6. Append-only audit log

Trigger blocks `UPDATE`/`DELETE` on `audit_logs`.

## Seed contents

- **10 categories**, **~130 services** covering the full GED catalogue
- **UK scaffold:** United Kingdom → 4 nations → counties/unitary authorities → major cities/towns
- Service `search_aliases` map to discovery queries such as `Florist Swansea`, `Wedding DJ Swansea`

## Files

```
db/
  README.md
  migrations/
    001_extensions.sql
    002_schema.sql
    003_indexes_constraints.sql
    004_seed_categories_services.sql
    005_seed_uk_locations.sql
scripts/
  apply_migrations.sh
docs/
  architecture/phase-1-database.md
```

## Apply

```bash
./scripts/apply_migrations.sh ged
```

## Out of scope for Phase 1

- Backend API (Phase 2)
- Discovery / scraping engine (Phase 3)
- Deduplication worker beyond DB constraints (Phase 4)
- Admin UI / campaign builder (Phases 5–6)

## Next phase

**Phase 2 — Backend API:** REST (or tRPC) layer over this schema for supplier CRUD, search filters, and campaign stubs.
