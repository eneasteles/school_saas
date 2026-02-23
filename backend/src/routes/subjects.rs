use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSubjectRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub code: Option<String>,
    pub teacher_user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AssignTeacherRequest {
    pub teacher_user_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct SubjectResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub code: Option<String>,
    pub teacher_user_id: Option<Uuid>,
    pub teacher_name: Option<String>,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/subjects", get(list_subjects).post(create_subject))
        .route("/subjects/:subject_id/teacher", put(assign_teacher))
        .with_state(state)
}

async fn list_subjects(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<SubjectResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT
          s.id,
          s.tenant_id,
          s.name,
          s.code,
          s.teacher_user_id,
          u.full_name AS teacher_name
        FROM subjects s
        LEFT JOIN users u
          ON u.id = s.teacher_user_id
         AND u.tenant_id = s.tenant_id
        WHERE s.tenant_id = $1
        ORDER BY s.name ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| SubjectResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            name: r.get("name"),
            code: r.get("code"),
            teacher_user_id: r.get("teacher_user_id"),
            teacher_name: r.get("teacher_name"),
        })
        .collect();

    Ok(Json(out))
}

async fn create_subject(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateSubjectRequest>,
) -> Result<Json<SubjectResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if let Some(teacher_id) = req.teacher_user_id {
        ensure_teacher_belongs_to_tenant(&state.pool, user.tenant_id, teacher_id).await?;
    }

    let id = Uuid::new_v4();
    let name = req.name.trim().to_string();
    let code = normalize_optional_text(req.code);

    let row = sqlx::query(
        r#"
        INSERT INTO subjects (id, tenant_id, name, code, teacher_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tenant_id, name, code, teacher_user_id
        "#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(&name)
    .bind(&code)
    .bind(req.teacher_user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    let teacher_name = if let Some(teacher_id) = req.teacher_user_id {
        teacher_name_by_id(&state.pool, user.tenant_id, teacher_id).await?
    } else {
        None
    };

    Ok(Json(SubjectResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        code: row.get("code"),
        teacher_user_id: row.get("teacher_user_id"),
        teacher_name,
    }))
}

async fn assign_teacher(
    State(state): State<AppState>,
    user: AuthUser,
    Path(subject_id): Path<Uuid>,
    Json(req): Json<AssignTeacherRequest>,
) -> Result<Json<SubjectResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    if let Some(teacher_id) = req.teacher_user_id {
        ensure_teacher_belongs_to_tenant(&state.pool, user.tenant_id, teacher_id).await?;
    }

    let row = sqlx::query(
        r#"
        UPDATE subjects
        SET teacher_user_id = $3
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, name, code, teacher_user_id
        "#,
    )
    .bind(user.tenant_id)
    .bind(subject_id)
    .bind(req.teacher_user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Disciplina não encontrada".into()))?;
    let teacher_user_id: Option<Uuid> = row.get("teacher_user_id");
    let teacher_name = if let Some(teacher_id) = teacher_user_id {
        teacher_name_by_id(&state.pool, user.tenant_id, teacher_id).await?
    } else {
        None
    };

    Ok(Json(SubjectResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        code: row.get("code"),
        teacher_user_id,
        teacher_name,
    }))
}

async fn ensure_teacher_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    teacher_user_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT 1
        FROM users
        WHERE tenant_id = $1
          AND id = $2
          AND role IN ('owner', 'admin', 'teacher')
        "#,
    )
    .bind(tenant_id)
    .bind(teacher_user_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Professor inválido para este tenant".into()));
    }

    Ok(())
}

async fn teacher_name_by_id(
    pool: &PgPool,
    tenant_id: Uuid,
    teacher_user_id: Uuid,
) -> Result<Option<String>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT full_name
           FROM users
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(teacher_user_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(row.map(|r| r.get("full_name")))
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}
