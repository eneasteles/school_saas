use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTermRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub school_year: i32,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct TermResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub school_year: i32,
    pub sort_order: i32,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTermRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub school_year: i32,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTermStatusRequest {
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/terms", get(list_terms).post(create_term))
        .route("/terms/:term_id", put(update_term).delete(delete_term))
        .route("/terms/:term_id/status", put(update_term_status))
        .with_state(state)
}

async fn list_terms(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<TermResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT id, tenant_id, name, school_year, sort_order, is_active
        FROM academic_terms
        WHERE tenant_id = $1
        ORDER BY school_year DESC, sort_order ASC, name ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| TermResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            name: r.get("name"),
            school_year: r.get("school_year"),
            sort_order: r.get("sort_order"),
            is_active: r.get("is_active"),
        })
        .collect();

    Ok(Json(out))
}

async fn create_term(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateTermRequest>,
) -> Result<Json<TermResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if req.school_year < 2000 || req.school_year > 2100 {
        return Err((StatusCode::BAD_REQUEST, "school_year inválido".into()));
    }

    let id = Uuid::new_v4();
    let name = req.name.trim().to_string();
    let sort_order = req.sort_order.unwrap_or(1);

    let row = sqlx::query(
        r#"
        INSERT INTO academic_terms (id, tenant_id, name, school_year, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id, tenant_id, name, school_year, sort_order, is_active
        "#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(&name)
    .bind(req.school_year)
    .bind(sort_order)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    Ok(Json(TermResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        school_year: row.get("school_year"),
        sort_order: row.get("sort_order"),
        is_active: row.get("is_active"),
    }))
}

async fn update_term(
    State(state): State<AppState>,
    user: AuthUser,
    Path(term_id): Path<Uuid>,
    Json(req): Json<UpdateTermRequest>,
) -> Result<Json<TermResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if req.school_year < 2000 || req.school_year > 2100 {
        return Err((StatusCode::BAD_REQUEST, "school_year inválido".into()));
    }

    let name = req.name.trim().to_string();
    let sort_order = req.sort_order.unwrap_or(1);
    if sort_order < 1 {
        return Err((StatusCode::BAD_REQUEST, "sort_order inválido".into()));
    }

    let row = sqlx::query(
        r#"
        UPDATE academic_terms
           SET name = $3,
               school_year = $4,
               sort_order = $5
         WHERE tenant_id = $1
           AND id = $2
         RETURNING id, tenant_id, name, school_year, sort_order, is_active
        "#,
    )
    .bind(user.tenant_id)
    .bind(term_id)
    .bind(&name)
    .bind(req.school_year)
    .bind(sort_order)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Período não encontrado".into()))?;

    Ok(Json(TermResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        school_year: row.get("school_year"),
        sort_order: row.get("sort_order"),
        is_active: row.get("is_active"),
    }))
}

async fn update_term_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(term_id): Path<Uuid>,
    Json(req): Json<UpdateTermStatusRequest>,
) -> Result<Json<TermResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let row = sqlx::query(
        r#"
        UPDATE academic_terms
           SET is_active = $3
         WHERE tenant_id = $1
           AND id = $2
         RETURNING id, tenant_id, name, school_year, sort_order, is_active
        "#,
    )
    .bind(user.tenant_id)
    .bind(term_id)
    .bind(req.is_active)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Período não encontrado".into()))?;

    Ok(Json(TermResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        school_year: row.get("school_year"),
        sort_order: row.get("sort_order"),
        is_active: row.get("is_active"),
    }))
}

async fn delete_term(
    State(state): State<AppState>,
    user: AuthUser,
    Path(term_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let usage_count: i64 = sqlx::query(
        r#"
        SELECT COUNT(*) AS count
        FROM student_grades
        WHERE tenant_id = $1
          AND term_id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(term_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
    .get("count");

    if usage_count > 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Período já usado no boletim. Desabilite em vez de excluir.".into(),
        ));
    }

    let result = sqlx::query(
        r#"
        DELETE FROM academic_terms
        WHERE tenant_id = $1
          AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(term_id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Período não encontrado".into()));
    }

    Ok(Json(OkResponse { ok: true }))
}
