use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use jsonwebtoken::{encode, EncodingKey, Header};
use sqlx::Row;

#[derive(Clone)]
pub struct AuthState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 2))]
    pub school_name: String,

    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 1))]
    pub password: String,

    // No nosso SaaS, email é único por tenant, então precisamos do tenant_id
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,        // user_id
    tenant_id: String,  // tenant_id
    role: String,
    exp: usize,         // expiração
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AuthState { pool, jwt_secret };

    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .with_state(state)
}

async fn register(
    State(state): State<AuthState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // Gera salt e hash Argon2
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao gerar hash".into()))?
        .to_string();

    // Transação: cria tenant + cria owner
    let mut tx = state.pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(r#"INSERT INTO tenants (id, name) VALUES ($1, $2)"#)
    .bind(tenant_id)
    .bind(req.school_name.clone())
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro criando escola: {e}")))?;


    sqlx::query(
    r#"INSERT INTO users (id, tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(req.email.clone())
    .bind(password_hash)
    .bind("owner")
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro criando usuário: {e}")))?;


    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro commit".into()))?;

    let token = make_jwt(&state.jwt_secret, user_id, tenant_id, "owner")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro token".into()))?;

    Ok(Json(AuthResponse {
        tenant_id,
        user_id,
        token,
    }))
}

async fn login(
    State(state): State<AuthState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let row = sqlx::query(
    r#"SELECT id, password_hash, role
       FROM users
       WHERE tenant_id = $1 AND email = $2"#,
    )
    .bind(req.tenant_id)
    .bind(req.email.clone())
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;


    let row = row.ok_or((StatusCode::UNAUTHORIZED, "Credenciais inválidas".into()))?;
    let user_id: Uuid = row.get("id");
    let password_hash_db: String = row.get("password_hash");
    let role: String = row.get("role");

    // Verifica senha Argon2
    let parsed_hash = PasswordHash::new(&password_hash_db)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hash inválido".into()))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Credenciais inválidas".into()))?;

    let token = make_jwt(&state.jwt_secret, user_id, req.tenant_id, &role)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro token".into()))?;

    Ok(Json(AuthResponse {
        tenant_id: req.tenant_id,
        user_id,
        token,
    }))
}

fn make_jwt(jwt_secret: &str, user_id: Uuid, tenant_id: Uuid, role: &str) -> Result<String, ()> {
    // 7 dias em segundos
    let exp = (chrono::Utc::now() + chrono::Duration::days(7)).timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id: tenant_id.to_string(),
        role: role.to_string(),
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .map_err(|_| ())
}
