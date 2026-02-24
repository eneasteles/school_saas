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
    pub photo_url: Option<String>,
    pub zip_code: Option<String>,
    pub street: Option<String>,
    pub address_number: Option<String>,
    pub neighborhood: Option<String>,
    pub complement: Option<String>,
    pub state_ibge_code: Option<i32>,
    pub state_uf: Option<String>,
    pub state_name: Option<String>,
    pub city_ibge_code: Option<i32>,
    pub city_name: Option<String>,
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
    pub photo_url: Option<String>,
    pub zip_code: Option<String>,
    pub street: Option<String>,
    pub address_number: Option<String>,
    pub neighborhood: Option<String>,
    pub complement: Option<String>,
    pub state_ibge_code: Option<i32>,
    pub state_uf: Option<String>,
    pub state_name: Option<String>,
    pub city_ibge_code: Option<i32>,
    pub city_name: Option<String>,
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
    pub photo_url: Option<String>,
    pub zip_code: Option<String>,
    pub street: Option<String>,
    pub address_number: Option<String>,
    pub neighborhood: Option<String>,
    pub complement: Option<String>,
    pub state_ibge_code: Option<i32>,
    pub state_uf: Option<String>,
    pub state_name: Option<String>,
    pub city_ibge_code: Option<i32>,
    pub city_name: Option<String>,
    pub parent_student_ids: Vec<Uuid>,
    pub pickup_student_ids: Vec<Uuid>,
    pub financial_student_ids: Vec<Uuid>,
    pub notes: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct RoleInputRequest {
    pub role_code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateParentStudentsRequest {
    pub student_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePickupStudentsRequest {
    pub student_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFinancialStudentsRequest {
    pub student_ids: Vec<Uuid>,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/people", get(list_people).post(create_person))
        .route("/people/:person_id", axum::routing::put(update_person).delete(delete_person))
        .route("/people/:person_id/roles", axum::routing::post(add_role))
        .route("/people/:person_id/roles/:role_code", axum::routing::delete(remove_role))
        .route("/people/:person_id/students", axum::routing::put(update_parent_students))
        .route("/people/:person_id/pickup-students", axum::routing::put(update_pickup_students))
        .route("/people/:person_id/financial-students", axum::routing::put(update_financial_students))
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
          p.photo_url,
          p.zip_code,
          p.street,
          p.address_number,
          p.neighborhood,
          p.complement,
          p.state_ibge_code,
          p.state_uf,
          p.state_name,
          p.city_ibge_code,
          p.city_name,
          COALESCE(
            ARRAY_AGG(DISTINCT ps.student_id ORDER BY ps.student_id) FILTER (WHERE ps.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS parent_student_ids,
          COALESCE(
            ARRAY_AGG(DISTINCT pas.student_id ORDER BY pas.student_id) FILTER (WHERE pas.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS pickup_student_ids,
          COALESCE(
            ARRAY_AGG(DISTINCT fgs.student_id ORDER BY fgs.student_id) FILTER (WHERE fgs.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS financial_student_ids,
          p.notes,
          p.is_active,
          COALESCE(
            ARRAY_AGG(DISTINCT pr.role_code ORDER BY pr.role_code) FILTER (WHERE pr.role_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS role_codes
        FROM people p
        LEFT JOIN person_roles pr ON pr.person_id = p.id
        LEFT JOIN parent_students ps
          ON ps.parent_person_id = p.id
         AND ps.tenant_id = p.tenant_id
        LEFT JOIN pickup_authorized_students pas
          ON pas.pickup_person_id = p.id
         AND pas.tenant_id = p.tenant_id
        LEFT JOIN financial_guardian_students fgs
          ON fgs.financial_person_id = p.id
         AND fgs.tenant_id = p.tenant_id
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
        GROUP BY p.id, p.tenant_id, p.person_type, p.full_name, p.email, p.phone, p.document, p.photo_url, p.zip_code, p.street,
                 p.address_number, p.neighborhood, p.complement, p.state_ibge_code, p.state_uf, p.state_name,
                 p.city_ibge_code, p.city_name, p.notes, p.is_active
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
    let photo_url = normalize_optional_text(req.photo_url);
    let zip_code = normalize_optional_text(req.zip_code);
    let street = normalize_optional_text(req.street);
    let address_number = normalize_optional_text(req.address_number);
    let neighborhood = normalize_optional_text(req.neighborhood);
    let complement = normalize_optional_text(req.complement);
    let state_ibge_code = req.state_ibge_code;
    let state_uf = normalize_optional_text(req.state_uf).map(|v| v.to_uppercase());
    let state_name = normalize_optional_text(req.state_name);
    let city_ibge_code = req.city_ibge_code;
    let city_name = normalize_optional_text(req.city_name);
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
                photo_url = COALESCE($7, photo_url),
                zip_code = COALESCE($8, zip_code),
                street = COALESCE($9, street),
                address_number = COALESCE($10, address_number),
                neighborhood = COALESCE($11, neighborhood),
                complement = COALESCE($12, complement),
                state_ibge_code = COALESCE($13, state_ibge_code),
                state_uf = COALESCE($14, state_uf),
                state_name = COALESCE($15, state_name),
                city_ibge_code = COALESCE($16, city_ibge_code),
                city_name = COALESCE($17, city_name),
                notes = COALESCE($18, notes),
                is_active = $19
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(existing_id)
        .bind(&full_name)
        .bind(&email)
        .bind(&phone)
        .bind(&document)
        .bind(&photo_url)
        .bind(&zip_code)
        .bind(&street)
        .bind(&address_number)
        .bind(&neighborhood)
        .bind(&complement)
        .bind(state_ibge_code)
        .bind(&state_uf)
        .bind(&state_name)
        .bind(city_ibge_code)
        .bind(&city_name)
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
            INSERT INTO people (
              id, tenant_id, person_type, full_name, email, phone, document, photo_url,
              zip_code, street, address_number, neighborhood, complement,
              state_ibge_code, state_uf, state_name, city_ibge_code, city_name,
              notes, is_active
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            )
            "#,
        )
        .bind(id)
        .bind(user.tenant_id)
        .bind(person_type)
        .bind(&full_name)
        .bind(&email)
        .bind(&phone)
        .bind(&document)
        .bind(&photo_url)
        .bind(&zip_code)
        .bind(&street)
        .bind(&address_number)
        .bind(&neighborhood)
        .bind(&complement)
        .bind(state_ibge_code)
        .bind(&state_uf)
        .bind(&state_name)
        .bind(city_ibge_code)
        .bind(&city_name)
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
            photo_url = $7,
            zip_code = $8,
            street = $9,
            address_number = $10,
            neighborhood = $11,
            complement = $12,
            state_ibge_code = $13,
            state_uf = $14,
            state_name = $15,
            city_ibge_code = $16,
            city_name = $17,
            notes = $18,
            is_active = $19
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
    .bind(normalize_optional_text(req.photo_url))
    .bind(normalize_optional_text(req.zip_code))
    .bind(normalize_optional_text(req.street))
    .bind(normalize_optional_text(req.address_number))
    .bind(normalize_optional_text(req.neighborhood))
    .bind(normalize_optional_text(req.complement))
    .bind(req.state_ibge_code)
    .bind(normalize_optional_text(req.state_uf).map(|v| v.to_uppercase()))
    .bind(normalize_optional_text(req.state_name))
    .bind(req.city_ibge_code)
    .bind(normalize_optional_text(req.city_name))
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

async fn update_parent_students(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Json(req): Json<UpdateParentStudentsRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let exists = sqlx::query("SELECT 1 FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    let has_parent_role = sqlx::query(
        r#"SELECT 1 FROM person_roles WHERE person_id = $1 AND role_code = 'parent' LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if has_parent_role.is_none() {
        return Err((StatusCode::BAD_REQUEST, "A pessoa precisa ter o papel Pai/Mãe para vincular alunos".into()));
    }

    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &req.student_ids).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"DELETE FROM parent_students
           WHERE tenant_id = $1 AND parent_person_id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for student_id in &req.student_ids {
        sqlx::query(
            r#"
            INSERT INTO parent_students (parent_person_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (parent_person_id, student_id) DO NOTHING
            "#,
        )
        .bind(person_id)
        .bind(student_id)
        .bind(user.tenant_id)
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

async fn update_pickup_students(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Json(req): Json<UpdatePickupStudentsRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let exists = sqlx::query("SELECT 1 FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    let has_role = sqlx::query(
        r#"SELECT 1 FROM person_roles WHERE person_id = $1 AND role_code = 'pickup_authorized' LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if has_role.is_none() {
        return Err((StatusCode::BAD_REQUEST, "A pessoa precisa ter o papel Autorizado para Buscar Aluno".into()));
    }

    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &req.student_ids).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"DELETE FROM pickup_authorized_students
           WHERE tenant_id = $1 AND pickup_person_id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for student_id in &req.student_ids {
        sqlx::query(
            r#"
            INSERT INTO pickup_authorized_students (pickup_person_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (pickup_person_id, student_id) DO NOTHING
            "#,
        )
        .bind(person_id)
        .bind(student_id)
        .bind(user.tenant_id)
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

async fn update_financial_students(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Json(req): Json<UpdateFinancialStudentsRequest>,
) -> Result<Json<PersonResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let exists = sqlx::query("SELECT 1 FROM people WHERE tenant_id = $1 AND id = $2")
        .bind(user.tenant_id)
        .bind(person_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Cadastro não encontrado".into()));
    }

    let has_role = sqlx::query(
        r#"SELECT 1 FROM person_roles WHERE person_id = $1 AND role_code = 'financial_guardian' LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if has_role.is_none() {
        return Err((StatusCode::BAD_REQUEST, "A pessoa precisa ter o papel Responsável Financeiro".into()));
    }

    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &req.student_ids).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"DELETE FROM financial_guardian_students
           WHERE tenant_id = $1 AND financial_person_id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for student_id in &req.student_ids {
        sqlx::query(
            r#"
            INSERT INTO financial_guardian_students (financial_person_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (financial_person_id, student_id) DO NOTHING
            "#,
        )
        .bind(person_id)
        .bind(student_id)
        .bind(user.tenant_id)
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
          p.photo_url,
          p.zip_code,
          p.street,
          p.address_number,
          p.neighborhood,
          p.complement,
          p.state_ibge_code,
          p.state_uf,
          p.state_name,
          p.city_ibge_code,
          p.city_name,
          COALESCE(
            ARRAY_AGG(DISTINCT ps.student_id ORDER BY ps.student_id) FILTER (WHERE ps.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS parent_student_ids,
          COALESCE(
            ARRAY_AGG(DISTINCT pas.student_id ORDER BY pas.student_id) FILTER (WHERE pas.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS pickup_student_ids,
          COALESCE(
            ARRAY_AGG(DISTINCT fgs.student_id ORDER BY fgs.student_id) FILTER (WHERE fgs.student_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS financial_student_ids,
          p.notes,
          p.is_active,
          COALESCE(
            ARRAY_AGG(DISTINCT pr.role_code ORDER BY pr.role_code) FILTER (WHERE pr.role_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS role_codes
        FROM people p
        LEFT JOIN person_roles pr ON pr.person_id = p.id
        LEFT JOIN parent_students ps
          ON ps.parent_person_id = p.id
         AND ps.tenant_id = p.tenant_id
        LEFT JOIN pickup_authorized_students pas
          ON pas.pickup_person_id = p.id
         AND pas.tenant_id = p.tenant_id
        LEFT JOIN financial_guardian_students fgs
          ON fgs.financial_person_id = p.id
         AND fgs.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND p.id = $2
        GROUP BY p.id, p.tenant_id, p.person_type, p.full_name, p.email, p.phone, p.document, p.photo_url, p.zip_code, p.street,
                 p.address_number, p.neighborhood, p.complement, p.state_ibge_code, p.state_uf, p.state_name,
                 p.city_ibge_code, p.city_name, p.notes, p.is_active
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
        photo_url: r.get("photo_url"),
        zip_code: r.get("zip_code"),
        street: r.get("street"),
        address_number: r.get("address_number"),
        neighborhood: r.get("neighborhood"),
        complement: r.get("complement"),
        state_ibge_code: r.get("state_ibge_code"),
        state_uf: r.get("state_uf"),
        state_name: r.get("state_name"),
        city_ibge_code: r.get("city_ibge_code"),
        city_name: r.get("city_name"),
        parent_student_ids: r.get("parent_student_ids"),
        pickup_student_ids: r.get("pickup_student_ids"),
        financial_student_ids: r.get("financial_student_ids"),
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

    if role_code == "parent" {
        let linked = sqlx::query("SELECT 1 FROM parent_students WHERE tenant_id = $1 AND parent_person_id = $2")
            .bind(tenant_id)
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro os vínculos de alunos do Pai/Mãe".into()));
        }
    }

    if role_code == "pickup_authorized" {
        let linked = sqlx::query("SELECT 1 FROM pickup_authorized_students WHERE tenant_id = $1 AND pickup_person_id = $2")
            .bind(tenant_id)
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro os vínculos de alunos do Autorizado para Buscar".into()));
        }
    }

    if role_code == "financial_guardian" {
        let linked = sqlx::query("SELECT 1 FROM financial_guardian_students WHERE tenant_id = $1 AND financial_person_id = $2")
            .bind(tenant_id)
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if linked.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Remova primeiro os vínculos de alunos do Responsável Financeiro".into()));
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
        "pickup_authorized" => Ok("pickup_authorized"),
        _ => Err((StatusCode::BAD_REQUEST, "Tipo de cadastro inválido".into())),
    }
}

async fn ensure_students_belong_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    student_ids: &[Uuid],
) -> Result<(), (StatusCode, String)> {
    for student_id in student_ids {
        let row = sqlx::query(
            r#"SELECT 1 FROM students WHERE tenant_id = $1 AND id = $2"#,
        )
        .bind(tenant_id)
        .bind(student_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

        if row.is_none() {
            return Err((StatusCode::BAD_REQUEST, "Aluno inválido para este tenant".into()));
        }
    }
    Ok(())
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}
