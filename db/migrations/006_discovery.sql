-- Global Events Directory (GED) — Phase 3
-- Discovery engine tables: query generation, runs, candidates

BEGIN;

CREATE TYPE discovery_query_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped'
);

CREATE TYPE discovery_run_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
);

CREATE TYPE discovery_candidate_status AS ENUM (
    'new',
    'enriched',
    'ingested',
    'duplicate',
    'suppressed',
    'rejected',
    'failed'
);

-- Generated search combinations, e.g. "Florist Swansea"
CREATE TABLE discovery_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
    query_text      TEXT NOT NULL,
    query_hash      TEXT NOT NULL,              -- sha256 for uniqueness
    priority        INTEGER NOT NULL DEFAULT 100,
    status          discovery_query_status NOT NULL DEFAULT 'pending',
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    last_run_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_discovery_queries_hash ON discovery_queries (query_hash);
CREATE INDEX idx_discovery_queries_status_priority
    ON discovery_queries (status, priority ASC, created_at ASC);
CREATE INDEX idx_discovery_queries_service ON discovery_queries (service_id);
CREATE INDEX idx_discovery_queries_location ON discovery_queries (location_id);

-- A batch execution of the discovery worker
CREATE TABLE discovery_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    status              discovery_run_status NOT NULL DEFAULT 'queued',
    provider            TEXT NOT NULL DEFAULT 'mock',
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,
    queries_total       INTEGER NOT NULL DEFAULT 0,
    queries_completed   INTEGER NOT NULL DEFAULT 0,
    queries_failed      INTEGER NOT NULL DEFAULT 0,
    candidates_found    INTEGER NOT NULL DEFAULT 0,
    suppliers_created   INTEGER NOT NULL DEFAULT 0,
    suppliers_skipped   INTEGER NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_runs_status ON discovery_runs (status, created_at DESC);

-- Join: which queries belonged to a run
CREATE TABLE discovery_run_queries (
    run_id      UUID NOT NULL REFERENCES discovery_runs (id) ON DELETE CASCADE,
    query_id    UUID NOT NULL REFERENCES discovery_queries (id) ON DELETE CASCADE,
    status      discovery_query_status NOT NULL DEFAULT 'pending',
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    PRIMARY KEY (run_id, query_id)
);

-- Raw discovery candidates before / after enrichment
CREATE TABLE discovery_candidates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID REFERENCES discovery_runs (id) ON DELETE SET NULL,
    query_id            UUID REFERENCES discovery_queries (id) ON DELETE SET NULL,
    supplier_id         UUID REFERENCES suppliers (id) ON DELETE SET NULL,
    company_name        TEXT,
    website             TEXT,
    website_normalised  TEXT,
    source_url          TEXT,
    snippet             TEXT,
    status              discovery_candidate_status NOT NULL DEFAULT 'new',
    rejection_reason    TEXT,
    extracted           JSONB NOT NULL DEFAULT '{}'::jsonb,
    robots_allowed      BOOLEAN,
    http_status         INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_candidates_run ON discovery_candidates (run_id, status);
CREATE INDEX idx_discovery_candidates_website
    ON discovery_candidates (website_normalised)
    WHERE website_normalised IS NOT NULL;
CREATE INDEX idx_discovery_candidates_query ON discovery_candidates (query_id);

-- robots.txt cache (respect rate limits / crawl budget)
CREATE TABLE robots_cache (
    host            TEXT PRIMARY KEY,
    robots_txt      TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    fetch_status    INTEGER
);

CREATE TRIGGER trg_discovery_queries_updated_at
    BEFORE UPDATE ON discovery_queries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discovery_runs_updated_at
    BEFORE UPDATE ON discovery_runs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discovery_candidates_updated_at
    BEFORE UPDATE ON discovery_candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
