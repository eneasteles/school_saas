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
pub struct CreateGuardianRequest {
    pub person_id: Option<Uuid>,
    #[validate(length(min = 2))]
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
    pub student_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateGuardianRequest {
    #[validate(length(min = 2))]
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGuardianStudentsRequest {
    pub student_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct GuardianStudentRef {
    pub id: Uuid,
    pub name: String,
    pub registration: String,
}

#[derive(Debug, Serialize)]
pub struct GuardianResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub person_id: Uuid,
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub students: Vec<GuardianStudentRef>,
}

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/guardians", get(list_guardians).post(create_guardian))
        .route("/guardians/:guardian_id", put(update_guardian).delete(delete_guardian))
        .route("/guardians/:guardian_id/students", put(update_guardian_students))
        .with_state(state)
}

async fn list_guardians(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<GuardianResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT
          g.id,
          g.tenant_id,
          g.person_id,
          p.full_name,
          p.phone,
          p.email,
          p.document,
          p.notes,
          p.is_active
        FROM guardians g
        JOIN people p
          ON p.id = g.person_id
         AND p.tenant_id = g.tenant_id
        WHERE g.tenant_id = $1
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let guardian_id: Uuid = r.get("id");
        let students = load_guardian_students(&state.pool, user.tenant_id, guardian_id).await?;
        out.push(GuardianResponse {
            id: guardian_id,
            tenant_id: r.get("tenant_id"),
            person_id: r.get("person_id"),
            full_name: r.get("full_name"),
            phone: r.get("phone"),
            email: r.get("email"),
            document: r.get("document"),
            notes: r.get("notes"),
            is_active: r.get("is_active"),
            students,
        });
    }

    Ok(Json(out))
}

async fn create_guardian(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateGuardianRequest>,
) -> Result<Json<GuardianResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &req.student_ids).await?;

    let id = Uuid::new_v4();
    let full_name = req.full_name.trim().to_string();
    let phone = normalize_optional_text(req.phone);
    let email = normalize_optional_text(req.email);
    let document = normalize_optional_text(req.document);
    let notes = normalize_optional_text(req.notes);
    let is_active = req.is_active.unwrap_or(true);
    let req_person_id = req.person_id;
    let person_id;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if let Some(existing_person_id) = req_person_id {
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
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                document = COALESCE($6, document),
                notes = COALESCE($7, notes),
                is_active = $8
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .bind(&full_name)
        .bind(&phone)
        .bind(&email)
        .bind(&document)
        .bind(&notes)
        .bind(is_active)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        person_id = existing_person_id;
    } else {
        let existing_person = sqlx::query(
            r#"
            SELECT id
            FROM people
            WHERE tenant_id = $1
              AND (
                   ($2::text IS NOT NULL AND lower(email) = lower($2))
                OR ($3::text IS NOT NULL AND document = $3)
              )
            LIMIT 1
            "#,
        )
        .bind(user.tenant_id)
        .bind(&email)
        .bind(&document)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

        person_id = if let Some(row) = existing_person {
            let person_id: Uuid = row.get("id");
            sqlx::query(
                r#"
                UPDATE people
                SET full_name = $3,
                    phone = COALESCE($4, phone),
                    email = COALESCE($5, email),
                    document = COALESCE($6, document),
                    notes = COALESCE($7, notes),
                    is_active = $8
                WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(user.tenant_id)
            .bind(person_id)
            .bind(&full_name)
            .bind(&phone)
            .bind(&email)
            .bind(&document)
            .bind(&notes)
            .bind(is_active)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
            person_id
        } else {
            let new_person_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO people (id, tenant_id, person_type, full_name, phone, email, document, notes, is_active)
                VALUES ($1, $2, 'guardian', $3, $4, $5, $6, $7, $8)
                "#,
            )
            .bind(new_person_id)
            .bind(user.tenant_id)
            .bind(&full_name)
            .bind(&phone)
            .bind(&email)
            .bind(&document)
            .bind(&notes)
            .bind(is_active)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
            new_person_id
        };
    }

    sqlx::query(
        r#"
        INSERT INTO person_roles (person_id, role_code)
        VALUES ($1, 'guardian')
        ON CONFLICT (person_id, role_code) DO NOTHING
        "#,
    )
    .bind(person_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    let already_guardian = sqlx::query(
        r#"SELECT id FROM guardians WHERE tenant_id = $1 AND person_id = $2 LIMIT 1"#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if already_guardian.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Pessoa já cadastrada como responsável vinculado".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO guardians (id, tenant_id, person_id, full_name, phone, email, document, notes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(&full_name)
    .bind(&phone)
    .bind(&email)
    .bind(&document)
    .bind(&notes)
    .bind(is_active)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    for student_id in &req.student_ids {
        sqlx::query(
            r#"
            INSERT INTO student_guardians (guardian_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (guardian_id, student_id) DO NOTHING
            "#,
        )
        .bind(id)
        .bind(student_id)
        .bind(user.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let students = load_guardian_students(&state.pool, user.tenant_id, id).await?;
    Ok(Json(GuardianResponse {
        id,
        tenant_id: user.tenant_id,
        person_id,
        full_name,
        phone,
        email,
        document,
        notes,
        is_active,
        students,
    }))
}

async fn update_guardian(
    State(state): State<AppState>,
    user: AuthUser,
    Path(guardian_id): Path<Uuid>,
    Json(req): Json<UpdateGuardianRequest>,
) -> Result<Json<GuardianResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let full_name = req.full_name.trim().to_string();
    let phone = normalize_optional_text(req.phone);
    let email = normalize_optional_text(req.email);
    let document = normalize_optional_text(req.document);
    let notes = normalize_optional_text(req.notes);
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person_id_row = sqlx::query(
        r#"
        SELECT person_id
        FROM guardians
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(guardian_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person_id_row = person_id_row.ok_or((StatusCode::NOT_FOUND, "Responsável vinculado não encontrado".into()))?;
    let person_id: Uuid = person_id_row.get("person_id");

    sqlx::query(
        r#"
        UPDATE people
        SET full_name = $3,
            phone = $4,
            email = $5,
            document = $6,
            notes = $7,
            is_active = $8
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(&full_name)
    .bind(&phone)
    .bind(&email)
    .bind(&document)
    .bind(&notes)
    .bind(req.is_active)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        UPDATE guardians
        SET full_name = $3,
            phone = $4,
            email = $5,
            document = $6,
            notes = $7,
            is_active = $8
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, full_name, phone, email, document, notes, is_active
        "#,
    )
    .bind(user.tenant_id)
    .bind(guardian_id)
    .bind(&full_name)
    .bind(&phone)
    .bind(&email)
    .bind(&document)
    .bind(&notes)
    .bind(req.is_active)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Responsável vinculado não encontrado".into()))?;
    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let students = load_guardian_students(&state.pool, user.tenant_id, guardian_id).await?;
    Ok(Json(GuardianResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        person_id,
        full_name: row.get("full_name"),
        phone: row.get("phone"),
        email: row.get("email"),
        document: row.get("document"),
        notes: row.get("notes"),
        is_active: row.get("is_active"),
        students,
    }))
}

async fn update_guardian_students(
    State(state): State<AppState>,
    user: AuthUser,
    Path(guardian_id): Path<Uuid>,
    Json(req): Json<UpdateGuardianStudentsRequest>,
) -> Result<Json<GuardianResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_guardian_belongs_to_tenant(&state.pool, user.tenant_id, guardian_id).await?;
    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &req.student_ids).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"DELETE FROM student_guardians
           WHERE tenant_id = $1 AND guardian_id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(guardian_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for student_id in &req.student_ids {
        sqlx::query(
            r#"
            INSERT INTO student_guardians (guardian_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (guardian_id, student_id) DO NOTHING
            "#,
        )
        .bind(guardian_id)
        .bind(student_id)
        .bind(user.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    get_guardian_by_id(&state.pool, user.tenant_id, guardian_id).await.map(Json)
}

async fn delete_guardian(
    State(state): State<AppState>,
    user: AuthUser,
    Path(guardian_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        DELETE FROM guardians
        WHERE tenant_id = $1 AND id = $2
        RETURNING person_id
        "#,
    )
    .bind(user.tenant_id)
    .bind(guardian_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, "Responsável vinculado não encontrado".into()));
    };

    let person_id: Uuid = row.get("person_id");
    sqlx::query("DELETE FROM person_roles WHERE person_id = $1 AND role_code = 'guardian'")
        .bind(person_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(OkResponse { ok: true }))
}

async fn load_guardian_students(
    pool: &PgPool,
    tenant_id: Uuid,
    guardian_id: Uuid,
) -> Result<Vec<GuardianStudentRef>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT s.id, s.name, s.registration
        FROM student_guardians sg
        JOIN students s
          ON s.id = sg.student_id
         AND s.tenant_id = sg.tenant_id
        WHERE sg.tenant_id = $1 AND sg.guardian_id = $2
        ORDER BY s.name ASC
        "#,
    )
    .bind(tenant_id)
    .bind(guardian_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(rows
        .into_iter()
        .map(|r| GuardianStudentRef {
            id: r.get("id"),
            name: r.get("name"),
            registration: r.get("registration"),
        })
        .collect())
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

async fn ensure_guardian_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    guardian_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT 1 FROM guardians WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(guardian_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if row.is_none() {
        return Err((StatusCode::NOT_FOUND, "Responsável vinculado não encontrado".into()));
    }
    Ok(())
}

async fn get_guardian_by_id(
    pool: &PgPool,
    tenant_id: Uuid,
    guardian_id: Uuid,
) -> Result<GuardianResponse, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT
          g.id,
          g.tenant_id,
          g.person_id,
          p.full_name,
          p.phone,
          p.email,
          p.document,
          p.notes,
          p.is_active
        FROM guardians g
        JOIN people p
          ON p.id = g.person_id
         AND p.tenant_id = g.tenant_id
        WHERE g.tenant_id = $1 AND g.id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(guardian_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Responsável vinculado não encontrado".into()))?;
    let students = load_guardian_students(pool, tenant_id, guardian_id).await?;
    Ok(GuardianResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        person_id: row.get("person_id"),
        full_name: row.get("full_name"),
        phone: row.get("phone"),
        email: row.get("email"),
        document: row.get("document"),
        notes: row.get("notes"),
        is_active: row.get("is_active"),
        students,
    })
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}
