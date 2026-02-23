use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
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
pub struct CreateTeacherRequest {
    pub person_id: Option<Uuid>,
    #[validate(length(min = 2))]
    pub full_name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[validate(length(min = 3))]
    pub role: String,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTeacherRoleRequest {
    #[validate(length(min = 3))]
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct TeacherResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub person_id: Uuid,
    pub full_name: Option<String>,
    pub email: String,
    pub phone: Option<String>,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/teachers", get(list_teachers).post(create_teacher))
        .route(
            "/teachers/:user_id/role",
            put(update_teacher_role),
        )
        .route("/teachers/:user_id", axum::routing::delete(delete_teacher))
        .with_state(state)
}

async fn list_teachers(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<TeacherResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let rows = sqlx::query(
        r#"
           SELECT u.id, u.tenant_id, u.person_id, p.full_name, u.email, p.phone, u.role
           FROM users u
           JOIN people p
             ON p.id = u.person_id
            AND p.tenant_id = u.tenant_id
           WHERE u.tenant_id = $1
           ORDER BY u.role ASC, u.email ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| TeacherResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            person_id: r.get("person_id"),
            full_name: r.get("full_name"),
            email: r.get("email"),
            phone: r.get("phone"),
            role: r.get("role"),
        })
        .collect();

    Ok(Json(out))
}

async fn create_teacher(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateTeacherRequest>,
) -> Result<Json<TeacherResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let role = normalize_role(&req.role)?;
    if role == "owner" {
        return Err((StatusCode::BAD_REQUEST, "Não é permitido criar owner".into()));
    }

    let id = Uuid::new_v4();
    let full_name = req.full_name.trim().to_string();
    if full_name.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "Nome completo inválido".into()));
    }
    let email = req.email.trim().to_lowercase();
    let phone = normalize_optional_text(req.phone);
    let password_hash = hash_password(&req.password)?;

    let person_type = role_to_person_type(role);
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person_id: Uuid = if let Some(existing_person_id) = req.person_id {
        let person_exists = sqlx::query(
            r#"SELECT id FROM people WHERE tenant_id = $1 AND id = $2 LIMIT 1"#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        if person_exists.is_none() {
            return Err((StatusCode::BAD_REQUEST, "Pessoa informada não encontrada".into()));
        }

        sqlx::query(
            r#"
            UPDATE people
            SET full_name = $3,
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                is_active = TRUE
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .bind(&full_name)
        .bind(&email)
        .bind(&phone)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        existing_person_id
    } else {
        let existing_person = sqlx::query(
            r#"
            SELECT id
            FROM people
            WHERE tenant_id = $1 AND lower(email) = lower($2)
            LIMIT 1
            "#,
        )
        .bind(user.tenant_id)
        .bind(&email)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

        if let Some(row) = existing_person {
            let person_id: Uuid = row.get("id");
            sqlx::query(
                r#"
                UPDATE people
                SET full_name = $3,
                    phone = COALESCE($4, phone),
                    is_active = TRUE
                WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(user.tenant_id)
            .bind(person_id)
            .bind(&full_name)
            .bind(&phone)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
            person_id
        } else {
            let person_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO people (id, tenant_id, person_type, full_name, email, phone, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                "#,
            )
            .bind(person_id)
            .bind(user.tenant_id)
            .bind(person_type)
            .bind(&full_name)
            .bind(&email)
            .bind(&phone)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
            person_id
        }
    };

    sqlx::query(
        r#"
        INSERT INTO person_roles (person_id, role_code)
        VALUES ($1, $2)
        ON CONFLICT (person_id, role_code) DO NOTHING
        "#,
    )
    .bind(person_id)
    .bind(person_type)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    sqlx::query(
        r#"INSERT INTO users (id, tenant_id, person_id, full_name, email, password_hash, role, phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(&full_name)
    .bind(&email)
    .bind(password_hash)
    .bind(role)
    .bind(&phone)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(TeacherResponse {
        id,
        tenant_id: user.tenant_id,
        person_id,
        full_name: Some(full_name),
        email,
        phone,
        role: role.to_string(),
    }))
}

async fn update_teacher_role(
    State(state): State<AppState>,
    user: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(req): Json<UpdateTeacherRoleRequest>,
) -> Result<Json<TeacherResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let role = normalize_role(&req.role)?;
    if role == "owner" {
        return Err((StatusCode::BAD_REQUEST, "Não é permitido atribuir owner".into()));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        UPDATE users
        SET role = $3
        WHERE tenant_id = $1 AND id = $2 AND role <> 'owner'
        RETURNING id, tenant_id, person_id, full_name, email, phone, role
        "#,
    )
    .bind(user.tenant_id)
    .bind(user_id)
    .bind(role)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Professor/usuário não encontrado".into()))?;
    let person_id: Uuid = row.get("person_id");
    let role_saved: String = row.get("role");

    sqlx::query(
        r#"
        UPDATE people
        SET person_type = $3
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(role_to_person_type(&role_saved))
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"
        INSERT INTO person_roles (person_id, role_code)
        VALUES ($1, $2)
        ON CONFLICT (person_id, role_code) DO NOTHING
        "#,
    )
    .bind(person_id)
    .bind(role_to_person_type(&role_saved))
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(TeacherResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        person_id,
        full_name: row.get("full_name"),
        email: row.get("email"),
        phone: row.get("phone"),
        role: role_saved,
    }))
}

async fn delete_teacher(
    State(state): State<AppState>,
    user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    if user_id == user.user_id {
        return Err((StatusCode::BAD_REQUEST, "Você não pode remover o próprio usuário".into()));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        DELETE FROM users
        WHERE tenant_id = $1 AND id = $2 AND role <> 'owner'
        RETURNING person_id, role
        "#,
    )
    .bind(user.tenant_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, "Professor/usuário não encontrado".into()));
    };

    let person_id: Uuid = row.get("person_id");
    let role: String = row.get("role");
    let role_code = role_to_person_type(&role);

    sqlx::query(
        r#"DELETE FROM person_roles WHERE person_id = $1 AND role_code = $2"#,
    )
    .bind(person_id)
    .bind(role_code)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(OkResponse { ok: true }))
}

fn hash_password(password: &str) -> Result<String, (StatusCode, String)> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro hash".into()))
        .map(|h| h.to_string())
}

fn normalize_role(role: &str) -> Result<&str, (StatusCode, String)> {
    match role.trim().to_lowercase().as_str() {
        "admin" => Ok("admin"),
        "teacher" => Ok("teacher"),
        "staff" => Ok("staff"),
        "owner" => Ok("owner"),
        _ => Err((StatusCode::BAD_REQUEST, "Role inválida".into())),
    }
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}

fn role_to_person_type(role: &str) -> &str {
    if role == "teacher" {
        "teacher"
    } else {
        "staff"
    }
}
