use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SessionMeResponse {
    pub tenant_id: Uuid,
    pub school_name: String,
    pub school_code: String,
    pub role: String,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new().route("/auth/me", get(me)).with_state(state)
}

async fn me(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<SessionMeResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT name, slug
        FROM tenants
        WHERE id = $1
        "#,
    )
    .bind(user.tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;

    Ok(Json(SessionMeResponse {
        tenant_id: user.tenant_id,
        school_name: row.get("name"),
        school_code: row.get("slug"),
        role: user.role,
    }))
}
