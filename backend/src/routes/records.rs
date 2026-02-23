use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::NaiveDate;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct AttendanceQuery {
    pub date: NaiveDate,
    pub subject_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct AttendanceItem {
    pub student_id: Uuid,
    pub student_name: String,
    pub registration: String,
    pub present: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AttendanceResponse {
    pub class_id: Uuid,
    pub date: NaiveDate,
    pub subject_id: Uuid,
    pub items: Vec<AttendanceItem>,
}

#[derive(Debug, Deserialize)]
pub struct AttendanceRecordInput {
    pub student_id: Uuid,
    pub present: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertAttendanceRequest {
    pub date: NaiveDate,
    pub subject_id: Uuid,
    pub records: Vec<AttendanceRecordInput>,
}

#[derive(Debug, Deserialize)]
pub struct GradebookQuery {
    pub term_id: Uuid,
    pub subject_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct GradeItem {
    pub student_id: Uuid,
    pub student_name: String,
    pub registration: String,
    pub score: Option<f64>,
    pub absences: i32,
    pub comments: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GradebookResponse {
    pub class_id: Uuid,
    pub term_id: Uuid,
    pub term_name: String,
    pub subject_id: Uuid,
    pub subject_name: String,
    pub items: Vec<GradeItem>,
}

#[derive(Debug, Deserialize)]
pub struct GradeRecordInput {
    pub student_id: Uuid,
    pub score: f64,
    pub absences: Option<i32>,
    pub comments: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertGradebookRequest {
    pub term_id: Uuid,
    pub subject_id: Uuid,
    pub records: Vec<GradeRecordInput>,
}

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Deserialize)]
pub struct ShareReportRequest {
    pub student_id: Uuid,
    pub term_id: Uuid,
    pub subject_id: Uuid,
    pub expires_days: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ShareStudentTermReportRequest {
    pub expires_days: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ShareReportResponse {
    pub token: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PublicReportQuery {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ParentReportClaims {
    sub: String,
    tenant_id: String,
    class_id: String,
    student_id: String,
    term_id: String,
    subject_id: String,
    scope: String,
    exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct ParentTermReportClaims {
    sub: String,
    tenant_id: String,
    class_id: String,
    student_id: String,
    term_id: String,
    scope: String,
    exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct ParentFullReportClaims {
    sub: String,
    tenant_id: String,
    class_id: String,
    student_id: String,
    scope: String,
    exp: usize,
}

#[derive(Debug, Serialize)]
pub struct GradebookReportStudent {
    pub student_id: Uuid,
    pub student_name: String,
    pub registration: String,
    pub score: Option<f64>,
    pub absences_gradebook: i32,
    pub comments: Option<String>,
    pub attendance_total_days: i32,
    pub attendance_present_days: i32,
    pub attendance_absent_days: i32,
    pub attendance_percent: f64,
}

#[derive(Debug, Serialize)]
pub struct GradebookReportResponse {
    pub class_id: Uuid,
    pub class_name: String,
    pub class_grade: String,
    pub class_year: i32,
    pub class_period: String,
    pub term_id: Uuid,
    pub term_name: String,
    pub subject_id: Uuid,
    pub subject_name: String,
    pub generated_at: String,
    pub students: Vec<GradebookReportStudent>,
}

#[derive(Debug, Deserialize)]
pub struct StudentTermReportQuery {
    pub term_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct StudentTermSubjectGrade {
    pub subject_id: Uuid,
    pub subject_name: String,
    pub score: Option<f64>,
    pub absences_gradebook: i32,
    pub comments: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentTermReportResponse {
    pub class_id: Uuid,
    pub class_name: String,
    pub class_grade: String,
    pub class_year: i32,
    pub class_period: String,
    pub term_id: Uuid,
    pub term_name: String,
    pub student_id: Uuid,
    pub student_name: String,
    pub registration: String,
    pub attendance_total_days: i32,
    pub attendance_present_days: i32,
    pub attendance_absent_days: i32,
    pub attendance_percent: f64,
    pub generated_at: String,
    pub subjects: Vec<StudentTermSubjectGrade>,
}

#[derive(Debug, Serialize)]
pub struct StudentFullReportPeriod {
    pub term_id: Uuid,
    pub term_name: String,
    pub school_year: i32,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct StudentFullReportPeriodGrade {
    pub term_id: Uuid,
    pub term_name: String,
    pub score: Option<f64>,
    pub absences_gradebook: i32,
    pub comments: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentFullReportSubject {
    pub subject_id: Uuid,
    pub subject_name: String,
    pub period_grades: Vec<StudentFullReportPeriodGrade>,
    pub average_score: Option<f64>,
    pub approved: bool,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct StudentFullReportResponse {
    pub class_id: Uuid,
    pub class_name: String,
    pub class_grade: String,
    pub class_year: i32,
    pub class_period: String,
    pub student_id: Uuid,
    pub student_name: String,
    pub registration: String,
    pub min_passing_grade: f64,
    pub attendance_total_days: i32,
    pub attendance_present_days: i32,
    pub attendance_absent_days: i32,
    pub attendance_percent: f64,
    pub generated_at: String,
    pub periods: Vec<StudentFullReportPeriod>,
    pub subjects: Vec<StudentFullReportSubject>,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/classes/:class_id/attendance", get(get_attendance).put(upsert_attendance))
        .route("/classes/:class_id/gradebook", get(get_gradebook).put(upsert_gradebook))
        .route("/classes/:class_id/gradebook-report", get(get_gradebook_report))
        .route(
            "/classes/:class_id/gradebook-report/share",
            post(create_gradebook_report_share_link),
        )
        .route(
            "/classes/:class_id/students/:student_id/term-report",
            get(get_student_term_report),
        )
        .route(
            "/classes/:class_id/students/:student_id/term-report/share",
            post(create_student_term_report_share_link),
        )
        .route(
            "/classes/:class_id/students/:student_id/full-report",
            get(get_student_full_report),
        )
        .route(
            "/classes/:class_id/students/:student_id/full-report/share",
            post(create_student_full_report_share_link),
        )
        .route("/public/gradebook-report", get(get_public_gradebook_report))
        .route("/public/student-term-report", get(get_public_student_term_report))
        .route("/public/student-full-report", get(get_public_student_full_report))
        .with_state(state)
}

async fn get_attendance(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Query(query): Query<AttendanceQuery>,
) -> Result<Json<AttendanceResponse>, (StatusCode, String)> {
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, query.subject_id).await?;

    let rows = sqlx::query(
        r#"
        SELECT
          s.id AS student_id,
          s.name AS student_name,
          s.registration,
          COALESCE(a.present, false) AS present,
          a.notes
        FROM students s
        LEFT JOIN student_attendance a
          ON a.tenant_id = s.tenant_id
         AND a.class_id = s.class_id
         AND a.student_id = s.id
         AND a.attendance_date = $3
         AND a.subject_id = $4
        WHERE s.tenant_id = $1 AND s.class_id = $2
        ORDER BY s.name ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .bind(query.date)
    .bind(query.subject_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let items = rows
        .into_iter()
        .map(|r| AttendanceItem {
            student_id: r.get("student_id"),
            student_name: r.get("student_name"),
            registration: r.get("registration"),
            present: r.get("present"),
            notes: r.get("notes"),
        })
        .collect();

    Ok(Json(AttendanceResponse {
        class_id,
        date: query.date,
        subject_id: query.subject_id,
        items,
    }))
}

async fn upsert_attendance(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Json(req): Json<UpsertAttendanceRequest>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher", "staff"])?;
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, req.subject_id).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for r in &req.records {
        ensure_student_belongs_to_class(&mut tx, user.tenant_id, class_id, r.student_id).await?;

        sqlx::query(
            r#"
            INSERT INTO student_attendance
              (id, tenant_id, class_id, student_id, attendance_date, subject_id, present, notes)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (tenant_id, class_id, student_id, attendance_date, subject_id)
            DO UPDATE SET present = EXCLUDED.present, notes = EXCLUDED.notes
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user.tenant_id)
        .bind(class_id)
        .bind(r.student_id)
        .bind(req.date)
        .bind(req.subject_id)
        .bind(r.present)
        .bind(normalize_optional_text(r.notes.clone()))
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(OkResponse { ok: true }))
}

async fn get_gradebook(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Query(query): Query<GradebookQuery>,
) -> Result<Json<GradebookResponse>, (StatusCode, String)> {
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    let term_name = ensure_term_belongs_to_tenant(&state.pool, user.tenant_id, query.term_id).await?;
    let subject_name =
        ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, query.subject_id).await?;

    let rows = sqlx::query(
        r#"
        SELECT
          s.id AS student_id,
          s.name AS student_name,
          s.registration,
          g.score::float8 AS score,
          COALESCE(g.absences, 0) AS absences,
          g.comments
        FROM students s
        LEFT JOIN student_grades g
          ON g.tenant_id = s.tenant_id
         AND g.class_id = s.class_id
         AND g.student_id = s.id
         AND g.term_id = $3
         AND g.subject_id = $4
        WHERE s.tenant_id = $1 AND s.class_id = $2
        ORDER BY s.name ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .bind(query.term_id)
    .bind(query.subject_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let items = rows
        .into_iter()
        .map(|r| GradeItem {
            student_id: r.get("student_id"),
            student_name: r.get("student_name"),
            registration: r.get("registration"),
            score: r.get("score"),
            absences: r.get("absences"),
            comments: r.get("comments"),
        })
        .collect();

    Ok(Json(GradebookResponse {
        class_id,
        term_id: query.term_id,
        term_name,
        subject_id: query.subject_id,
        subject_name,
        items,
    }))
}

async fn upsert_gradebook(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Json(req): Json<UpsertGradebookRequest>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    let term_name = ensure_term_belongs_to_tenant(&state.pool, user.tenant_id, req.term_id).await?;
    let subject_name =
        ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, req.subject_id).await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    for r in &req.records {
        if !(0.0..=10.0).contains(&r.score) {
            return Err((StatusCode::BAD_REQUEST, "Nota deve estar entre 0 e 10".into()));
        }
        ensure_student_belongs_to_class(&mut tx, user.tenant_id, class_id, r.student_id).await?;

        sqlx::query(
            r#"
            INSERT INTO student_grades
              (id, tenant_id, class_id, student_id, term, subject, term_id, subject_id, score, absences, comments)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (tenant_id, class_id, student_id, term_id, subject_id)
            DO UPDATE SET
              term = EXCLUDED.term,
              subject = EXCLUDED.subject,
              score = EXCLUDED.score,
              absences = EXCLUDED.absences,
              comments = EXCLUDED.comments
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user.tenant_id)
        .bind(class_id)
        .bind(r.student_id)
        .bind(&term_name)
        .bind(&subject_name)
        .bind(req.term_id)
        .bind(req.subject_id)
        .bind(r.score)
        .bind(r.absences.unwrap_or(0))
        .bind(normalize_optional_text(r.comments.clone()))
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB ao salvar notas: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(OkResponse { ok: true }))
}

async fn get_gradebook_report(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Query(query): Query<GradebookQuery>,
) -> Result<Json<GradebookReportResponse>, (StatusCode, String)> {
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    let term_name = ensure_term_belongs_to_tenant(&state.pool, user.tenant_id, query.term_id).await?;
    let subject_name =
        ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, query.subject_id).await?;

    let class_row = sqlx::query(
        r#"
        SELECT name, grade, year, period
        FROM classes
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let class_row = class_row.ok_or((StatusCode::NOT_FOUND, "Turma não encontrada".into()))?;
    let class_name: String = class_row.get("name");
    let class_grade: String = class_row.get("grade");
    let class_year: i32 = class_row.get("year");
    let class_period: String = class_row.get("period");

    let rows = sqlx::query(
        r#"
        SELECT
          s.id AS student_id,
          s.name AS student_name,
          s.registration,
          g.score::float8 AS score,
          COALESCE(g.absences, 0) AS absences_gradebook,
          g.comments,
          COALESCE(a.total_days, 0) AS attendance_total_days,
          COALESCE(a.present_days, 0) AS attendance_present_days
        FROM students s
        LEFT JOIN student_grades g
          ON g.tenant_id = s.tenant_id
         AND g.class_id = s.class_id
         AND g.student_id = s.id
         AND g.term_id = $3
         AND g.subject_id = $4
        LEFT JOIN (
          SELECT
            student_id,
            COUNT(*)::int AS total_days,
            SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_days
          FROM student_attendance
          WHERE tenant_id = $1 AND class_id = $2 AND subject_id = $4
          GROUP BY student_id
        ) a ON a.student_id = s.id
        WHERE s.tenant_id = $1
          AND s.class_id = $2
        ORDER BY s.name ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .bind(query.term_id)
    .bind(query.subject_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let students = rows
        .into_iter()
        .map(|r| {
            let total_days: i32 = r.get("attendance_total_days");
            let present_days: i32 = r.get("attendance_present_days");
            let absent_days = total_days.saturating_sub(present_days);
            let attendance_percent = if total_days > 0 {
                (present_days as f64 * 100.0) / total_days as f64
            } else {
                0.0
            };

            GradebookReportStudent {
                student_id: r.get("student_id"),
                student_name: r.get("student_name"),
                registration: r.get("registration"),
                score: r.get("score"),
                absences_gradebook: r.get("absences_gradebook"),
                comments: r.get("comments"),
                attendance_total_days: total_days,
                attendance_present_days: present_days,
                attendance_absent_days: absent_days,
                attendance_percent,
            }
        })
        .collect();

    Ok(Json(GradebookReportResponse {
        class_id,
        class_name,
        class_grade,
        class_year,
        class_period,
        term_id: query.term_id,
        term_name,
        subject_id: query.subject_id,
        subject_name,
        generated_at: chrono::Utc::now().to_rfc3339(),
        students,
    }))
}

async fn create_gradebook_report_share_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
    Json(req): Json<ShareReportRequest>,
) -> Result<Json<ShareReportResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    ensure_student_belongs_to_class_by_pool(&state.pool, user.tenant_id, class_id, req.student_id).await?;
    ensure_term_belongs_to_tenant(&state.pool, user.tenant_id, req.term_id).await?;
    ensure_subject_belongs_to_tenant(&state.pool, user.tenant_id, req.subject_id).await?;

    let expires_days = req.expires_days.unwrap_or(30).clamp(1, 365);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(expires_days);

    let claims = ParentReportClaims {
        sub: user.user_id.to_string(),
        tenant_id: user.tenant_id.to_string(),
        class_id: class_id.to_string(),
        student_id: req.student_id.to_string(),
        term_id: req.term_id.to_string(),
        subject_id: req.subject_id.to_string(),
        scope: "parent_report".to_string(),
        exp: expires_at.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao gerar token".into()))?;

    Ok(Json(ShareReportResponse {
        token,
        expires_at: expires_at.to_rfc3339(),
    }))
}

async fn get_public_gradebook_report(
    State(state): State<AppState>,
    Query(query): Query<PublicReportQuery>,
) -> Result<Json<GradebookReportResponse>, (StatusCode, String)> {
    let data = decode::<ParentReportClaims>(
        &query.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Token inválido ou expirado".into()))?;

    if data.claims.scope != "parent_report" {
        return Err((StatusCode::UNAUTHORIZED, "Escopo de token inválido".into()));
    }

    let tenant_id = Uuid::parse_str(&data.claims.tenant_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "tenant inválido".into()))?;
    let class_id =
        Uuid::parse_str(&data.claims.class_id).map_err(|_| (StatusCode::BAD_REQUEST, "class inválida".into()))?;
    let student_id = Uuid::parse_str(&data.claims.student_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "student inválido".into()))?;
    let term_id =
        Uuid::parse_str(&data.claims.term_id).map_err(|_| (StatusCode::BAD_REQUEST, "term inválido".into()))?;
    let subject_id = Uuid::parse_str(&data.claims.subject_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "subject inválida".into()))?;

    let term_name = ensure_term_belongs_to_tenant(&state.pool, tenant_id, term_id).await?;
    let subject_name = ensure_subject_belongs_to_tenant(&state.pool, tenant_id, subject_id).await?;

    let class_row = sqlx::query(
        r#"
        SELECT c.name, c.grade, c.year, c.period, t.name AS school_name
        FROM classes c
        JOIN tenants t ON t.id = c.tenant_id
        WHERE c.tenant_id = $1 AND c.id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let class_row = class_row.ok_or((StatusCode::NOT_FOUND, "Turma não encontrada".into()))?;
    let class_name: String = class_row.get("name");
    let class_grade: String = class_row.get("grade");
    let class_year: i32 = class_row.get("year");
    let class_period: String = class_row.get("period");

    let row = sqlx::query(
        r#"
        SELECT
          s.id AS student_id,
          s.name AS student_name,
          s.registration,
          g.score::float8 AS score,
          COALESCE(g.absences, 0) AS absences_gradebook,
          g.comments,
          COALESCE(a.total_days, 0) AS attendance_total_days,
          COALESCE(a.present_days, 0) AS attendance_present_days
        FROM students s
        LEFT JOIN student_grades g
          ON g.tenant_id = s.tenant_id
         AND g.class_id = s.class_id
         AND g.student_id = s.id
         AND g.term_id = $4
         AND g.subject_id = $5
        LEFT JOIN (
          SELECT
            student_id,
            COUNT(*)::int AS total_days,
            SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_days
          FROM student_attendance
          WHERE tenant_id = $1 AND class_id = $2 AND subject_id = $5
          GROUP BY student_id
        ) a ON a.student_id = s.id
        WHERE s.tenant_id = $1
          AND s.class_id = $2
          AND s.id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .bind(term_id)
    .bind(subject_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;
    let total_days: i32 = row.get("attendance_total_days");
    let present_days: i32 = row.get("attendance_present_days");
    let absent_days = total_days.saturating_sub(present_days);
    let attendance_percent = if total_days > 0 {
        (present_days as f64 * 100.0) / total_days as f64
    } else {
        0.0
    };

    let student = GradebookReportStudent {
        student_id: row.get("student_id"),
        student_name: row.get("student_name"),
        registration: row.get("registration"),
        score: row.get("score"),
        absences_gradebook: row.get("absences_gradebook"),
        comments: row.get("comments"),
        attendance_total_days: total_days,
        attendance_present_days: present_days,
        attendance_absent_days: absent_days,
        attendance_percent,
    };

    Ok(Json(GradebookReportResponse {
        class_id,
        class_name,
        class_grade,
        class_year,
        class_period,
        term_id,
        term_name,
        subject_id,
        subject_name,
        generated_at: chrono::Utc::now().to_rfc3339(),
        students: vec![student],
    }))
}

async fn get_student_term_report(
    State(state): State<AppState>,
    user: AuthUser,
    Path((class_id, student_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<StudentTermReportQuery>,
) -> Result<Json<StudentTermReportResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    fetch_student_term_report(&state.pool, user.tenant_id, class_id, student_id, query.term_id).await.map(Json)
}

async fn create_student_term_report_share_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path((class_id, student_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<StudentTermReportQuery>,
    Json(req): Json<ShareStudentTermReportRequest>,
) -> Result<Json<ShareReportResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    ensure_student_belongs_to_class_by_pool(&state.pool, user.tenant_id, class_id, student_id).await?;
    ensure_term_belongs_to_tenant(&state.pool, user.tenant_id, query.term_id).await?;

    let expires_days = req.expires_days.unwrap_or(30).clamp(1, 365);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(expires_days);

    let claims = ParentTermReportClaims {
        sub: user.user_id.to_string(),
        tenant_id: user.tenant_id.to_string(),
        class_id: class_id.to_string(),
        student_id: student_id.to_string(),
        term_id: query.term_id.to_string(),
        scope: "parent_term_report".to_string(),
        exp: expires_at.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao gerar token".into()))?;

    Ok(Json(ShareReportResponse {
        token,
        expires_at: expires_at.to_rfc3339(),
    }))
}

async fn get_public_student_term_report(
    State(state): State<AppState>,
    Query(query): Query<PublicReportQuery>,
) -> Result<Json<StudentTermReportResponse>, (StatusCode, String)> {
    let data = decode::<ParentTermReportClaims>(
        &query.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Token inválido ou expirado".into()))?;

    if data.claims.scope != "parent_term_report" {
        return Err((StatusCode::UNAUTHORIZED, "Escopo de token inválido".into()));
    }

    let tenant_id = Uuid::parse_str(&data.claims.tenant_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "tenant inválido".into()))?;
    let class_id =
        Uuid::parse_str(&data.claims.class_id).map_err(|_| (StatusCode::BAD_REQUEST, "class inválida".into()))?;
    let student_id = Uuid::parse_str(&data.claims.student_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "student inválido".into()))?;
    let term_id =
        Uuid::parse_str(&data.claims.term_id).map_err(|_| (StatusCode::BAD_REQUEST, "term inválido".into()))?;

    fetch_student_term_report(&state.pool, tenant_id, class_id, student_id, term_id)
        .await
        .map(Json)
}

async fn get_student_full_report(
    State(state): State<AppState>,
    user: AuthUser,
    Path((class_id, student_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<StudentFullReportResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    fetch_student_full_report(&state.pool, user.tenant_id, class_id, student_id)
        .await
        .map(Json)
}

async fn create_student_full_report_share_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path((class_id, student_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<ShareStudentTermReportRequest>,
) -> Result<Json<ShareReportResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "teacher"])?;
    ensure_class_belongs_to_tenant(&state.pool, user.tenant_id, class_id).await?;
    ensure_student_belongs_to_class_by_pool(&state.pool, user.tenant_id, class_id, student_id).await?;

    let expires_days = req.expires_days.unwrap_or(30).clamp(1, 365);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(expires_days);

    let claims = ParentFullReportClaims {
        sub: user.user_id.to_string(),
        tenant_id: user.tenant_id.to_string(),
        class_id: class_id.to_string(),
        student_id: student_id.to_string(),
        scope: "parent_full_report".to_string(),
        exp: expires_at.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao gerar token".into()))?;

    Ok(Json(ShareReportResponse {
        token,
        expires_at: expires_at.to_rfc3339(),
    }))
}

async fn get_public_student_full_report(
    State(state): State<AppState>,
    Query(query): Query<PublicReportQuery>,
) -> Result<Json<StudentFullReportResponse>, (StatusCode, String)> {
    let data = decode::<ParentFullReportClaims>(
        &query.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Token inválido ou expirado".into()))?;

    if data.claims.scope != "parent_full_report" {
        return Err((StatusCode::UNAUTHORIZED, "Escopo de token inválido".into()));
    }

    let tenant_id = Uuid::parse_str(&data.claims.tenant_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "tenant inválido".into()))?;
    let class_id =
        Uuid::parse_str(&data.claims.class_id).map_err(|_| (StatusCode::BAD_REQUEST, "class inválida".into()))?;
    let student_id = Uuid::parse_str(&data.claims.student_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "student inválido".into()))?;

    fetch_student_full_report(&state.pool, tenant_id, class_id, student_id)
        .await
        .map(Json)
}

async fn fetch_student_full_report(
    pool: &PgPool,
    tenant_id: Uuid,
    class_id: Uuid,
    student_id: Uuid,
) -> Result<StudentFullReportResponse, (StatusCode, String)> {
    ensure_class_belongs_to_tenant(pool, tenant_id, class_id).await?;
    ensure_student_belongs_to_class_by_pool(pool, tenant_id, class_id, student_id).await?;

    let class_row = sqlx::query(
        r#"
        SELECT c.name, c.grade, c.year, c.period, t.passing_min_grade::float8 AS passing_min_grade
        FROM classes c
        JOIN tenants t ON t.id = c.tenant_id
        WHERE c.tenant_id = $1 AND c.id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let class_row = class_row.ok_or((StatusCode::NOT_FOUND, "Turma não encontrada".into()))?;
    let class_year: i32 = class_row.get("year");
    let min_passing_grade: f64 = class_row.get("passing_min_grade");

    let student_row = sqlx::query(
        r#"
        SELECT id, name, registration
        FROM students
        WHERE tenant_id = $1 AND class_id = $2 AND id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let student_row = student_row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;

    let attendance_row = sqlx::query(
        r#"
        SELECT
          COUNT(*)::int AS total_days,
          SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_days
        FROM student_attendance
        WHERE tenant_id = $1 AND class_id = $2 AND student_id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let total_days: i32 = attendance_row.get("total_days");
    let present_days: i32 = attendance_row.get::<Option<i32>, _>("present_days").unwrap_or(0);
    let absent_days = total_days.saturating_sub(present_days);
    let attendance_percent = if total_days > 0 {
        (present_days as f64 * 100.0) / total_days as f64
    } else {
        0.0
    };

    let period_rows = sqlx::query(
        r#"
        SELECT id AS term_id, name AS term_name, school_year, sort_order
        FROM academic_terms
        WHERE tenant_id = $1
          AND school_year = $2
        ORDER BY sort_order ASC, name ASC
        "#,
    )
    .bind(tenant_id)
    .bind(class_year)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let periods: Vec<StudentFullReportPeriod> = period_rows
        .into_iter()
        .map(|r| StudentFullReportPeriod {
            term_id: r.get("term_id"),
            term_name: r.get("term_name"),
            school_year: r.get("school_year"),
            sort_order: r.get("sort_order"),
        })
        .collect();

    let subject_rows = sqlx::query(
        r#"
        SELECT id AS subject_id, name AS subject_name
        FROM subjects
        WHERE tenant_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let grades_rows = sqlx::query(
        r#"
        SELECT
          g.subject_id,
          s.name AS subject_name,
          g.term_id,
          t.name AS term_name,
          t.school_year,
          t.sort_order,
          g.score::float8 AS score,
          COALESCE(g.absences, 0) AS absences_gradebook,
          g.comments
        FROM student_grades g
        JOIN subjects s ON s.id = g.subject_id AND s.tenant_id = g.tenant_id
        JOIN academic_terms t ON t.id = g.term_id AND t.tenant_id = g.tenant_id
        WHERE g.tenant_id = $1
          AND g.class_id = $2
          AND g.student_id = $3
        ORDER BY s.name ASC, t.school_year ASC, t.sort_order ASC
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut subject_map: HashMap<Uuid, (String, Vec<StudentFullReportPeriodGrade>)> = HashMap::new();
    for r in subject_rows {
        let subject_id: Uuid = r.get("subject_id");
        let subject_name: String = r.get("subject_name");
        subject_map.insert(subject_id, (subject_name, Vec::new()));
    }

    for r in grades_rows {
        let subject_id: Uuid = r.get("subject_id");
        let subject_name: String = r.get("subject_name");
        let term_id: Uuid = r.get("term_id");
        let term_name: String = r.get("term_name");
        let grade = StudentFullReportPeriodGrade {
            term_id,
            term_name,
            score: r.get("score"),
            absences_gradebook: r.get("absences_gradebook"),
            comments: r.get("comments"),
        };
        subject_map
            .entry(subject_id)
            .and_modify(|(_, list)| {
                list.push(StudentFullReportPeriodGrade {
                term_id: grade.term_id,
                term_name: grade.term_name.clone(),
                score: grade.score,
                absences_gradebook: grade.absences_gradebook,
                comments: grade.comments.clone(),
                })
            })
            .or_insert((subject_name, vec![grade]));
    }

    let mut subjects: Vec<StudentFullReportSubject> = subject_map
        .into_iter()
        .map(|(subject_id, (subject_name, period_grades))| {
            let mut sum = 0.0_f64;
            let mut count = 0_i32;
            for g in &period_grades {
                if let Some(score) = g.score {
                    sum += score;
                    count += 1;
                }
            }
            let average_score = if count > 0 {
                Some((sum / f64::from(count) * 100.0).round() / 100.0)
            } else {
                None
            };
            let approved = average_score.is_some_and(|avg| avg >= min_passing_grade);
            let status = if average_score.is_none() {
                "Sem notas".to_string()
            } else if approved {
                "Aprovado".to_string()
            } else {
                "Reprovado".to_string()
            };

            StudentFullReportSubject {
                subject_id,
                subject_name,
                period_grades,
                average_score,
                approved,
                status,
            }
        })
        .collect();
    subjects.sort_by(|a, b| a.subject_name.cmp(&b.subject_name));

    Ok(StudentFullReportResponse {
        class_id,
        class_name: class_row.get("name"),
        class_grade: class_row.get("grade"),
        class_year,
        class_period: class_row.get("period"),
        student_id,
        student_name: student_row.get("name"),
        registration: student_row.get("registration"),
        min_passing_grade,
        attendance_total_days: total_days,
        attendance_present_days: present_days,
        attendance_absent_days: absent_days,
        attendance_percent,
        generated_at: chrono::Utc::now().to_rfc3339(),
        periods,
        subjects,
    })
}

async fn fetch_student_term_report(
    pool: &PgPool,
    tenant_id: Uuid,
    class_id: Uuid,
    student_id: Uuid,
    term_id: Uuid,
) -> Result<StudentTermReportResponse, (StatusCode, String)> {
    ensure_class_belongs_to_tenant(pool, tenant_id, class_id).await?;
    ensure_student_belongs_to_class_by_pool(pool, tenant_id, class_id, student_id).await?;
    let term_name = ensure_term_belongs_to_tenant(pool, tenant_id, term_id).await?;

    let class_row = sqlx::query(
        r#"
        SELECT name, grade, year, period
        FROM classes
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let class_row = class_row.ok_or((StatusCode::NOT_FOUND, "Turma não encontrada".into()))?;

    let student_row = sqlx::query(
        r#"
        SELECT id, name, registration
        FROM students
        WHERE tenant_id = $1 AND class_id = $2 AND id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let student_row = student_row.ok_or((StatusCode::NOT_FOUND, "Aluno não encontrado".into()))?;

    let attendance_row = sqlx::query(
        r#"
        SELECT
          COUNT(*)::int AS total_days,
          SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_days
        FROM student_attendance
        WHERE tenant_id = $1 AND class_id = $2 AND student_id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let total_days: i32 = attendance_row.get("total_days");
    let present_days: Option<i32> = attendance_row.get("present_days");
    let present_days = present_days.unwrap_or(0);
    let absent_days = total_days.saturating_sub(present_days);
    let attendance_percent = if total_days > 0 {
        (present_days as f64 * 100.0) / total_days as f64
    } else {
        0.0
    };

    let subject_rows = sqlx::query(
        r#"
        SELECT
          sbj.id AS subject_id,
          sbj.name AS subject_name,
          g.score::float8 AS score,
          COALESCE(g.absences, 0) AS absences_gradebook,
          g.comments
        FROM subjects sbj
        LEFT JOIN student_grades g
          ON g.tenant_id = sbj.tenant_id
         AND g.class_id = $2
         AND g.student_id = $3
         AND g.term_id = $4
         AND g.subject_id = sbj.id
        WHERE sbj.tenant_id = $1
        ORDER BY sbj.name ASC
        "#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .bind(student_id)
    .bind(term_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let subjects = subject_rows
        .into_iter()
        .map(|r| StudentTermSubjectGrade {
            subject_id: r.get("subject_id"),
            subject_name: r.get("subject_name"),
            score: r.get("score"),
            absences_gradebook: r.get("absences_gradebook"),
            comments: r.get("comments"),
        })
        .collect();

    Ok(StudentTermReportResponse {
        class_id,
        class_name: class_row.get("name"),
        class_grade: class_row.get("grade"),
        class_year: class_row.get("year"),
        class_period: class_row.get("period"),
        term_id,
        term_name,
        student_id,
        student_name: student_row.get("name"),
        registration: student_row.get("registration"),
        attendance_total_days: total_days,
        attendance_present_days: present_days,
        attendance_absent_days: absent_days,
        attendance_percent,
        generated_at: chrono::Utc::now().to_rfc3339(),
        subjects,
    })
}

async fn ensure_class_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    class_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT 1
           FROM classes
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if row.is_none() {
        return Err((StatusCode::NOT_FOUND, "Turma não encontrada".into()));
    }
    Ok(())
}

async fn ensure_term_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    term_id: Uuid,
) -> Result<String, (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT name
           FROM academic_terms
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(term_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::BAD_REQUEST, "Período letivo inválido".into()))?;
    Ok(row.get("name"))
}

async fn ensure_subject_belongs_to_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    subject_id: Uuid,
) -> Result<String, (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT name
           FROM subjects
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(subject_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::BAD_REQUEST, "Disciplina inválida".into()))?;
    Ok(row.get("name"))
}

async fn ensure_student_belongs_to_class(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    class_id: Uuid,
    student_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT 1
           FROM students
           WHERE tenant_id = $1 AND id = $2 AND class_id = $3"#,
    )
    .bind(tenant_id)
    .bind(student_id)
    .bind(class_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Aluno não pertence a esta turma".into()));
    }
    Ok(())
}

async fn ensure_student_belongs_to_class_by_pool(
    pool: &PgPool,
    tenant_id: Uuid,
    class_id: Uuid,
    student_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"SELECT 1
           FROM students
           WHERE tenant_id = $1 AND id = $2 AND class_id = $3"#,
    )
    .bind(tenant_id)
    .bind(student_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Aluno não pertence a esta turma".into()));
    }
    Ok(())
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|v| v.trim().to_string())
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}
