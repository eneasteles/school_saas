mod config;
mod db;
mod routes;
mod models;
mod auth;
mod state;

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
        .merge(routes::platform_auth::routes(
            cfg.jwt_secret.clone(),
            cfg.platform_admin_email.clone(),
            cfg.platform_admin_password.clone(),
        ))
        .merge(routes::admin::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::dashboard::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::teachers::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::session::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::school_settings::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::subjects::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::terms::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::records::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::students::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::classes::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::guardians::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::people::routes(pool.clone(), cfg.jwt_secret.clone()))
        .merge(routes::financial::routes(pool.clone(), cfg.jwt_secret.clone()))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr)
        .await
        .expect("Falha ao bind");

    tracing::info!("API rodando em http://{}", cfg.bind_addr);

    axum::serve(listener, app).await.expect("Erro no server");
}
