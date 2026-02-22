use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;

#[derive(Clone)]
pub struct ClassesState {
    pub pool: PgPool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateClassRequest {
    #[validate(length(min = 1))]
    pub name: String,   // ex: "Turma A"
    #[validate(length(min = 1))]
    pub grade: String,  // ex: "1º ano"
    pub year: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ClassResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub grade: String,
    pub year: i32,
}

#[derive(Serialize)]
pub struct OkResponse { pub ok: bool }

pub fn routes(pool: PgPool) -> Router {
    let state = ClassesState { pool };

    Router::new()
        .route("/classes", post(create_class).get(list_classes))
        .route("/classes/:class_id", delete(delete_class))
        .with_state(state)
}

async fn create_class(
    State(state): State<ClassesState>,
    user: AuthUser,
    Json(req): Json<CreateClassRequest>,
) -> Result<Json<ClassResponse>, (StatusCode, String)> {
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let id = Uuid::new_v4();
    let year = req.year.unwrap_or_else(|| chrono::Utc::now().year());

    sqlx::query(
        r#"INSERT INTO classes (id, tenant_id, name, grade, year)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(req.name.trim())
    .bind(req.grade.trim())
    .bind(year)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    Ok(Json(ClassResponse {
        id,
        tenant_id: user.tenant_id,
        name: req.name,
        grade: req.grade,
        year,
    }))
}

async fn list_classes(
    State(state): State<ClassesState>,
    user: AuthUser,
) -> Result<Json<Vec<ClassResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"SELECT id, tenant_id, name, grade, year
           FROM classes
           WHERE tenant_id = $1
           ORDER BY year DESC, grade ASC, name ASC"#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| ClassResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            name: r.get("name"),
            grade: r.get("grade"),
            year: r.get("year"),
        })
        .collect();

    Ok(Json(out))
}

async fn delete_class(
    State(state): State<ClassesState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    let res = sqlx::query(
        r#"DELETE FROM classes
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Turma não encontrada".into()));
    }

    Ok(Json(OkResponse { ok: true }))
}
