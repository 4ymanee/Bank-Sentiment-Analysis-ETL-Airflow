# 🏦 CIH Bank - Customer Reviews Analytics & ETL Pipeline (Airflow Version)

> **Plateforme d'analyse de sentiment et d'intelligence décisionnelle pour les avis clients CIH Bank en utilisant une architecture Medallion (Bronze / Silver / Gold), Apache Airflow, un modèle BERT Multilingue, FastAPI et un Dashboard React.**

---

> ℹ️ **Note sur l'orchestration** : Ce dépôt contient la version du pipeline orchestrée avec **Apache Airflow**. Une version alternative orchestrée avec **n8n** (No-Code / Low-Code Workflow Automation) est disponible sur le dépôt séparé : [Bank-Sentiment-Analysis-ETL-n8n](https://github.com/4ymanee/Bank-Sentiment-Analysis-ETL-n8n).

---

## 📌 Aperçu du Projet

Ce projet a pour objectif de collecter, nettoyer, analyser et visualiser automatiquement l'expérience client et la réputation en ligne des agences de la **CIH Bank** au Maroc.

Il extrait les avis Google Places via Apify, les transforme à travers un pipeline de données en 3 couches (Medallion Architecture), évalue le sentiment de chaque commentaire grâce au modèle de Deep Learning **BERT Multilingue**, puis alimente un backend FastAPI et un tableau de bord analytique React.

---

## 🏗️ Architecture du Pipeline de Données (Medallion Architecture)

```
[ Apify Crawler ] ──> (CSV)
                          │
                          ▼
            [ 🥉 BRONZE : Raw Data ]
        (Avis bruts Google Places, dédoublonnés)
                          │
                          ▼
            [ 🥈 SILVER : Cleaned & NLP ]
     (Nettoyage emojis/URLs + Sentiment BERT 1-5★)
                          │
                          ▼
            [ 🥇 GOLD : Business Analytics ]
     (Note moyenne par agence, classement, évolution)
                          │
         ┌────────────────┴────────────────┐
         ▼                                  ▼
[ ⚡ Backend FastAPI ]              [ 📊 Dashboard React ]
 (REST API REST & Aggregations)      (KPI Cards, Charts, Map)
```

1. **Extraction (Apify API)** : Scraping automatique des avis et notes des agences CIH Bank sur Google Places.
2. **Couche Bronze (`bronze.raw_reviews`)** : Stockage des données brutes avec gestion d'unicité `ON CONFLICT DO NOTHING`.
3. **Couche Silver (`silver.cleaned_reviews`)** : 
   - Nettoyage poussé du texte (suppression emojis, URLs, espaces multiples, bruit).
   - Inférence NLP via le modèle **BERT** (`nlptown/bert-base-multilingual-uncased-sentiment`) attribuant une note de sentiment de 1 à 5 étoiles.
   - Optimisation incremental load (`WHERE s.id IS NULL`).
4. **Couche Gold (`gold.agence_stats` & `gold.sentiment_evolution`)** :
   - Consolidated KPIs (note moyenne, volume d'avis, ratio avis positifs/négatifs, classement inter-agences).
   - Suivi mensuel de l'évolution temporelle de la satisfaction client.

---

## 🛠️ Stack Technique

* **Orchestration** : Apache Airflow 2.x (LocalExecutor)
* **Scraping** : Apify Client (Google Places Crawler Actor)
* **Traitement & NLP** : Python 3.10+, Pandas, PyTorch, HuggingFace Transformers (BERT)
* **Base de Données** : PostgreSQL 13 (Schémas `bronze`, `silver`, `gold`)
* **Backend API** : FastAPI, Uvicorn, Psycopg2
* **Frontend** : React 18, Chart.js / Recharts, Tailwind CSS / Vanilla Glassmorphism
* **Conteneurisation** : Docker, Docker Compose

---

## 📁 Structure du Projet

```
.
├── dags/                           # DAGs Apache Airflow
│   ├── init_dag.py                 # Initialisation des schémas SQL
│   └── load_dag.py                 # DAG du Pipeline ETL complet
├── Scripts/                        # Scripts de traitement de données
│   ├── extraction.py               # Extraction via Apify API
│   ├── Bronze/
│   │   ├── init_bronze.sql
│   │   └── load_bronze.py
│   ├── Silver/
│   │   ├── init_silver.sql
│   │   └── load_silver.py
│   ├── Gold/
│   │   ├── init_gold.sql
│   │   └── load_gold.py
│   └── models/                     # Modèle BERT (HuggingFace)
├── Dashboard/
│   ├── Backend/                    # API FastAPI
│   │   ├── main.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── Frontend/                   # Application React Dashboard
│       ├── src/
│       ├── public/
│       └── package.json
├── docker-compose.yaml             # Orchestration complète des services
├── Dockerfile                      # Image Docker personnalisée Airflow + PyTorch
├── .env.example                    # Modèle de variables d'environnement
└── README.md
```

---

## 🚀 Installation & Démarrage Rapide

### Prérequis
* [Docker Desktop](https://www.docker.com/products/docker-desktop) et Docker Compose installés.
* Une clé d'API [Apify Token](https://apify.com/).

### 1. Cloner le projet
```bash
git clone https://github.com/4ymanee/Bank-Sentiment-Analysis-ETL-Airflow.git
cd Bank-Sentiment-Analysis-ETL-Airflow
```

### 2. Configurer l'environnement
Copiez le fichier exemple `.env.example` vers `.env` et renseignez votre token Apify :
```bash
cp .env.example .env
```
Éditez le fichier `.env` :
```env
APIFY_API_TOKEN=votre_cle_apify_ici
AIRFLOW_UID=50000
```

### 3. Lancer l'ensemble des services avec Docker Compose
```bash
docker-compose up --build -d
```

### 4. Lancement en Mode Développement (Local)
Si vous préférez lancer le Frontend et le Backend localement sans passer par Docker pour le développement :

#### A. Lancer la Base de Données (PostgreSQL) uniquement
```bash
docker-compose up db -d
```

#### B. Démarrer le Backend FastAPI
1. Rendez-vous dans le dossier Backend :
   ```bash
   cd Dashboard/Backend
   ```
2. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
3. Lancez le serveur :
   ```bash
   uvicorn main:app --reload --port 8000
   ```

#### C. Démarrer le Frontend React
1. Rendez-vous dans le dossier Frontend :
   ```bash
   cd ../Frontend
   ```
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Lancez le serveur de développement :
   ```bash
   npm start
   ```

---

## 🌐 URLs d'Accès aux Services

| Service | URL | Identifiants |
| :--- | :--- | :--- |
| **Dashboard React** | [http://localhost:3000](http://localhost:3000) | - |
| **Backend FastAPI (Docs)** | [http://localhost:8000/docs](http://localhost:8000/docs) | - |
| **Airflow Webserver** | [http://localhost:8080](http://localhost:8080) | `admin` / `admin` |
| **PostgreSQL CIH** | `localhost:5433` (DB: `CIH_Bank`) | `root` / `root` |

---

## 🔄 Exécution du DAG Airflow

1. Accédez à l'interface Airflow sur `http://localhost:8080`.
2. Activez et déclenchez le DAG **`Pipeline_ETL_CIH_Bank`**.
3. Observez l'exécution séquentielle des 4 étapes :
   `extract` ➔ `load_bronze` ➔ `load_silver` ➔ `load_gold`.

---

## 👤 Auteur

* **Aymane El Idrissi**
* GitHub : [@4ymanee](https://github.com/4ymanee)
