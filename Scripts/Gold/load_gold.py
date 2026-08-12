import os
import psycopg2

# ─── Connexion PostgreSQL ──────────────────────────────────────────────────────
def get_connection():
    return psycopg2.connect(
        database=os.environ.get('DB_NAME', 'CIH_Bank'),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', 'root'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432')
    )

# ─── Gold : agence_stats ──────────────────────────────────────────────────────
def load_agence_stats(cursor):
    """
    Calcule par agence : note moyenne, nb avis total,
    nb positifs (>= 4), nb négatifs (<= 2), classement.
    """
    cursor.execute("""
        INSERT INTO gold.agence_stats
            (agence, city, address, phone, note_moyenne,
             nb_avis, nb_positifs, nb_negatifs, classement)
        SELECT
            title                                           AS agence,
            city,
            address,
            REGEXP_REPLACE(phone, '\\.0$', '')              AS phone,
            ROUND(AVG(sentiment)::numeric, 2)              AS note_moyenne,
            COUNT(*)                                        AS nb_avis,
            COUNT(*) FILTER (WHERE sentiment >= 4)         AS nb_positifs,
            COUNT(*) FILTER (WHERE sentiment <= 2)         AS nb_negatifs,
            RANK() OVER (ORDER BY AVG(sentiment) DESC)     AS classement
        FROM silver.cleaned_reviews
        GROUP BY title, city, address, REGEXP_REPLACE(phone, '\\.0$', '')
    """)
    print(f"[GOLD] agence_stats : {cursor.rowcount} agences insérées")

# ─── Gold : sentiment_evolution ───────────────────────────────────────────────
def load_sentiment_evolution(cursor):
    """
    Calcule l'évolution mensuelle du sentiment par agence.
    """
    cursor.execute("""
        INSERT INTO gold.sentiment_evolution
            (agence, annee, mois, note_moyenne_mois, nb_avis_mois)
        SELECT
            title                                       AS agence,
            EXTRACT(YEAR  FROM published_at)::int       AS annee,
            EXTRACT(MONTH FROM published_at)::int       AS mois,
            ROUND(AVG(sentiment)::numeric, 2)           AS note_moyenne_mois,
            COUNT(*)                                    AS nb_avis_mois
        FROM silver.cleaned_reviews
        WHERE published_at IS NOT NULL
        GROUP BY title, annee, mois
        ORDER BY title, annee, mois
    """)
    print(f"[GOLD] sentiment_evolution : {cursor.rowcount} lignes insérées")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    con = get_connection()
    cursor = con.cursor()

    try:
        # Vider les tables Gold avant rechargement
        cursor.execute("TRUNCATE TABLE gold.agence_stats RESTART IDENTITY;")
        cursor.execute("TRUNCATE TABLE gold.sentiment_evolution RESTART IDENTITY;")
        print("[GOLD] Tables Gold vidées.")

        load_agence_stats(cursor)
        load_sentiment_evolution(cursor)

        con.commit()
        print("[GOLD] Chargement terminé avec succès.")
    except Exception as e:
        con.rollback()
        print(f"[ERREUR] Rollback Gold : {e}")
        raise
    finally:
        cursor.close()
        con.close()
