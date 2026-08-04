-- ─────────────────────────────────────────────────────────────────────────────
-- SILVER — Avis nettoyés + score sentiment BERT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE IF NOT EXISTS silver.cleaned_reviews (
    id           SERIAL PRIMARY KEY,
    title        TEXT,
    city         TEXT,
    address      TEXT,
    phone        TEXT,
    commentaire  TEXT,
    published_at DATE,                              
    sentiment    SMALLINT CHECK (sentiment BETWEEN 1 AND 5),
    processed_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE silver.cleaned_reviews 
DROP CONSTRAINT IF EXISTS unique_clean_review;

ALTER TABLE silver.cleaned_reviews 
ADD CONSTRAINT unique_clean_review 
UNIQUE (title, commentaire, published_at);
