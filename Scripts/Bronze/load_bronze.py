import os
import pandas as pd
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

def clean_phone(phone):
    if phone is None or pd.isna(phone):
        return ''
    p = str(phone).strip()
    if p.endswith('.0'):
        p = p[:-2]
    return p

# ─── Chargement Bronze ────────────────────────────────────────────────────────
def load_bronze(df, cursor):
    """
    Insère toutes les colonnes brutes issues d'Apify dans bronze.raw_reviews.
    Aucune transformation appliquée.
    """
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO bronze.raw_reviews
                (title, city, address, phone, text_translated, published_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (title, text_translated, published_at) DO NOTHING
        """, (
            row.get('title'),
            row.get('city'),
            row.get('address'),
            clean_phone(row.get('phone')),
            row.get('textTranslated'),
            row.get('publishedAtDate')
        ))
    
    # Nettoyage des téléphones existants se terminant par .0
    cursor.execute("UPDATE bronze.raw_reviews SET phone = REGEXP_REPLACE(phone, '\\.0$', '') WHERE phone LIKE '%.0';")
    print(f"[BRONZE] {len(df)} lignes traitées dans bronze.raw_reviews")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    csv_path = '/scripts/extracted_data.csv'
    
    # Vérifier que le fichier CSV existe
    if not os.path.exists(csv_path):
        print(f"[BRONZE] ERREUR : Le fichier {csv_path} n'existe pas.")
        print("[BRONZE] L'étape d'extraction a peut-être échoué.")
        raise SystemExit(1)
    
    df = pd.read_csv(csv_path, dtype={'phone': str})
    if 'phone' in df.columns:
        df['phone'] = df['phone'].apply(clean_phone)
    print(f"[BRONZE] {len(df)} lignes chargées depuis {csv_path}")
    
    if df.empty:
        print("[BRONZE] ATTENTION : Le fichier CSV est vide, rien à insérer.")
        raise SystemExit(1)

    con = get_connection()
    cursor = con.cursor()

    try:
        load_bronze(df, cursor)
        con.commit()
        print("[BRONZE] Chargement terminé avec succès.")
    except Exception as e:
        con.rollback()
        print(f"[ERREUR] Rollback Bronze : {e}")
        raise
    finally:
        cursor.close()
        con.close()

