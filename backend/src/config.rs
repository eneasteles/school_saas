use std::env;

/// Config do app. Mantém tudo centralizado e fácil de testar.
#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub platform_admin_email: String,
    pub platform_admin_password: String,
    pub bind_addr: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        // Carrega .env se existir
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL").expect("DATABASE_URL não definido");
        let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET não definido");
        let platform_admin_email = env::var("PLATFORM_ADMIN_EMAIL")
            .unwrap_or_else(|_| "admin@platform.local".to_string());
        let platform_admin_password = env::var("PLATFORM_ADMIN_PASSWORD")
            .unwrap_or_else(|_| "admin123456".to_string());
        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3333".to_string());

        Self {
            database_url,
            jwt_secret,
            platform_admin_email,
            platform_admin_password,
            bind_addr,
        }
    }
}
