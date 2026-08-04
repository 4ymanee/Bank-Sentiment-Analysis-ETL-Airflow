-- ─────────────────────────────────────────────────────────────────────────────
-- GOLD — Métriques agrégées pour le dashboard final
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS gold;

-- Métriques globales par agence
CREATE TABLE IF NOT EXISTS gold.agence_stats (
    id           SERIAL PRIMARY KEY,
    agence       TEXT,
    city         TEXT,
    address      TEXT,
    phone        TEXT,
    note_moyenne NUMERIC(3, 2),
    nb_avis      INTEGER,
    nb_positifs  INTEGER,   -- sentiment >= 4
    nb_negatifs  INTEGER,   -- sentiment <= 2
    classement   INTEGER,   -- RANK par note moyenne décroissante
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- Évolution mensuelle du sentiment par agence
CREATE TABLE IF NOT EXISTS gold.sentiment_evolution (
    id                SERIAL PRIMARY KEY,
    agence            TEXT,
    annee             INTEGER,
    mois              INTEGER,
    note_moyenne_mois NUMERIC(3, 2),
    nb_avis_mois      INTEGER
);
