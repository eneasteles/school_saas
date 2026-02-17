mod config;
mod db;
mod routes;
mod models;

use axum::http::Method;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let cfg = config::AppConfig::from_env();

    let pool = db::make_pool(&cfg.database_url).await;
    db::run_migrations(&pool).await;

    // ✅ CORS (dev). Em VPS/produção, depois vamos restringir ao domínio do frontend.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    // ✅ Router: mantém seu padrão atual
    let app = Router::new()
        .merge(routes::health::routes())
        .merge(routes::auth::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::students::routes(pool.clone()))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr)
        .await
        .expect("Falha ao bind");

    tracing::info!("API rodando em http://{}", cfg.bind_addr);

    axum::serve(listener, app).await.expect("Erro no server");
}
