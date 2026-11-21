-- Statesmen AI database schema (Neon Postgres + pgvector).
-- Safe to re-run: every statement is idempotent.
--
--   psql "$DATABASE_URL_UNPOOLED" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- One row per built persona.
CREATE TABLE IF NOT EXISTS persons (
  slug          text PRIMARY KEY,
  name          text NOT NULL,
  member_id     integer,
  -- The Hansard fetch config used for the build (memberId or attribution).
  source        jsonb NOT NULL,
  speech_count  integer NOT NULL,
  embed_model   text NOT NULL,
  built_at      timestamptz NOT NULL DEFAULT now()
);

-- End of the person's time in Parliament; NULL while still serving. Sets the
-- persona's knowledge cutoff in chat.
ALTER TABLE persons ADD COLUMN IF NOT EXISTS ended_at date;

-- One row per Hansard contribution kept for a persona.
CREATE TABLE IF NOT EXISTS speeches (
  person_slug            text NOT NULL REFERENCES persons (slug) ON DELETE CASCADE,
  -- Hansard ContributionExtId.
  id                     text NOT NULL,
  sitting_date           date NOT NULL,
  house                  text NOT NULL,
  debate_title           text,
  -- Hansard DebateSectionExtId, for linking to the debate on hansard.parliament.uk.
  debate_section_ext_id  text,
  text                   text NOT NULL,
  -- Qwen3-Embedding-0.6B, 1024 dimensions.
  embedding              vector(1024) NOT NULL,
  PRIMARY KEY (person_slug, id)
);

-- Searches are always within one person (~500 rows), so an exact scan over
-- that person's rows is fast and fully accurate. The primary key's leading
-- person_slug column covers the filter; no approximate vector index needed.

-- Warm/cold state of external services, for the header status dot.
-- name = 'embed' for the Modal embedding service.
CREATE TABLE IF NOT EXISTS service_state (
  name                text PRIMARY KEY,
  last_warm_at        timestamptz,
  warming_started_at  timestamptz
);
