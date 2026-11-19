-- Global Events Directory (GED) — Phase 1
-- Extensions required by the core schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive emails/domains
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- location/search normalisation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy company-name search
