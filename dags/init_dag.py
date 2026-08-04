from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.postgres.operators.postgres import PostgresOperator

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
    'Initialisation_DB',
    default_args=default_args,
    description='Initialisation des schémas Bronze / Silver / Gold — à lancer une seule fois',
    start_date=datetime(2026, 6, 15, 2),
    schedule_interval=None,   # Manuel uniquement
    catchup=False,
    template_searchpath=['/'],
)

# ─── Tâches ───────────────────────────────────────────────────────────────────
init_bronze = PostgresOperator(
    task_id='init_bronze',
    postgres_conn_id='cih_bank_postgres',
    sql='/scripts/Bronze/init_bronze.sql',
    dag=dag,
)

init_silver = PostgresOperator(
    task_id='init_silver',
    postgres_conn_id='cih_bank_postgres',
    sql='/scripts/Silver/init_silver.sql',
    dag=dag,
)

init_gold = PostgresOperator(
    task_id='init_gold',
    postgres_conn_id='cih_bank_postgres',
    sql='/scripts/Gold/init_gold.sql',
    dag=dag,
)

# ─── Pipeline ─────────────────────────────────────────────────────────────────
init_bronze >> init_silver >> init_gold
