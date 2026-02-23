use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde::Serialize;
use sqlx::Row;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct DashboardSummaryResponse {
    pub students_total: i64,
    pub classes_total: i64,
    pub teachers_total: i64,
    pub overdue_clients_total: i64,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/dashboard/summary", get(summary))
        .with_state(state)
}

async fn summary(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<DashboardSummaryResponse>, (StatusCode, String)> {
    let students_total: i64 = sqlx::query("SELECT COUNT(*) AS count FROM students WHERE tenant_id = $1")
        .bind(user.tenant_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
        .get("count");

    let classes_total: i64 = sqlx::query("SELECT COUNT(*) AS count FROM classes WHERE tenant_id = $1")
        .bind(user.tenant_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
        .get("count");

    let teachers_total: i64 = sqlx::query(
        r#"SELECT COUNT(*) AS count
           FROM users
           WHERE tenant_id = $1 AND role IN ('owner', 'admin', 'teacher', 'staff')"#,
    )
    .bind(user.tenant_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
    .get("count");

    // visão global de inadimplência para operador/admin interno
    let overdue_clients_total: i64 = sqlx::query(
        r#"SELECT COUNT(*) AS count
           FROM tenants
           WHERE billing_due_date < CURRENT_DATE"#,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
    .get("count");

    Ok(Json(DashboardSummaryResponse {
        students_total,
        classes_total,
        teachers_total,
        overdue_clients_total,
    }))
}
