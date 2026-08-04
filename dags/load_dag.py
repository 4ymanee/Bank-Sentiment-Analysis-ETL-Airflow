from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

# ─── Arguments par défaut ─────────────────────────────────────────────────────
default_args = {
    'owner': 'Aymane',
    'email': ['[EMAIL_ADDRESS]'],
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# ─── DAG ──────────────────────────────────────────────────────────────────────
dag = DAG(
    'Pipeline_ETL_CIH_Bank',
    default_args=default_args,
    description='Pipeline ETL CIH Bank — Extract / Bronze / Silver / Gold',
    start_date=datetime(2026, 6, 15, 2),
    schedule_interval='@daily',
    catchup=False,
)

# ─── EXTRACTION ───────────────────────────────────────────────────────────────
extract = BashOperator(
    task_id='extract',
    bash_command='python /scripts/extraction.py',
    dag=dag,
)

# ─── BRONZE ───────────────────────────────────────────────────────────────────
load_bronze = BashOperator(
    task_id='load_bronze',
    bash_command='python /scripts/Bronze/load_bronze.py',
    dag=dag,
)

# ─── SILVER ───────────────────────────────────────────────────────────────────
load_silver = BashOperator(
    task_id='load_silver',
    bash_command='python /scripts/Silver/load_silver.py',
    dag=dag,
)

# ─── GOLD ─────────────────────────────────────────────────────────────────────
load_gold = BashOperator(
    task_id='load_gold',
    bash_command='python /scripts/Gold/load_gold.py',
    dag=dag,
)

# ─── Pipeline ─────────────────────────────────────────────────────────────────
#
#   extract >> load_bronze >> load_silver >> load_gold
#
extract >> load_bronze >> load_silver >> load_gold
