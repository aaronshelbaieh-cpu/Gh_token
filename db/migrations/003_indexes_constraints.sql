-- Global Events Directory (GED) — Phase 1
-- Uniqueness, duplicate prevention, and query indexes

BEGIN;

-- ---------------------------------------------------------------------------
-- Natural keys / uniqueness
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX uq_categories_slug ON categories (slug);
CREATE UNIQUE INDEX uq_categories_name ON categories (lower(name));

CREATE UNIQUE INDEX uq_services_category_slug ON services (category_id, slug);
CREATE UNIQUE INDEX uq_services_category_name ON services (category_id, lower(name));

-- Same place name may exist in different parents (e.g. Newport Wales vs Newport England)
CREATE UNIQUE INDEX uq_locations_parent_slug
    ON locations (country_code, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), slug);

CREATE UNIQUE INDEX uq_locations_parent_name_type
    ON locations (
        country_code,
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'),
        location_type,
        name_normalised
    );

CREATE UNIQUE INDEX uq_campaigns_slug ON campaigns (slug);

-- ---------------------------------------------------------------------------
-- Duplicate prevention on suppliers (master records only)
-- NULLs allowed; only one active non-merged row per identifier
-- ---------------------------------------------------------------------------

-- Same website → same business
CREATE UNIQUE INDEX uq_suppliers_website_norm
    ON suppliers (website_normalised)
    WHERE website_normalised IS NOT NULL
      AND status NOT IN ('merged', 'archived', 'suppressed');

-- Same Google Business listing → same business
CREATE UNIQUE INDEX uq_suppliers_gmb_norm
    ON suppliers (google_business_url_norm)
    WHERE google_business_url_norm IS NOT NULL
      AND status NOT IN ('merged', 'archived', 'suppressed');

-- Business email uniqueness across contacts of non-merged suppliers
CREATE UNIQUE INDEX uq_supplier_contacts_email
    ON supplier_contacts (value_normalised)
    WHERE channel = 'email'
      AND is_business = TRUE;

-- Business phone uniqueness
CREATE UNIQUE INDEX uq_supplier_contacts_phone
    ON supplier_contacts (value_normalised)
    WHERE channel = 'phone'
      AND is_business = TRUE;

-- One primary contact per channel per supplier
CREATE UNIQUE INDEX uq_supplier_contacts_primary
    ON supplier_contacts (supplier_id, channel)
    WHERE is_primary = TRUE;

-- One social URL per platform per supplier
CREATE UNIQUE INDEX uq_supplier_socials_platform
    ON supplier_socials (supplier_id, platform);

CREATE UNIQUE INDEX uq_supplier_socials_url
    ON supplier_socials (url_normalised);

-- One primary service flag per supplier
CREATE UNIQUE INDEX uq_supplier_services_primary
    ON supplier_services (supplier_id)
    WHERE is_primary = TRUE;

-- Suppression list: never re-contact opted-out channels
CREATE UNIQUE INDEX uq_suppression_channel_value
    ON suppression_list (channel, value_normalised);

-- ---------------------------------------------------------------------------
-- Lookup / filter indexes (CRM search + campaigns)
-- ---------------------------------------------------------------------------

CREATE INDEX idx_services_category ON services (category_id) WHERE is_active;

CREATE INDEX idx_locations_parent ON locations (parent_id);
CREATE INDEX idx_locations_type ON locations (country_code, location_type);
CREATE INDEX idx_locations_name_trgm ON locations USING gin (name_normalised gin_trgm_ops);
CREATE INDEX idx_locations_slug ON locations (slug);

CREATE INDEX idx_suppliers_status ON suppliers (status);
CREATE INDEX idx_suppliers_location ON suppliers (location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_suppliers_primary_service ON suppliers (primary_service_id);
CREATE INDEX idx_suppliers_primary_category ON suppliers (primary_category_id);
CREATE INDEX idx_suppliers_county ON suppliers (lower(county)) WHERE county IS NOT NULL;
CREATE INDEX idx_suppliers_town ON suppliers (lower(town)) WHERE town IS NOT NULL;
CREATE INDEX idx_suppliers_postcode ON suppliers (upper(replace(postcode, ' ', ''))) WHERE postcode IS NOT NULL;
CREATE INDEX idx_suppliers_rating ON suppliers (google_rating) WHERE google_rating IS NOT NULL;
CREATE INDEX idx_suppliers_date_found ON suppliers (date_found DESC);
CREATE INDEX idx_suppliers_last_verified ON suppliers (last_verified DESC NULLS LAST);
CREATE INDEX idx_suppliers_master ON suppliers (master_supplier_id) WHERE master_supplier_id IS NOT NULL;
CREATE INDEX idx_suppliers_company_trgm ON suppliers USING gin (company_name_normalised gin_trgm_ops);
CREATE INDEX idx_suppliers_metadata ON suppliers USING gin (metadata);

-- "Has email / has phone" CRM filters
CREATE INDEX idx_supplier_contacts_supplier ON supplier_contacts (supplier_id);
CREATE INDEX idx_supplier_contacts_channel ON supplier_contacts (channel, supplier_id);

CREATE INDEX idx_supplier_socials_supplier ON supplier_socials (supplier_id);
CREATE INDEX idx_supplier_socials_platform ON supplier_socials (platform);

CREATE INDEX idx_supplier_services_service ON supplier_services (service_id);

CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_filter ON campaigns USING gin (filter_criteria);

CREATE INDEX idx_campaign_suppliers_supplier ON campaign_suppliers (supplier_id);

CREATE INDEX idx_lead_exports_campaign ON lead_exports (campaign_id);
CREATE INDEX idx_lead_exports_status ON lead_exports (status, created_at DESC);

CREATE INDEX idx_suppression_value ON suppression_list (value_normalised);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helper views for CRM / admin overview
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_suppliers_search AS
SELECT
    s.id,
    s.company_name,
    s.status,
    s.town,
    s.county,
    s.postcode,
    s.country_code,
    s.website,
    s.google_rating,
    s.google_review_count,
    s.date_found,
    s.last_verified,
    s.location_id,
    l.name AS location_name,
    l.location_type,
    c.id AS category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    svc.id AS primary_service_id,
    svc.name AS primary_service_name,
    svc.slug AS primary_service_slug,
    EXISTS (
        SELECT 1 FROM supplier_contacts sc
        WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_business
    ) AS has_email,
    EXISTS (
        SELECT 1 FROM supplier_contacts sc
        WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_business
    ) AS has_phone,
    (
        SELECT sc.value FROM supplier_contacts sc
        WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_primary
        LIMIT 1
    ) AS primary_email,
    (
        SELECT sc.value FROM supplier_contacts sc
        WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_primary
        LIMIT 1
    ) AS primary_phone
FROM suppliers s
LEFT JOIN locations l ON l.id = s.location_id
LEFT JOIN categories c ON c.id = s.primary_category_id
LEFT JOIN services svc ON svc.id = s.primary_service_id
WHERE s.status NOT IN ('merged', 'archived', 'suppressed');

CREATE OR REPLACE VIEW v_admin_overview AS
SELECT
    (SELECT count(*) FROM suppliers WHERE status NOT IN ('merged', 'archived')) AS total_suppliers,
    (SELECT count(*) FROM services WHERE is_active) AS total_services,
    (SELECT count(*) FROM locations WHERE is_active) AS total_locations,
    (SELECT count(*) FROM suppliers WHERE date_found = CURRENT_DATE) AS new_suppliers_today,
    (
        SELECT count(*) FROM suppliers s
        WHERE s.status NOT IN ('merged', 'archived', 'suppressed')
          AND NOT EXISTS (
              SELECT 1 FROM supplier_contacts sc
              WHERE sc.supplier_id = s.id AND sc.channel = 'email'
          )
    ) AS missing_emails,
    (
        SELECT count(*) FROM suppliers WHERE status = 'duplicate_candidate'
    ) AS duplicate_candidates;

-- ---------------------------------------------------------------------------
-- Normalisation helpers (used by discovery / API in later phases)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION normalize_website(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT NULLIF(
        regexp_replace(
            regexp_replace(
                lower(trim(raw)),
                '^https?://',
                ''
            ),
            '/+$',
            ''
        ),
        ''
    );
$$;

CREATE OR REPLACE FUNCTION normalize_phone(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT NULLIF(
        regexp_replace(raw, '[^0-9+]', '', 'g'),
        ''
    );
$$;

CREATE OR REPLACE FUNCTION normalize_email(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT NULLIF(lower(trim(raw)), '');
$$;

CREATE OR REPLACE FUNCTION normalize_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT lower(unaccent(trim(regexp_replace(raw, '\s+', ' ', 'g'))));
$$;

COMMIT;
