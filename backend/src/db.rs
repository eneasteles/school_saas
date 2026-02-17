use sqlx::{PgPool, postgres::PgPoolOptions};

/// Cria pool do Postgres (conexões reutilizáveis)
pub async fn make_pool(database_url: &str) -> PgPool {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .expect("Falha ao conectar no Postgres")
}

/// Aplica migrations SQL automaticamente na inicialização.
/// Isso te dá “deploy fácil” em Docker/produção.
pub async fn run_migrations(pool: &PgPool) {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .expect("Falha ao rodar migrations");
}
