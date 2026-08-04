-- ─────────────────────────────────────────────────────────────────────────────
-- BRONZE — Données brutes Apify
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE IF NOT EXISTS bronze.raw_reviews (
    id              SERIAL PRIMARY KEY,
    title           TEXT,
    city            TEXT,
    address         TEXT,
    phone           TEXT,
    text_translated TEXT,
    published_at    TEXT,
    extracted_at    TIMESTAMP DEFAULT NOW()  -- horodatage d'ingestion
);

ALTER TABLE bronze.raw_reviews 
DROP CONSTRAINT IF EXISTS unique_review;

ALTER TABLE bronze.raw_reviews 
ADD CONSTRAINT unique_review 
UNIQUE (title, text_translated, published_at);
