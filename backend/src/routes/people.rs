use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListPeopleQuery {
    pub person_type: Option<String>,
    pub q: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePersonRequest {
    #[validate(length(min = 2))]
    pub full_name: String,
    #[validate(length(min = 3))]
    pub person_type: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePersonRequest {
    #[validate(length(min = 2))]
    pub full_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct PersonResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub person_type: String,
    pub role_codes: Vec<String>,
    pub full_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct RoleInputRequest {
    pub role_code: String,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/people", get(list_people).post(create_person))
        .route("/people/:person_id", axum::routing::put(update_person).delete(delete_person))
        .route("/people/:person_id/roles", axum::routing::post(add_role))
        .route("/people/:person_id/roles/:role_code", axum::routing::delete(remove_role))
        .with_state(state)
}

async fn list_people(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ListPeopleQuery>,
) -> Result<Json<Vec<PersonResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher", "staff"])?;

    let person_type = query.person_type.map(|v| v.trim().to_lowercase());
    let search = query.q.map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty());

    let rows = sqlx::query(
        r#"
        SELECT
          p.id,
          p.tenant_id,
          p.person_type,
          p.full_name,
          p.email,
          p.phone,
          p.document,
          p.notes,
          p.is_active,
          COALESCE(
            ARRAY_AGG(pr.role_code ORDER BY pr.role_code) FILTER (WHERE pr.role_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS role_codes
        FROM people p
        LEFT JOIN person_roles pr ON pr.person_id = p.id
        WHERE p.tenant_id = $1
          AND (
                $2::text IS NULL
             OR EXISTS (
                SELECT 1
                FROM person_roles prf
                WHERE prf.person_id = p.id AND prf.role_code = $2
             )
          )
          AND ($3::boolean IS NULL OR p.is_active = $3)
          AND (
                $4::text IS NULL
             OR lower(p.full_name) LIKE ('%' || $4 || '%')
             OR lower(COALESCE(p.email, '')) LIKE ('%' || $4 || '%')
             OR lower(COALESCE(p.document, '')) LIKE ('%' || $4 || '%')
          )
        GROUP BY p.id, p.tenant_id, p.person_type, p.full_name, p.email, p.phone, p.document, p.notes, p.is_active
        ORDER BY lower(p.full_name) ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_type)
    .bind(query.is_active)
    .bind(search)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(rows.into_iter().map(map_person_row).collect()))
}

async fn create_person(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreatePersonRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let person_type = normalize_person_type(&req.person_type)?;

    let full_name = req.full_name.trim().to_string();
    let email = normalize_optional_text(req.email);
    let phone = normalize_optional_text(req.phone);
    let document = normalize_optional_text(req.document);
    let notes = normalize_optional_text(req.notes);
    let is_active = req.is_active.unwrap_or(true);

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person_id = if let Some(existing_id) = find_existing_person_id(
        &mut tx,
        user.tenant_id,
        email.as_deref(),
        document.as_deref(),
        Some(full_name.as_str()),
        phone.as_deref(),
    )
    .await?
    {
        sqlx::query(
            r#"
            UPDATE people
            SET full_name = $3,
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                document = COALESCE($6, document),
                notes = COALESCE($7, notes),
                is_active = $8
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(existing_id)
        .bind(&full_name)
        .bind(&email)
        .bind(&phone)
        .bind(&document)
        .bind(&notes)
        .bind(is_active)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        existing_id
    } else {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO people (id, tenant_id, person_type, full_name, email, phone, document, notes, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(id)
        .bind(user.tenant_id)
        .bind(person_type)
        .bind(&full_name)
        .bind(&email)
        .bind(&phone)
        .bind(&document)
        .bind(&notes)
        .bind(is_active)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        id
    };

    add_person_role(&mut tx, person_id, person_type).await?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person = fetch_person_response(&state.pool, user.tenant_id, person_id).await?;
    Ok(Json(person))
}

async fn update_person(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Json(req): Json<UpdatePersonRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let row = sqlx::query(
        r#"
        UPDATE people
        SET full_name = $3,
            email = $4,
            phone = $5,
            document = $6,
            notes = $7,
            is_active = $8
        WHERE tenant_id = $1 AND id = $2
        RETURNING id
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(req.full_name.trim().to_string())
    .bind(normalize_optional_text(req.email))
    .bind(normalize_optional_text(req.phone))
    .bind(normalize_optional_text(req.document))
    .bind(normalize_optional_text(req.notes))
    .bind(req.is_active)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    if row.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    let person = fetch_person_response(&state.pool, user.tenant_id, person_id).await?;
    Ok(Json(person))
}

async fn delete_person(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let linked_user = sqlx::query("SELECT 1 FROM users WHERE tenant_id = $1 AND person_id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    if linked_user.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Cadastro vinculado a usuário/professor. Remova no módulo específico.".into()));
    }

    let linked_student = sqlx::query("SELECT 1 FROM students WHERE tenant_id = $1 AND person_id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    if linked_student.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Cadastro vinculado a aluno. Remova no módulo Alunos.".into()));
    }

    let linked_guardian = sqlx::query("SELECT 1 FROM guardians WHERE tenant_id = $1 AND person_id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    if linked_guardian.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Cadastro vinculado a responsável. Remova no módulo Resp. Vinculados.".into()));
    }

    let res = sqlx::query("DELETE FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn add_role(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Json(req): Json<RoleInputRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    let role_code = normalize_person_type(&req.role_code)?;

    let exists = sqlx::query("SELECT 1 FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    add_person_role(&mut tx, person_id, role_code).await?;

    sqlx::query(
        r#"
        UPDATE people
        SET person_type = $3
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(role_code)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    fetch_person_response(&state.pool, user.tenant_id, person_id)
        .await
        .map(Json)
}

async fn remove_role(
    State(state): State<AppState>,
    user: AuthUser,
    Path((person_id, role_code_raw)): Path<(Uuid, String)>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    let role_code = normalize_person_type(&role_code_raw)?;

    let exists = sqlx::query("SELECT 1 FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    ensure_role_can_be_removed(&state.pool, user.tenant_id, person_id, role_code).await?;

    let count_row = sqlx::query(
        r#"SELECT COUNT(*)::int AS c FROM person_roles WHERE person_id = $1"#,
    )
    .bind(person_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let role_count: i32 = count_row.get("c");
    if role_count <= 1 {
        return Err((StatusCode::BAD_REQUEST, "A pessoa precisa manter pelo menos um papel".into()));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let removed = sqlx::query(
        r#"DELETE FROM person_roles WHERE person_id = $1 AND role_code = $2"#,
    )
    .bind(person_id)
    .bind(role_code)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if removed.rows_affected() == 0 {
        return Err((StatusCode::BAD_REQUEST, "Papel não estava associado à pessoa".into()));
    }

    let first_role = sqlx::query(
        r#"SELECT role_code FROM person_roles WHERE person_id = $1 ORDER BY role_code ASC LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if let Some(row) = first_role {
        let fallback_role: String = row.get("role_code");
        sqlx::query(
            r#"UPDATE people SET person_type = $3 WHERE tenant_id = $1 AND id = $2"#,
        )
        .bind(user.tenant_id)
        .bind(person_id)
        .bind(fallback_role)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    fetch_person_response(&state.pool, user.tenant_id, person_id)
        .await
        .map(Json)
}

async fn fetch_person_response(
    pool: &PgPool,
    tenant_id: Uuid,
    person_id: Uuid,
) -> Result<PersonResponse, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT
          p.id,
          p.tenant_id,
          p.person_type,
          p.full_name,
          p.email,
          p.phone,
          p.document,
          p.notes,
          p.is_active,
          COALESCE(
            ARRAY_AGG(pr.role_code ORDER BY pr.role_code) FILTER (WHERE pr.role_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS role_codes
        FROM people p
        LEFT JOIN person_roles pr ON pr.person_id = p.id
        WHERE p.tenant_id = $1 AND p.id = $2
        GROUP BY p.id, p.tenant_id, p.person_type, p.full_name, p.email, p.phone, p.document, p.notes, p.is_active
        "#,
    )
    .bind(tenant_id)
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()))?;
    Ok(map_person_row(row))
}

fn map_person_row(r: sqlx::postgres::PgRow) -> PersonResponse {
    PersonResponse {
        id: r.get("id"),
        tenant_id: r.get("tenant_id"),
        person_type: r.get("person_type"),
        role_codes: r.get("role_codes"),
        full_name: r.get("full_name"),
        email: r.get("email"),
        phone: r.get("phone"),
        document: r.get("document"),
        notes: r.get("notes"),
        is_active: r.get("is_active"),
    }
}

async fn ensure_role_can_be_removed(
    pool: &PgPool,
    tenant_id: Uuid,
    person_id: Uuid,
    role_code: &str,
) -> Result<(), (StatusCode, String)> {
    if role_code == "student" {
        let linked = sqlx::query("SELECT 1 FROM students WHERE tenant_id = $1 AND person_id = $2")
            .bind(tenant_id)
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro o vínculo do módulo Alunos".into()));
        }
    }

    if role_code == "guardian" {
        let linked = sqlx::query("SELECT 1 FROM guardians WHERE tenant_id = $1 AND person_id = $2")
            .bind(tenant_id)
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro o vínculo do módulo Resp. Vinculados".into()));
        }
    }

    if role_code == "teacher" || role_code == "staff" {
        let linked = sqlx::query(
            r#"SELECT 1 FROM users WHERE tenant_id = $1 AND person_id = $2 AND role IN ('owner', 'admin', 'teacher', 'staff')"#,
        )
        .bind(tenant_id)
        .bind(person_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro o vínculo do módulo Professores/Equipe".into()));
        }
    }

    Ok(())
}

async fn find_existing_person_id(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    email: Option<&str>,
    document: Option<&str>,
    full_name: Option<&str>,
    phone: Option<&str>,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT id
        FROM people
        WHERE tenant_id = $1
          AND (
                ($2::text IS NOT NULL AND lower(email) = lower($2))
             OR ($3::text IS NOT NULL AND document = $3)
             OR ($4::text IS NOT NULL AND $5::text IS NOT NULL AND lower(full_name) = lower($4) AND phone = $5)
          )
        ORDER BY created_at ASC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(email)
    .bind(document)
    .bind(full_name)
    .bind(phone)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(row.map(|r| r.get("id")))
}

async fn add_person_role(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    person_id: Uuid,
    role_code: &str,
) -> Result<(), (StatusCode, String)> {
    sqlx::query(
        r#"
        INSERT INTO person_roles (person_id, role_code)
        VALUES ($1, $2)
        ON CONFLICT (person_id, role_code) DO NOTHING
        "#,
    )
    .bind(person_id)
    .bind(role_code)
    .execute(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    Ok(())
}

fn normalize_person_type(value: &str) -> Result<&str, (StatusCode, String)> {
    match value.trim().to_lowercase().as_str() {
        "student" => Ok("student"),
        "parent" => Ok("parent"),
        "guardian" => Ok("guardian"),
        "teacher" => Ok("teacher"),
        "staff" => Ok("staff"),
        "supplier" => Ok("supplier"),
        "financial_guardian" => Ok("financial_guardian"),
        _ => Err((StatusCode::BAD_REQUEST, "Tipo de cadastro inválido".into())),
    }
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}
