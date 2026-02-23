use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SchoolSettingsResponse {
    pub tenant_id: uuid::Uuid,
    pub school_name: String,
    pub school_code: String,
    pub passing_min_grade: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSchoolSettingsRequest {
    pub passing_min_grade: f64,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/school/settings", get(get_school_settings).put(update_school_settings))
        .with_state(state)
}

async fn get_school_settings(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<SchoolSettingsResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher", "staff"])?;

    let row = sqlx::query(
        r#"
        SELECT id, name, slug, passing_min_grade::float8 AS passing_min_grade
        FROM tenants
        WHERE id = $1
        "#,
    )
    .bind(user.tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;

    Ok(Json(SchoolSettingsResponse {
        tenant_id: row.get("id"),
        school_name: row.get("name"),
        school_code: row.get("slug"),
        passing_min_grade: row.get("passing_min_grade"),
    }))
}

async fn update_school_settings(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<UpdateSchoolSettingsRequest>,
) -> Result<Json<SchoolSettingsResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    if !(0.0..=10.0).contains(&req.passing_min_grade) {
        return Err((StatusCode::BAD_REQUEST, "Média mínima deve estar entre 0 e 10".into()));
    }

    let row = sqlx::query(
        r#"
        UPDATE tenants
        SET passing_min_grade = $2
        WHERE id = $1
        RETURNING id, name, slug, passing_min_grade::float8 AS passing_min_grade
        "#,
    )
    .bind(user.tenant_id)
    .bind(req.passing_min_grade)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;

    Ok(Json(SchoolSettingsResponse {
        tenant_id: row.get("id"),
        school_name: row.get("name"),
        school_code: row.get("slug"),
        passing_min_grade: row.get("passing_min_grade"),
    }))
}
