# Global Events Directory — Database

PostgreSQL schema for the UK Event Supplier Intelligence Database.

## Apply migrations

```bash
# Create database
createdb ged

# Apply in order
psql -d ged -f migrations/001_extensions.sql
psql -d ged -f migrations/002_schema.sql
psql -d ged -f migrations/003_indexes_constraints.sql
psql -d ged -f migrations/004_seed_categories_services.sql
psql -d ged -f migrations/005_seed_uk_locations.sql
```

Or use the helper:

```bash
./scripts/apply_migrations.sh ged
```

## Required tables

| Table | Purpose |
|-------|---------|
| `categories` | Top-level service families (Venues, Food & Drink, …) |
| `services` | Searchable supplier services under a category |
| `locations` | Hierarchical UK (then multi-country) geography |
| `suppliers` | Master supplier records |
| `supplier_contacts` | Business emails, phones, contact pages |
| `supplier_socials` | Public social / Google Business URLs |
| `campaigns` | Marketing segment definitions |
| `lead_exports` | CSV/XLSX export jobs |
| `audit_logs` | Immutable change history |

Supporting tables (integrity / compliance):

| Table | Purpose |
|-------|---------|
| `supplier_services` | Many-to-many supplier ↔ service |
| `campaign_suppliers` | Snapshot of suppliers in a campaign |
| `suppression_list` | GDPR/PECR opt-outs |

## Duplicate rules

A supplier is treated as a duplicate when any of these match an existing master:

- normalised website
- business email
- normalised phone (E.164-ish digits)
- Google Business URL

Partial unique indexes enforce this at the database layer while allowing NULLs.
