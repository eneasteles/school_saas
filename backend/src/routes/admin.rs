use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use validator::Validate;

use crate::auth::jwt::PlatformUser;
use crate::state::AppState;

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientStatusFilter {
    #[default]
    All,
    OnTime,
    Overdue,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ListClientsQuery {
    #[serde(default)]
    pub status: ClientStatusFilter,
}

#[derive(Debug, Serialize)]
pub struct AdminClientResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: NaiveDateTime,
    pub billing_due_date: NaiveDate,
    pub payment_status: String,
    pub days_overdue: i32,
    pub passing_min_grade: f64,
}

#[derive(Debug, Serialize)]
pub struct MarkClientPaidResponse {
    pub tenant_id: uuid::Uuid,
    pub billing_due_date: NaiveDate,
    pub payment_status: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePassingGradeRequest {
    pub passing_min_grade: f64,
}

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/admin/clients", get(list_clients))
        .route("/admin/clients/:tenant_id/mark-paid", post(mark_client_paid))
        .route(
            "/admin/clients/:tenant_id/passing-grade",
            put(update_passing_grade),
        )
        .with_state(state)
}

async fn list_clients(
    State(state): State<AppState>,
    platform_user: PlatformUser,
    Query(query): Query<ListClientsQuery>,
) -> Result<Json<Vec<AdminClientResponse>>, (StatusCode, String)> {
    if platform_user.role != "platform_admin" {
        return Err((StatusCode::FORBIDDEN, "Sem permissão".into()));
    }

    let status = match query.status {
        ClientStatusFilter::All => "all",
        ClientStatusFilter::OnTime => "on_time",
        ClientStatusFilter::Overdue => "overdue",
    };

    let rows = sqlx::query(
        r#"
        SELECT
          t.id,
          t.name,
          t.slug,
          t.created_at,
          t.billing_due_date,
          CASE
            WHEN t.billing_due_date < CURRENT_DATE THEN 'overdue'
            ELSE 'on_time'
          END AS payment_status,
          CASE
            WHEN t.billing_due_date < CURRENT_DATE THEN (CURRENT_DATE - t.billing_due_date)
            ELSE 0
          END::int AS days_overdue
          ,
          t.passing_min_grade::float8 AS passing_min_grade
        FROM tenants t
        WHERE
          ($1::text = 'all')
          OR ($1::text = 'on_time' AND t.billing_due_date >= CURRENT_DATE)
          OR ($1::text = 'overdue' AND t.billing_due_date < CURRENT_DATE)
        ORDER BY t.billing_due_date ASC, t.name ASC
        "#,
    )
    .bind(status)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let clients = rows
        .into_iter()
        .map(|r| AdminClientResponse {
            id: r.get("id"),
            name: r.get("name"),
            slug: r.get("slug"),
            created_at: r.get("created_at"),
            billing_due_date: r.get("billing_due_date"),
            payment_status: r.get("payment_status"),
            days_overdue: r.get("days_overdue"),
            passing_min_grade: r.get("passing_min_grade"),
        })
        .collect();

    Ok(Json(clients))
}

async fn mark_client_paid(
    State(state): State<AppState>,
    platform_user: PlatformUser,
    Path(tenant_id): Path<uuid::Uuid>,
) -> Result<Json<MarkClientPaidResponse>, (StatusCode, String)> {
    if platform_user.role != "platform_admin" {
        return Err((StatusCode::FORBIDDEN, "Sem permissão".into()));
    }

    let row = sqlx::query(
        r#"
        UPDATE tenants
        SET billing_due_date = (GREATEST(billing_due_date, CURRENT_DATE) + INTERVAL '30 days')::date
        WHERE id = $1
        RETURNING id, billing_due_date
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;
    let due_date: NaiveDate = row.get("billing_due_date");

    Ok(Json(MarkClientPaidResponse {
        tenant_id: row.get("id"),
        billing_due_date: due_date,
        payment_status: "on_time".to_string(),
    }))
}

async fn update_passing_grade(
    State(state): State<AppState>,
    platform_user: PlatformUser,
    Path(tenant_id): Path<uuid::Uuid>,
    Json(req): Json<UpdatePassingGradeRequest>,
) -> Result<Json<AdminClientResponse>, (StatusCode, String)> {
    if platform_user.role != "platform_admin" {
        return Err((StatusCode::FORBIDDEN, "Sem permissão".into()));
    }

    if !(0.0..=10.0).contains(&req.passing_min_grade) {
        return Err((StatusCode::BAD_REQUEST, "Média mínima deve estar entre 0 e 10".into()));
    }

    let row = sqlx::query(
        r#"
        UPDATE tenants
        SET passing_min_grade = $2
        WHERE id = $1
        RETURNING
          id, name, slug, created_at, billing_due_date,
          CASE WHEN billing_due_date < CURRENT_DATE THEN 'overdue' ELSE 'on_time' END AS payment_status,
          CASE WHEN billing_due_date < CURRENT_DATE THEN (CURRENT_DATE - billing_due_date) ELSE 0 END::int AS days_overdue,
          passing_min_grade::float8 AS passing_min_grade
        "#,
    )
    .bind(tenant_id)
    .bind(req.passing_min_grade)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;
    Ok(Json(AdminClientResponse {
        id: row.get("id"),
        name: row.get("name"),
        slug: row.get("slug"),
        created_at: row.get("created_at"),
        billing_due_date: row.get("billing_due_date"),
        payment_status: row.get("payment_status"),
        days_overdue: row.get("days_overdue"),
        passing_min_grade: row.get("passing_min_grade"),
    }))
}
