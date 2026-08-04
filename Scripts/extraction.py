import pandas as pd
from apify_client import ApifyClient
import os

def extract():
    # Initialiser le client Apify avec API_KEY
    client = ApifyClient(os.environ["APIFY_API_TOKEN"])

    # Préparer les paramètres de recherche (Scraping de CIH Bank)
    run_input = {
        "searchStringsArray": ["CIH Bank"],
        "language": "fr",
        "maxCrawledPlacesPerSearch": 10, # Limite à 5 agences pour économiser
        "maxImages": 0,
        "maxReviews": 30, # Limite à 20 avis par agence
    }

    print("Démarrage du scraping sur Apify (cela peut prendre quelques minutes)...")
    # Lancer l'Actor et attendre qu'il termine
    run = client.actor("compass/crawler-google-places").call(run_input=run_input) 
    
    print("Scraping terminé. Récupération des données...")
    # Récupérer les résultats depuis le dataset créé par cette exécution
    dataset_items = client.dataset(run.default_dataset_id).list_items().items
    return dataset_items

if __name__ == "__main__":
    # Extraire les données via l'API
    api_data = extract()
    
    if api_data:
        # L'Actor Google Places retourne 1 ligne = 1 agence. 
        # Les avis sont dans une liste imbriquée. Il faut donc "aplatir" les données 
        # pour retrouver la structure attendue : 1 ligne = 1 avis.
        
        print(f"[EXTRACTION] {len(api_data)} agences récupérées depuis Apify.")
        
        all_reviews = []
        for place in api_data:
            title = place.get('title', '')
            city = place.get('city', '')
            address = place.get('address', '')
            phone = place.get('phoneUnformatted', place.get('phone', ''))
            
            reviews = place.get('reviews', [])
            if isinstance(reviews, list):
                print(f"[EXTRACTION] Agence '{title}' : {len(reviews)} avis trouvés.")
                for review in reviews:
                    # Essayer de récupérer le texte traduit, sinon le texte original
                    text_translated = review.get('textTranslated', review.get('text', ''))
                    published_at = review.get('publishedAtDate', '')
                    
                    all_reviews.append({
                        'title': title,
                        'city': city,
                        'address': address,
                        'phone': phone,
                        'textTranslated': text_translated,
                        'publishedAtDate': published_at
                    })
            else:
                print(f"[EXTRACTION] Agence '{title}' : aucun avis (reviews n'est pas une liste).")
        
        if all_reviews:
            # Création du DataFrame final aplati
            dataframe = pd.DataFrame(all_reviews)
            
            # Sauvegarde dans le volume monté /scripts (persistant entre les tâches)
            output_path = '/scripts/extracted_data.csv'
            dataframe.to_csv(output_path, index=False)
            print(f"[EXTRACTION] {len(dataframe)} avis extraits et sauvegardés dans {output_path}")
        else:
            print("[EXTRACTION] ERREUR : Aucun avis trouvé dans les agences récupérées.")
            raise SystemExit(1)
    else:
        print("[EXTRACTION] ERREUR : Aucune donnée récupérée depuis Apify.")
        raise SystemExit(1)