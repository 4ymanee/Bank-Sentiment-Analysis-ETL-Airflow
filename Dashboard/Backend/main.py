import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import date
from pydantic import BaseModel

app = FastAPI(title="CIH Reviews Analytics API", version="1.0.0")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DATABASE CONFIGURATION ──────────────────────────────────────────────────
DB_NAME = os.environ.get('DB_NAME', 'CIH_Bank')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'root')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5433')  # Using 5433 for host, will use 5432 in docker

def get_db_connection():
    # If inside docker, the host might be postgres-cih. Let's try to connect.
    host = os.environ.get('DB_HOST', 'postgres-cih')
    port = os.environ.get('DB_PORT', '5432')
    try:
        conn = psycopg2.connect(
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=host,
            port=port,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        # Fallback to localhost if host connection fails (e.g. running locally outside docker network)
        try:
            conn = psycopg2.connect(
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT,
                cursor_factory=RealDictCursor
            )
            return conn
        except Exception as err:
            print(f"Database connection error: {err}")
            raise HTTPException(status_code=500, detail="Database connection failed")

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
def apply_filters(query: str, params: list, city: Optional[str], agency: Optional[str],
                  start_date: Optional[str], end_date: Optional[str], sentiment: Optional[str],
                  rating: Optional[int], table_prefix: str = "r"):
    
    # Map fields dynamically depending on table prefix
    city_field = f"{table_prefix}.city"
    agency_field = f"{table_prefix}.title" if table_prefix == "r" else f"{table_prefix}.agence"
    date_field = f"{table_prefix}.published_at"
    sentiment_field = f"{table_prefix}.sentiment"
    
    if city:
        query += f" AND {city_field} = %s"
        params.append(city)
    if agency:
        query += f" AND {agency_field} = %s"
        params.append(agency)
    if start_date:
        query += f" AND {date_field} >= %s"
        params.append(start_date)
    if end_date:
        query += f" AND {date_field} <= %s"
        params.append(end_date)
    if rating:
        query += f" AND {sentiment_field} = %s"
        params.append(rating)
    if sentiment:
        if sentiment.lower() == "positive":
            query += f" AND {sentiment_field} >= 4"
        elif sentiment.lower() == "negative":
            query += f" AND {sentiment_field} <= 2"
        elif sentiment.lower() == "neutral":
            query += f" AND {sentiment_field} = 3"
            
    return query, params

# ─── API ENDPOINTS ───────────────────────────────────────────────────────────

@app.get("/api/filters")
def get_filters():
    """Retrieve lists of available cities and agencies for filtering."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Get unique cities
        cur.execute("SELECT DISTINCT city FROM silver.cleaned_reviews WHERE city IS NOT NULL ORDER BY city")
        cities = [row["city"] for row in cur.fetchall()]
        
        # Get unique agencies
        cur.execute("SELECT DISTINCT title FROM silver.cleaned_reviews WHERE title IS NOT NULL ORDER BY title")
        agencies = [row["title"] for row in cur.fetchall()]
        
        return {"cities": cities, "agencies": agencies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/stats")
def get_stats(
    city: Optional[str] = None,
    agency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sentiment: Optional[str] = None,
    rating: Optional[int] = None
):
    """Retrieve key metrics (total, rating, positive, negative, sentiment score) based on filters."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        base_query = """
            SELECT 
                COUNT(*) as total_reviews,
                COALESCE(ROUND(AVG(sentiment)::numeric, 2), 0) as average_rating,
                COUNT(*) FILTER (WHERE sentiment >= 4) as positive_reviews,
                COUNT(*) FILTER (WHERE sentiment <= 2) as negative_reviews,
                COUNT(*) FILTER (WHERE sentiment = 3) as neutral_reviews
            FROM silver.cleaned_reviews r
            WHERE 1=1
        """
        params = []
        filtered_query, params = apply_filters(base_query, params, city, agency, start_date, end_date, sentiment, rating, "r")
        
        cur.execute(filtered_query, params)
        res = cur.fetchone()
        
        # Determine average sentiment label
        avg_rating = float(res["average_rating"])
        if avg_rating >= 4.0:
            avg_sentiment_lbl = "Very Satisfied"
        elif avg_rating >= 3.5:
            avg_sentiment_lbl = "Satisfied"
        elif avg_rating >= 2.5:
            avg_sentiment_lbl = "Neutral"
        elif avg_rating >= 1.5:
            avg_sentiment_lbl = "Dissatisfied"
        else:
            avg_sentiment_lbl = "Highly Dissatisfied"
            
        return {
            "total_reviews": res["total_reviews"],
            "average_rating": avg_rating,
            "positive_reviews": res["positive_reviews"],
            "negative_reviews": res["negative_reviews"],
            "neutral_reviews": res["neutral_reviews"],
            "average_sentiment_label": avg_sentiment_lbl
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/trends")
def get_trends(
    city: Optional[str] = None,
    agency: Optional[str] = None
):
    """Retrieve monthly sentiment and review count trends using gold.sentiment_evolution and gold.agence_stats."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # We join with gold.agence_stats to retrieve city classification if we filter by city
        base_query = """
            SELECT 
                se.annee, 
                se.mois, 
                COALESCE(ROUND(AVG(se.note_moyenne_mois)::numeric, 2), 0) as note_moyenne,
                SUM(se.nb_avis_mois)::int as nb_avis
            FROM gold.sentiment_evolution se
            LEFT JOIN (SELECT DISTINCT agence, city FROM gold.agence_stats) ag ON se.agence = ag.agence
            WHERE 1=1
        """
        params = []
        if city:
            base_query += " AND ag.city = %s"
            params.append(city)
        if agency:
            base_query += " AND se.agence = %s"
            params.append(agency)
            
        base_query += """
            GROUP BY se.annee, se.mois
            ORDER BY se.annee ASC, se.mois ASC
        """
        
        cur.execute(base_query, params)
        rows = cur.fetchall()
        
        # Format date for frontend charts (e.g. "2026-06" or "June 2026")
        months_map = {
            1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
            7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
        }
        
        formatted_trends = []
        for row in rows:
            formatted_trends.append({
                "period": f"{months_map.get(row['mois'], str(row['mois']))} {row['annee']}",
                "rating": float(row["note_moyenne"]),
                "count": row["nb_avis"],
                "year": row["annee"],
                "month": row["mois"]
            })
            
        return formatted_trends
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/distribution")
def get_distribution(
    city: Optional[str] = None,
    agency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sentiment: Optional[str] = None,
    rating: Optional[int] = None
):
    """Retrieve the counts for each star rating (1 to 5) for review distribution chart."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        base_query = """
            SELECT sentiment as stars, COUNT(*)::int as count
            FROM silver.cleaned_reviews r
            WHERE 1=1
        """
        params = []
        filtered_query, params = apply_filters(base_query, params, city, agency, start_date, end_date, sentiment, rating, "r")
        filtered_query += " GROUP BY sentiment ORDER BY sentiment DESC"
        
        cur.execute(filtered_query, params)
        rows = cur.fetchall()
        
        # Format response so all ratings 1-5 exist
        dist_dict = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for row in rows:
            dist_dict[row["stars"]] = row["count"]
            
        formatted_dist = [{"stars": f"{k} Stars", "count": v, "rating": k} for k, v in dist_dict.items()]
        return formatted_dist
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/agencies")
def get_agencies(city: Optional[str] = None):
    """Retrieve ranked agencies with their metadata from gold.agence_stats."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT agence, city, address, phone, 
                   note_moyenne, nb_avis, nb_positifs, nb_negatifs, classement
            FROM gold.agence_stats
            WHERE 1=1
        """
        params = []
        if city:
            query += " AND city = %s"
            params.append(city)
            
        query += " ORDER BY note_moyenne DESC, nb_avis DESC"
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        # Convert Decimal values for JSON response
        formatted_rows = []
        for r in rows:
            formatted_rows.append({
                "agence": r["agence"],
                "city": r["city"],
                "address": r["address"],
                "phone": r["phone"],
                "note_moyenne": float(r["note_moyenne"]),
                "nb_avis": r["nb_avis"],
                "nb_positifs": r["nb_positifs"],
                "nb_negatifs": r["nb_negatifs"],
                "classement": r["classement"]
            })
            
        return formatted_rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/reviews")
def get_reviews(
    city: Optional[str] = None,
    agency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sentiment: Optional[str] = None,
    rating: Optional[int] = None,
    page: int = 1,
    limit: int = 10
):
    """Retrieve a list of individual customer reviews with dynamic filters and pagination."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        base_query = """
            SELECT id, title as agence, city, address, phone, commentaire, published_at, sentiment
            FROM silver.cleaned_reviews r
            WHERE 1=1
        """
        params = []
        filtered_query, params = apply_filters(base_query, params, city, agency, start_date, end_date, sentiment, rating, "r")
        
        # Get total count first
        count_query = f"SELECT COUNT(*) FROM ({filtered_query}) as temp"
        cur.execute(count_query, params)
        total_count = cur.fetchone()["count"]
        
        # Add pagination
        offset = (page - 1) * limit
        filtered_query += " ORDER BY published_at DESC, id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(filtered_query, params)
        rows = cur.fetchall()
        
        # Format response
        formatted_reviews = []
        for r in rows:
            # Clean possible unicode issues
            comment = r["commentaire"]
            if comment:
                comment = comment.replace('\xa0', ' ') # basic sanitize
            
            # Categorize sentiment label
            sent = r["sentiment"]
            if sent >= 4:
                sent_lbl = "Positive"
            elif sent <= 2:
                sent_lbl = "Negative"
            else:
                sent_lbl = "Neutral"
                
            formatted_reviews.append({
                "id": r["id"],
                "agence": r["agence"],
                "city": r["city"],
                "address": r["address"],
                "phone": r["phone"],
                "commentaire": comment,
                "published_at": r["published_at"].isoformat() if isinstance(r["published_at"], date) else r["published_at"],
                "rating": sent,
                "sentiment_label": sent_lbl
            })
            
        return {
            "total": total_count,
            "page": page,
            "limit": limit,
            "reviews": formatted_reviews
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    # When running directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
