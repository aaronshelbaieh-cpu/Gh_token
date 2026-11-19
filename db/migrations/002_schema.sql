-- Global Events Directory (GED) — Phase 1
-- Core relational schema
--
-- Design notes:
--   * UUID primary keys for merge-safe distributed discovery workers
--   * locations form a tree (country → admin area → town/city)
--   * suppliers hold the master record; contacts/socials are 1:N
--   * supplier_services allows multi-service businesses
--   * campaigns store filter criteria as JSONB + optional materialised membership
--   * audit_logs are append-only

BEGIN;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

CREATE TYPE location_type AS ENUM (
    'country',
    'nation',          -- England, Scotland, Wales, Northern Ireland
    'county',          -- ceremonial / historic county
    'unitary_authority',
    'city',
    'town',
    'village',
    'district'
);

CREATE TYPE supplier_status AS ENUM (
    'discovered',
    'enriched',
    'verified',
    'needs_review',
    'duplicate_candidate',
    'merged',
    'suppressed',
    'archived'
);

CREATE TYPE contact_channel AS ENUM (
    'email',
    'phone',
    'contact_page',
    'form'
);

CREATE TYPE social_platform AS ENUM (
    'facebook',
    'instagram',
    'linkedin',
    'twitter',
    'tiktok',
    'youtube',
    'google_business',
    'other'
);

CREATE TYPE campaign_status AS ENUM (
    'draft',
    'ready',
    'exported',
    'archived'
);

CREATE TYPE export_format AS ENUM (
    'csv',
    'xlsx'
);

CREATE TYPE export_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);

CREATE TYPE audit_action AS ENUM (
    'create',
    'update',
    'delete',
    'merge',
    'verify',
    'suppress',
    'export',
    'restore'
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    slug            TEXT NOT NULL,
    name            TEXT NOT NULL,
    search_aliases  TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'Wedding DJ','Mobile DJ'}
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT services_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- locations (hierarchical, country-ready)
-- ---------------------------------------------------------------------------

CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES locations (id) ON DELETE RESTRICT,
    country_code    CHAR(2) NOT NULL DEFAULT 'GB',   -- ISO 3166-1 alpha-2
    location_type   location_type NOT NULL,
    slug            TEXT NOT NULL,
    name            TEXT NOT NULL,
    name_normalised TEXT NOT NULL,                   -- lower(unaccent(name))
    admin_code      TEXT,                            -- optional ONS/ISO code
    latitude        NUMERIC(9, 6),
    longitude       NUMERIC(9, 6),
    population      INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT locations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT locations_lat_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT locations_lng_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT locations_parent_not_self CHECK (parent_id IS DISTINCT FROM id)
);

-- ---------------------------------------------------------------------------
-- suppliers (master record)
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_supplier_id      UUID REFERENCES suppliers (id) ON DELETE SET NULL,
    -- when status = merged, master_supplier_id points at the surviving record

    company_name            TEXT NOT NULL,
    company_name_normalised TEXT NOT NULL,

    primary_category_id     UUID REFERENCES categories (id) ON DELETE SET NULL,
    primary_service_id      UUID REFERENCES services (id) ON DELETE SET NULL,
    location_id             UUID REFERENCES locations (id) ON DELETE SET NULL,

    town                    TEXT,
    county                  TEXT,
    postcode                TEXT,
    country_code            CHAR(2) NOT NULL DEFAULT 'GB',
    latitude                NUMERIC(9, 6),
    longitude               NUMERIC(9, 6),

    website                 TEXT,
    website_normalised      TEXT,                    -- scheme/host stripped & lowercased
    google_rating           NUMERIC(2, 1),
    google_review_count     INTEGER,
    google_business_url     TEXT,
    google_business_url_norm TEXT,

    source_url              TEXT,
    discovery_query         TEXT,                    -- e.g. "Florist Swansea"
    status                  supplier_status NOT NULL DEFAULT 'discovered',

    date_found              DATE NOT NULL DEFAULT CURRENT_DATE,
    last_verified           TIMESTAMPTZ,
    last_enriched_at        TIMESTAMPTZ,

    notes                   TEXT,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT suppliers_lat_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT suppliers_lng_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT suppliers_rating_range CHECK (
        google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)
    ),
    CONSTRAINT suppliers_merged_has_master CHECK (
        status <> 'merged' OR master_supplier_id IS NOT NULL
    ),
    CONSTRAINT suppliers_master_not_self CHECK (
        master_supplier_id IS DISTINCT FROM id
    )
);

-- ---------------------------------------------------------------------------
-- supplier_services (many-to-many)
-- ---------------------------------------------------------------------------

CREATE TABLE supplier_services (
    supplier_id     UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    service_id      UUID NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    confidence      NUMERIC(3, 2) DEFAULT 1.00,      -- discovery confidence 0–1
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (supplier_id, service_id),
    CONSTRAINT supplier_services_confidence CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

-- ---------------------------------------------------------------------------
-- supplier_contacts
-- ---------------------------------------------------------------------------

CREATE TABLE supplier_contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    channel             contact_channel NOT NULL,
    value               TEXT NOT NULL,
    value_normalised    TEXT NOT NULL,               -- lower email / digits-only phone
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    is_business         BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    source_url          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT supplier_contacts_value_not_blank CHECK (length(trim(value)) > 0)
);

-- ---------------------------------------------------------------------------
-- supplier_socials
-- ---------------------------------------------------------------------------

CREATE TABLE supplier_socials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    platform            social_platform NOT NULL,
    url                 TEXT NOT NULL,
    url_normalised      TEXT NOT NULL,
    handle              TEXT,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    status          campaign_status NOT NULL DEFAULT 'draft',

    -- Structured filter criteria for segmentation, e.g.:
    -- {
    --   "category_slugs": ["styling-decor"],
    --   "service_slugs": ["floristry"],
    --   "location": {"nation": "Wales"},
    --   "has_email": true,
    --   "min_rating": 4.0
    -- }
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,

    estimated_count INTEGER,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at     TIMESTAMPTZ,

    CONSTRAINT campaigns_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- campaign_suppliers (materialised membership snapshot)
-- ---------------------------------------------------------------------------

CREATE TABLE campaign_suppliers (
    campaign_id     UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    matched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    match_reason    TEXT,

    PRIMARY KEY (campaign_id, supplier_id)
);

-- ---------------------------------------------------------------------------
-- lead_exports
-- ---------------------------------------------------------------------------

CREATE TABLE lead_exports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID REFERENCES campaigns (id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    format          export_format NOT NULL DEFAULT 'csv',
    status          export_status NOT NULL DEFAULT 'pending',
    row_count       INTEGER,
    file_path       TEXT,
    filter_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message   TEXT,
    requested_by    TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- suppression_list (GDPR / PECR / opt-out)
-- ---------------------------------------------------------------------------

CREATE TABLE suppression_list (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         contact_channel NOT NULL,
    value           TEXT NOT NULL,
    value_normalised TEXT NOT NULL,
    reason          TEXT NOT NULL DEFAULT 'opt_out',
    source          TEXT,                            -- user request, complaint, etc.
    supplier_id     UUID REFERENCES suppliers (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     TEXT NOT NULL,                   -- 'supplier', 'campaign', …
    entity_id       UUID,
    action          audit_action NOT NULL,
    actor           TEXT,                            -- user / system / worker id
    before_state    JSONB,
    after_state     JSONB,
    context         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent accidental mutation of audit history via grants in app role later;
-- also block UPDATE/DELETE at the table level for non-superusers via trigger.

CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_supplier_contacts_updated_at
    BEFORE UPDATE ON supplier_contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_supplier_socials_updated_at
    BEFORE UPDATE ON supplier_socials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
