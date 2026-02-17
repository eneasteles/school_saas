use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct StudentsState {
    pub pool: PgPool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStudentRequest {
    #[validate(length(min = 2))]
    pub name: String,

    #[validate(length(min = 1))]
    pub registration: String,
}

#[derive(Debug, Serialize)]
pub struct StudentResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub registration: String,
}

#[derive(Serialize)]
struct OkResponse {
    ok: bool,
}

pub fn routes(pool: PgPool) -> Router {
    let state = StudentsState { pool };

    Router::new()
        // create + list
        .route("/tenants/:tenant_id/students", post(create_student).get(list_students))
        // get + delete (mesmo path)
        .route(
            "/tenants/:tenant_id/students/:student_id",
            get(get_student).delete(delete_student),
        )
        .with_state(state)
}

async fn create_student(
    State(state): State<StudentsState>,
    Path(tenant_id): Path<Uuid>,
    Json(req): Json<CreateStudentRequest>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO students (id, tenant_id, name, registration)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(id)
    .bind(tenant_id)
    .bind(req.name.clone())
    .bind(req.registration.clone())
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro: {e}")))?;

    Ok(Json(StudentResponse {
        id,
        tenant_id,
        name: req.name,
        registration: req.registration,
    }))
}

async fn list_students(
    State(state): State<StudentsState>,
    Path(tenant_id): Path<Uuid>,
) -> Result<Json<Vec<StudentResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"SELECT id, tenant_id, name, registration
           FROM students
           WHERE tenant_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| StudentResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            name: r.get("name"),
            registration: r.get("registration"),
        })
        .collect();

    Ok(Json(out))
}

async fn get_student(
    State(state): State<StudentsState>,
    Path((tenant_id, student_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<StudentResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT id, tenant_id, name, registration
           FROM students
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(student_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;

    Ok(Json(StudentResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        registration: row.get("registration"),
    }))
}

async fn delete_student(
    State(state): State<StudentsState>,
    Path((tenant_id, student_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    let result = sqlx::query(
        r#"DELETE FROM students
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(student_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        eprintln!("DB delete error: {e:?}");
        (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB ao deletar aluno".into())
    })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Aluno não encontrado".into()));
    }

    Ok(Json(OkResponse { ok: true }))
}
