FROM apache/airflow:2.9.1

# Installer les dépendances Python du projet
RUN pip install --no-cache-dir \
    pandas \
    psycopg2-binary \
    apify-client \
    transformers \
    sentencepiece \
    torch \
    --extra-index-url https://download.pytorch.org/whl/cpu
