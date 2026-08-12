import re
import os
import unicodedata
import pandas as pd
import psycopg2
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# ─── Connexion PostgreSQL ──────────────────────────────────────────────────────
def get_connection():
    return psycopg2.connect(
        database=os.environ.get('DB_NAME', 'CIH_Bank'),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', 'root'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432')
    )

# ─── Nettoyage avancé des commentaires ────────────────────────────────────────
def filtrer_emojis(texte):
    """
    Nettoie un avis client :
    - supprime les valeurs vides/NaN
    - supprime les emojis
    - supprime les URLs
    - supprime les caractères de contrôle non imprimables
    - normalise les espaces
    - réduit la ponctuation et les lettres répétées abusivement
    - filtre les textes trop courts ou sans lettres
    """
    if not texte or str(texte).strip().lower() in ('nan', 'none', ''):
        return None

    texte = str(texte)

    # Supprimer les emojis (plage Unicode étendue)
    emoji_pattern = re.compile(
        "["
        u"\U0001F600-\U0001F64F"
        u"\U0001F300-\U0001F5FF"
        u"\U0001F680-\U0001F6FF"
        u"\U0001F1E0-\U0001F1FF"
        u"\U00002700-\U000027BF"
        u"\U0001F900-\U0001F9FF"
        u"\U00002600-\U000026FF"
        u"\U0001FA70-\U0001FAFF"
        u"\U0001F000-\U0001F02F"
        "]+",
        flags=re.UNICODE
    )
    texte = re.sub(emoji_pattern, '', texte)

    # Supprimer les URLs
    texte = re.sub(r'https?://\S+|www\.\S+', '', texte)

    # Supprimer les caractères de contrôle / non imprimables
    texte = ''.join(c for c in texte if unicodedata.category(c)[0] != 'C')

    # Normaliser les espaces multiples et retours à la ligne
    texte = re.sub(r'\s+', ' ', texte).strip()

    # Réduire les répétitions excessives de ponctuation 
    texte = re.sub(r'([!?.,])\1{2,}', r'\1', texte)

    # Réduire les lettres répétées abusivement
    texte = re.sub(r'(.)\1{3,}', r'\1\1', texte)

    # Filtrer les textes trop courts ou sans lettres
    if len(texte) <= 3 or not re.search(r'[a-zA-Zà-üÀ-Ü]', texte):
        return None

    return texte

# ─── Modèle BERT ──────────────────────────────────────────────────────────────
def charger_modele():
    # Charge depuis le cache local — pas de téléchargement
    model_path = '/scripts/models/bert-sentiment'
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()
    return tokenizer, model

def calculer_sentiment(texte, tokenizer, model):
    tokens = tokenizer.encode(
        texte,
        return_tensors='pt',
        truncation=True,
        max_length=512
    )
    with torch.no_grad():
        result = model(tokens)
    return int(torch.argmax(result.logits)) + 1  # score 1 à 5

def clean_phone(phone):
    if phone is None or pd.isna(phone):
        return ''
    p = str(phone).strip()
    if p.endswith('.0'):
        p = p[:-2]
    return p

# ─── Chargement Silver ────────────────────────────────────────────────────────
def load_silver(cursor, tokenizer, model):
    """
    Lit depuis bronze.raw_reviews les avis non encore traités,
    filtre les NaN / textes vides, nettoie les emojis,
    convertit la date, calcule le score BERT
    et insère dans silver.cleaned_reviews.
    """
    cursor.execute("""
        SELECT b.title, b.city, b.address, b.phone, b.text_translated, b.published_at
        FROM bronze.raw_reviews b
        LEFT JOIN silver.cleaned_reviews s
            ON b.title = s.title
            AND b.text_translated = s.commentaire
        WHERE b.text_translated IS NOT NULL
          AND TRIM(b.text_translated) != ''
          AND TRIM(b.text_translated) != 'nan'
          AND LENGTH(TRIM(b.text_translated)) > 3
          AND s.id IS NULL
    """)
    rows = cursor.fetchall()
    cols = ['title', 'city', 'address', 'phone', 'text_translated', 'published_at']
    df = pd.DataFrame(rows, columns=cols)
    print(f"[SILVER] {len(df)} nouveaux avis à traiter depuis Bronze")

    if df.empty:
        # Nettoyage préventif sur Silver au cas où des lignes avaient été insérées avec .0
        cursor.execute("UPDATE silver.cleaned_reviews SET phone = REGEXP_REPLACE(phone, '\\.0$', '') WHERE phone LIKE '%.0';")
        print("[SILVER] Aucun nouvel avis à traiter.")
        return

    df['phone'] = df['phone'].apply(clean_phone)
    df['commentaire'] = df['text_translated'].apply(filtrer_emojis)

    avant = len(df)
    df = df[df['commentaire'].notna()].reset_index(drop=True)
    apres = len(df)
    print(f"[SILVER] {avant - apres} avis ignorés (vides après nettoyage)")
    print(f"[SILVER] {apres} avis valides à insérer")

    if df.empty:
        print("[SILVER] Aucun avis valide après nettoyage.")
        return

    df['published_at'] = pd.to_datetime(df['published_at'], errors='coerce').dt.date

    print(f"[SILVER] Calcul du sentiment BERT sur {len(df)} avis...")
    df['sentiment'] = df['commentaire'].apply(
        lambda t: calculer_sentiment(t, tokenizer, model)
    )

    inseres = 0
    for _, row in df.iterrows():
        if not row['commentaire']:
            continue
        cursor.execute("""
            INSERT INTO silver.cleaned_reviews
                (title, city, address, phone, commentaire, published_at, sentiment)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (title, commentaire, published_at) DO NOTHING
        """, (
            row['title'],
            row['city'],
            row['address'],
            clean_phone(row['phone']),
            row['commentaire'],
            row['published_at'],
            int(row['sentiment'])
        ))
        inseres += 1

    # Nettoyage préventif des téléphones se terminant par .0
    cursor.execute("UPDATE silver.cleaned_reviews SET phone = REGEXP_REPLACE(phone, '\\.0$', '') WHERE phone LIKE '%.0';")
    print(f"[SILVER] {inseres} avis insérés dans silver.cleaned_reviews")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[INFO] Chargement du modèle BERT...")
    tokenizer, model = charger_modele()

    con = get_connection()
    cursor = con.cursor()

    try:
        load_silver(cursor, tokenizer, model)
        con.commit()
        print("[SILVER] Chargement terminé avec succès.")
    except Exception as e:
        con.rollback()
        print(f"[ERREUR] Rollback Silver : {e}")
        raise
    finally:
        cursor.close()
        con.close()