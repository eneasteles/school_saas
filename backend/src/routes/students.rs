use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStudentRequest {
    pub person_id: Option<Uuid>,
    #[validate(length(min = 2))]
    pub name: String,
    #[validate(length(min = 1))]
    pub registration: String,
    pub class_id: Option<Uuid>,
    pub birth_date: Option<NaiveDate>,
    pub guardian_ids: Option<Vec<Uuid>>,
    pub student_email: Option<String>,
    pub photo_url: Option<String>,
    pub notes: Option<String>,
    pub social_name: Option<String>,
    pub gender: Option<String>,
    pub nationality: Option<String>,
    pub place_of_birth: Option<String>,
    pub address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub health_notes: Option<String>,
    pub enrollment_status: Option<String>,
    pub enrollment_date: Option<NaiveDate>,
    pub is_inclusion: Option<bool>,
    pub inclusion_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignClassRequest {
    pub class_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AssignGuardiansRequest {
    pub guardian_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStudentProfileRequest {
    pub birth_date: Option<NaiveDate>,
    pub student_email: Option<String>,
    pub photo_url: Option<String>,
    pub social_name: Option<String>,
    pub gender: Option<String>,
    pub nationality: Option<String>,
    pub place_of_birth: Option<String>,
    pub address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub health_notes: Option<String>,
    pub enrollment_status: Option<String>,
    pub enrollment_date: Option<NaiveDate>,
    pub is_inclusion: Option<bool>,
    pub inclusion_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentGuardianRef {
    pub id: Uuid,
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub person_id: Uuid,
    pub name: String,
    pub registration: String,
    pub class_id: Option<Uuid>,
    pub birth_date: Option<NaiveDate>,
    pub guardians: Vec<StudentGuardianRef>,
    pub student_email: Option<String>,
    pub photo_url: Option<String>,
    pub notes: Option<String>,
    pub social_name: Option<String>,
    pub gender: Option<String>,
    pub nationality: Option<String>,
    pub place_of_birth: Option<String>,
    pub address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub health_notes: Option<String>,
    pub enrollment_status: Option<String>,
    pub enrollment_date: Option<NaiveDate>,
    pub is_inclusion: Option<bool>,
    pub inclusion_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegistrationSuggestionResponse {
    pub registration: String,
}

#[derive(Debug, Serialize)]
pub struct AvailableStudentPersonResponse {
    pub person_id: Uuid,
    pub full_name: String,
    pub email: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
struct OkResponse {
    ok: bool,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/students/registration-suggestion", get(registration_suggestion))
        .route("/students/available-people", get(list_available_student_people))
        .route("/students", post(create_student).get(list_students))
        .route(
            "/students/:student_id",
            get(get_student).delete(delete_student),
        )
        .route("/students/:student_id/class", put(assign_student_class))
        .route("/students/:student_id/guardians", put(assign_student_guardians))
        .route("/students/:student_id/profile", put(update_student_profile))
        .with_state(state)
}

async fn create_student(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateStudentRequest>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if let Some(class_id) = req.class_id {
        ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    }

    let id = Uuid::new_v4();
    let guardian_ids = req.guardian_ids.unwrap_or_default();
    ensure_guardians_belong_to_tenant(&state.pool, user.tenant_id, &guardian_ids).await?;
    let student_email = normalize_optional_text(req.student_email);
    let photo_url = normalize_optional_text(req.photo_url);
    let notes = normalize_optional_text(req.notes);
    let social_name = normalize_optional_text(req.social_name);
    let gender = normalize_optional_text(req.gender);
    let nationality = normalize_optional_text(req.nationality);
    let place_of_birth = normalize_optional_text(req.place_of_birth);
    let address = normalize_optional_text(req.address);
    let emergency_contact_name = normalize_optional_text(req.emergency_contact_name);
    let emergency_contact_phone = normalize_optional_text(req.emergency_contact_phone);
    let blood_type = normalize_optional_text(req.blood_type);
    let allergies = normalize_optional_text(req.allergies);
    let medications = normalize_optional_text(req.medications);
    let health_notes = normalize_optional_text(req.health_notes);
    let enrollment_status = normalize_optional_text(req.enrollment_status);
    let enrollment_date = req.enrollment_date;
    let is_inclusion = req.is_inclusion;
    let inclusion_type = if req.is_inclusion == Some(false) {
        None
    } else {
        normalize_optional_text(req.inclusion_type)
    };
    let birth_date = req.birth_date;
    let class_id = req.class_id;
    let name = req.name.trim().to_string();
    let registration = req.registration.trim().to_string();
    let req_person_id = req.person_id;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let person_id = if let Some(existing_person_id) = req_person_id {
        let person_exists = sqlx::query(
            r#"SELECT id FROM people WHERE tenant_id = $1 AND id = $2 LIMIT 1"#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        if person_exists.is_none() {
            return Err((StatusCode::BAD_REQUEST, "Pessoa informada não encontrada".into()));
        }

        let student_exists = sqlx::query(
            r#"SELECT 1 FROM students WHERE tenant_id = $1 AND person_id = $2 LIMIT 1"#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        if student_exists.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Pessoa já cadastrada como aluno".into()));
        }

        sqlx::query(
            r#"
            UPDATE people
            SET full_name = $3,
                email = COALESCE($4, email),
                notes = COALESCE($5, notes),
                photo_url = COALESCE($6, photo_url),
                is_active = TRUE
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(existing_person_id)
        .bind(&name)
        .bind(&student_email)
        .bind(&notes)
        .bind(&photo_url)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        existing_person_id
    } else {
        let person_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO people (id, tenant_id, person_type, full_name, email, notes, photo_url, is_active)
            VALUES ($1, $2, 'student', $3, $4, $5, $6, TRUE)
            "#,
        )
        .bind(person_id)
        .bind(user.tenant_id)
        .bind(&name)
        .bind(&student_email)
        .bind(&notes)
        .bind(&photo_url)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
        person_id
    };

    sqlx::query(
        r#"
        INSERT INTO person_roles (person_id, role_code)
        VALUES ($1, 'student')
        ON CONFLICT (person_id, role_code) DO NOTHING
        "#,
    )
    .bind(person_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    sqlx::query(
        r#"INSERT INTO students (
            id, tenant_id, person_id, name, registration, class_id,
            birth_date, student_email, notes, social_name, gender, nationality,
            place_of_birth, address, emergency_contact_name, emergency_contact_phone,
            blood_type, allergies, medications, health_notes, enrollment_status, enrollment_date,
            is_inclusion, inclusion_type
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23
        )"#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(&name)
    .bind(&registration)
    .bind(class_id)
    .bind(birth_date)
    .bind(&student_email)
    .bind(&notes)
    .bind(&social_name)
    .bind(&gender)
    .bind(&nationality)
    .bind(&place_of_birth)
    .bind(&address)
    .bind(&emergency_contact_name)
    .bind(&emergency_contact_phone)
    .bind(&blood_type)
    .bind(&allergies)
    .bind(&medications)
    .bind(&health_notes)
    .bind(&enrollment_status)
    .bind(enrollment_date)
    .bind(is_inclusion)
    .bind(&inclusion_type)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    for guardian_id in &guardian_ids {
        sqlx::query(
            r#"
            INSERT INTO student_guardians (guardian_id, student_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (guardian_id, student_id) DO NOTHING
            "#,
        )
        .bind(guardian_id)
        .bind(id)
        .bind(user.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let guardians = load_student_guardians(&state.pool, user.tenant_id, id).await?;

    Ok(Json(StudentResponse {
        id,
        tenant_id: user.tenant_id,
        person_id,
        name,
        registration,
        class_id,
        birth_date,
        guardians,
        student_email,
        photo_url,
        notes,
        social_name,
        gender,
        nationality,
        place_of_birth,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        blood_type,
        allergies,
        medications,
        health_notes,
        enrollment_status,
        enrollment_date,
        is_inclusion,
        inclusion_type,
    }))
}

async fn list_students(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<StudentResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
           SELECT
             s.id,
             s.tenant_id,
             s.person_id,
             p.full_name AS name,
             s.registration,
             s.class_id,
             s.birth_date,
             COALESCE(p.email, s.student_email) AS student_email,
             p.photo_url,
             COALESCE(p.notes, s.notes) AS notes,
             s.social_name,
             s.gender,
             s.nationality,
             s.place_of_birth,
             s.address,
             s.emergency_contact_name,
             s.emergency_contact_phone,
             s.blood_type,
             s.allergies,
             s.medications,
             s.health_notes,
             s.enrollment_status,
             s.enrollment_date,
             s.is_inclusion,
             s.inclusion_type
           FROM students s
           JOIN people p
             ON p.id = s.person_id
            AND p.tenant_id = s.tenant_id
           WHERE s.tenant_id = $1
           ORDER BY s.created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let id: Uuid = r.get("id");
        let guardians = load_student_guardians(&state.pool, user.tenant_id, id).await?;
        out.push(StudentResponse {
            id,
            tenant_id: r.get("tenant_id"),
            person_id: r.get("person_id"),
            name: r.get("name"),
            registration: r.get("registration"),
            class_id: r.get("class_id"),
            birth_date: r.get("birth_date"),
            guardians,
            student_email: r.get("student_email"),
            photo_url: r.get("photo_url"),
            notes: r.get("notes"),
            social_name: r.get("social_name"),
            gender: r.get("gender"),
            nationality: r.get("nationality"),
            place_of_birth: r.get("place_of_birth"),
            address: r.get("address"),
            emergency_contact_name: r.get("emergency_contact_name"),
            emergency_contact_phone: r.get("emergency_contact_phone"),
            blood_type: r.get("blood_type"),
            allergies: r.get("allergies"),
            medications: r.get("medications"),
            health_notes: r.get("health_notes"),
            enrollment_status: r.get("enrollment_status"),
            enrollment_date: r.get("enrollment_date"),
            is_inclusion: r.get("is_inclusion"),
            inclusion_type: r.get("inclusion_type"),
        });
    }

    Ok(Json(out))
}

async fn get_student(
    State(state): State<AppState>,
    user: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
           SELECT
             s.id,
             s.tenant_id,
             s.person_id,
             p.full_name AS name,
             s.registration,
             s.class_id,
             s.birth_date,
             COALESCE(p.email, s.student_email) AS student_email,
             p.photo_url,
             COALESCE(p.notes, s.notes) AS notes,
             s.social_name,
             s.gender,
             s.nationality,
             s.place_of_birth,
             s.address,
             s.emergency_contact_name,
             s.emergency_contact_phone,
             s.blood_type,
             s.allergies,
             s.medications,
             s.health_notes,
             s.enrollment_status,
             s.enrollment_date,
             s.is_inclusion,
             s.inclusion_type
           FROM students s
           JOIN people p
             ON p.id = s.person_id
            AND p.tenant_id = s.tenant_id
           WHERE s.tenant_id = $1 AND s.id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(student_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;

    let guardians = load_student_guardians(&state.pool, user.tenant_id, student_id).await?;
    Ok(Json(StudentResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        person_id: row.get("person_id"),
        name: row.get("name"),
        registration: row.get("registration"),
        class_id: row.get("class_id"),
        birth_date: row.get("birth_date"),
        guardians,
        student_email: row.get("student_email"),
        photo_url: row.get("photo_url"),
        notes: row.get("notes"),
        social_name: row.get("social_name"),
        gender: row.get("gender"),
        nationality: row.get("nationality"),
        place_of_birth: row.get("place_of_birth"),
        address: row.get("address"),
        emergency_contact_name: row.get("emergency_contact_name"),
        emergency_contact_phone: row.get("emergency_contact_phone"),
        blood_type: row.get("blood_type"),
        allergies: row.get("allergies"),
        medications: row.get("medications"),
        health_notes: row.get("health_notes"),
        enrollment_status: row.get("enrollment_status"),
        enrollment_date: row.get("enrollment_date"),
        is_inclusion: row.get("is_inclusion"),
        inclusion_type: row.get("inclusion_type"),
    }))
}

async fn delete_student(
    State(state): State<AppState>,
    user: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"DELETE FROM students
           WHERE tenant_id = $1 AND id = $2
           RETURNING person_id"#,
    )
    .bind(user.tenant_id)
    .bind(student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB ao deletar aluno".into()))?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, "Aluno não encontrado".into()));
    };

    let person_id: Uuid = row.get("person_id");
    sqlx::query("DELETE FROM person_roles WHERE person_id = $1 AND role_code = 'student'")
        .bind(person_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB ao deletar aluno".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB ao deletar aluno".into()))?;

    Ok(Json(OkResponse { ok: true }))
}

async fn assign_student_class(
    State(state): State<AppState>,
    user: AuthUser,
    Path(student_id): Path<Uuid>,
    Json(req): Json<AssignClassRequest>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    if let Some(class_id) = req.class_id {
        ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    }

    let row = sqlx::query(
        r#"
        UPDATE students
        SET class_id = $3
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, person_id, name, registration, class_id,
                  birth_date, student_email, notes, social_name, gender, nationality,
                  place_of_birth, address, emergency_contact_name, emergency_contact_phone,
                  blood_type, allergies, medications, health_notes, enrollment_status, enrollment_date,
                  is_inclusion, inclusion_type
        "#,
    )
    .bind(user.tenant_id)
    .bind(student_id)
    .bind(req.class_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;

    let guardians = load_student_guardians(&state.pool, user.tenant_id, student_id).await?;
    let person_id: Uuid = row.get("person_id");
    let person_row = sqlx::query(
        r#"
        SELECT full_name, email, photo_url, notes
        FROM people
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let (name, student_email, photo_url, notes): (String, Option<String>, Option<String>, Option<String>) = if let Some(p) = person_row {
        (p.get("full_name"), p.get("email"), p.get("photo_url"), p.get("notes"))
    } else {
        (row.get("name"), row.get("student_email"), None, row.get("notes"))
    };

    Ok(Json(StudentResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        person_id,
        name,
        registration: row.get("registration"),
        class_id: row.get("class_id"),
        birth_date: row.get("birth_date"),
        guardians,
        student_email,
        photo_url,
        notes,
        social_name: row.get("social_name"),
        gender: row.get("gender"),
        nationality: row.get("nationality"),
        place_of_birth: row.get("place_of_birth"),
        address: row.get("address"),
        emergency_contact_name: row.get("emergency_contact_name"),
        emergency_contact_phone: row.get("emergency_contact_phone"),
        blood_type: row.get("blood_type"),
        allergies: row.get("allergies"),
        medications: row.get("medications"),
        health_notes: row.get("health_notes"),
        enrollment_status: row.get("enrollment_status"),
        enrollment_date: row.get("enrollment_date"),
        is_inclusion: row.get("is_inclusion"),
        inclusion_type: row.get("inclusion_type"),
    }))
}

async fn assign_student_guardians(
    State(state): State<AppState>,
    user: AuthUser,
    Path(student_id): Path<Uuid>,
    Json(req): Json<AssignGuardiansRequest>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_students_belong_to_tenant(&state.pool, user.tenant_id, &[student_id]).await?;
    ensure_guardians_belong_to_tenant(&state.pool, user.tenant_id, &req.guardian_ids).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"DELETE FROM student_guardians
           WHERE tenant_id = $1 AND student_id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(student_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for guardian_id in &req.guardian_ids {
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

    get_student(State(state), user, Path(student_id)).await
}

async fn update_student_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Path(student_id): Path<Uuid>,
    Json(req): Json<UpdateStudentProfileRequest>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let student_email = normalize_optional_text(req.student_email);
    let photo_url = normalize_optional_text(req.photo_url);
    let social_name = normalize_optional_text(req.social_name);
    let gender = normalize_optional_text(req.gender);
    let nationality = normalize_optional_text(req.nationality);
    let place_of_birth = normalize_optional_text(req.place_of_birth);
    let address = normalize_optional_text(req.address);
    let emergency_contact_name = normalize_optional_text(req.emergency_contact_name);
    let emergency_contact_phone = normalize_optional_text(req.emergency_contact_phone);
    let blood_type = normalize_optional_text(req.blood_type);
    let allergies = normalize_optional_text(req.allergies);
    let medications = normalize_optional_text(req.medications);
    let health_notes = normalize_optional_text(req.health_notes);
    let enrollment_status = normalize_optional_text(req.enrollment_status);
    let inclusion_type = if req.is_inclusion == Some(false) {
        None
    } else {
        normalize_optional_text(req.inclusion_type)
    };

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        UPDATE students
        SET birth_date = $3,
            student_email = $4,
            social_name = $5,
            gender = $6,
            nationality = $7,
            place_of_birth = $8,
            address = $9,
            emergency_contact_name = $10,
            emergency_contact_phone = $11,
            blood_type = $12,
            allergies = $13,
            medications = $14,
            health_notes = $15,
            enrollment_status = $16,
            enrollment_date = $17,
            is_inclusion = $18,
            inclusion_type = $19
        WHERE tenant_id = $1 AND id = $2
        RETURNING person_id
        "#,
    )
    .bind(user.tenant_id)
    .bind(student_id)
    .bind(req.birth_date)
    .bind(&student_email)
    .bind(&social_name)
    .bind(&gender)
    .bind(&nationality)
    .bind(&place_of_birth)
    .bind(&address)
    .bind(&emergency_contact_name)
    .bind(&emergency_contact_phone)
    .bind(&blood_type)
    .bind(&allergies)
    .bind(&medications)
    .bind(&health_notes)
    .bind(&enrollment_status)
    .bind(req.enrollment_date)
    .bind(req.is_inclusion)
    .bind(&inclusion_type)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;
    let person_id: Uuid = row.get("person_id");

    sqlx::query(
        r#"
        UPDATE people
        SET email = COALESCE($3, email),
            photo_url = COALESCE($4, photo_url)
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(&student_email)
    .bind(&photo_url)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    get_student(State(state), user, Path(student_id)).await
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}

async fn ensure_class_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    class_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let exists = sqlx::query(
        r#"SELECT 1
           FROM classes
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if exists.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Turma inválida para este tenant".into()));
    }

    Ok(())
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

async fn ensure_guardians_belong_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    guardian_ids: &[Uuid],
) -> Result<(), (StatusCode, String)> {
    for guardian_id in guardian_ids {
        let row = sqlx::query(
            r#"SELECT 1 FROM guardians WHERE tenant_id = $1 AND id = $2"#,
        )
        .bind(tenant_id)
        .bind(guardian_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

        if row.is_none() {
            return Err((StatusCode::BAD_REQUEST, "Responsável vinculado inválido para este tenant".into()));
        }
    }
    Ok(())
}

async fn load_student_guardians(
    pool: &PgPool,
    tenant_id: Uuid,
    student_id: Uuid,
) -> Result<Vec<StudentGuardianRef>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"
        SELECT
          g.id,
          COALESCE(p.full_name, g.full_name) AS full_name,
          COALESCE(p.phone, g.phone) AS phone,
          COALESCE(p.email, g.email) AS email
        FROM student_guardians sg
        JOIN guardians g
          ON g.id = sg.guardian_id
         AND g.tenant_id = sg.tenant_id
        LEFT JOIN people p
          ON p.id = g.person_id
         AND p.tenant_id = g.tenant_id
        WHERE sg.tenant_id = $1 AND sg.student_id = $2
        ORDER BY COALESCE(p.full_name, g.full_name) ASC
        "#,
    )
    .bind(tenant_id)
    .bind(student_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(rows
        .into_iter()
        .map(|r| StudentGuardianRef {
            id: r.get("id"),
            full_name: r.get("full_name"),
            phone: r.get("phone"),
            email: r.get("email"),
        })
        .collect())
}

async fn registration_suggestion(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<RegistrationSuggestionResponse>, (StatusCode, String)> {
    let year = chrono::Utc::now().year();
    let year_prefix = year.to_string();

    let row = sqlx::query(
        r#"
        SELECT COALESCE(MAX(CAST(RIGHT(registration, 4) AS INT)), 0) AS seq
        FROM students
        WHERE tenant_id = $1
          AND registration ~ ('^' || $2 || '\d{4}$')
        "#,
    )
    .bind(user.tenant_id)
    .bind(&year_prefix)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let seq: i32 = row.get("seq");
    let next = seq + 1;
    let registration = format!("{year}{next:04}");

    Ok(Json(RegistrationSuggestionResponse { registration }))
}

async fn list_available_student_people(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<AvailableStudentPersonResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT
          p.id AS person_id,
          p.full_name,
          p.email,
          p.notes
        FROM people p
        JOIN person_roles pr
          ON pr.person_id = p.id
         AND pr.role_code = 'student'
        LEFT JOIN students s
          ON s.person_id = p.id
         AND s.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1
          AND p.is_active = TRUE
          AND s.id IS NULL
        ORDER BY lower(p.full_name) ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| AvailableStudentPersonResponse {
            person_id: r.get("person_id"),
            full_name: r.get("full_name"),
            email: r.get("email"),
            notes: r.get("notes"),
        })
        .collect();

    Ok(Json(out))
}
