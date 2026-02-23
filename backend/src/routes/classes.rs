use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, post},
    Json, Router,
};
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateClassRequest {
    #[validate(length(min = 1))]
    pub name: String,   // ex: "Turma A"
    #[validate(length(min = 1))]
    pub grade: String,  // ex: "1º ano"
    pub year: Option<i32>,
    pub period: Option<String>, // matutino, vespertino, noturno, integral
}

#[derive(Debug, Serialize)]
pub struct ClassResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub grade: String,
    pub year: i32,
    pub period: String,
}

#[derive(Debug, Serialize)]
pub struct OkResponse { pub ok: bool }

pub fn routes(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    Router::new()
        .route("/classes", post(create_class).get(list_classes))
        .route("/classes/:class_id", delete(delete_class))
        .with_state(state)
}

async fn create_class(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateClassRequest>,
) -> Result<Json<ClassResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let id = Uuid::new_v4();
    let year = req.year.unwrap_or_else(|| chrono::Utc::now().year());
    let period = normalize_period(req.period.as_deref())?;

    sqlx::query(
        r#"INSERT INTO classes (id, tenant_id, name, grade, year, period)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(req.name.trim())
    .bind(req.grade.trim())
    .bind(year)
    .bind(&period)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    Ok(Json(ClassResponse {
        id,
        tenant_id: user.tenant_id,
        name: req.name,
        grade: req.grade,
        year,
        period,
    }))
}

async fn list_classes(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<ClassResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        r#"SELECT id, tenant_id, name, grade, year, period
           FROM classes
           WHERE tenant_id = $1
           ORDER BY year DESC, grade ASC, name ASC"#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let out = rows
        .into_iter()
        .map(|r| ClassResponse {
            id: r.get("id"),
            tenant_id: r.get("tenant_id"),
            name: r.get("name"),
            grade: r.get("grade"),
            year: r.get("year"),
            period: r.get("period"),
        })
        .collect();

    Ok(Json(out))
}

async fn delete_class(
    State(state): State<AppState>,
    user: AuthUser,
    Path(class_id): Path<Uuid>,
) -> Result<Json<OkResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    let res = sqlx::query(
        r#"DELETE FROM classes
           WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(user.tenant_id)
    .bind(class_id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Turma não encontrada".into()));
    }

    Ok(Json(OkResponse { ok: true }))
}

fn normalize_period(input: Option<&str>) -> Result<String, (StatusCode, String)> {
    let period = input.unwrap_or("matutino").trim().to_lowercase();
    match period.as_str() {
        "matutino" | "vespertino" | "noturno" | "integral" => Ok(period),
        _ => Err((StatusCode::BAD_REQUEST, "Período inválido".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::Request,
    };
    use chrono::Utc;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde_json::Value;
    use sqlx::postgres::PgPoolOptions;
    use tower::util::ServiceExt;

    use crate::auth::jwt::Claims;

    fn test_db_url() -> String {
        dotenvy::dotenv().ok();
        std::env::var("DATABASE_URL")
            .expect("DATABASE_URL precisa estar definido para rodar os testes")
    }

    async fn test_pool() -> PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&test_db_url())
            .await
            .expect("falha ao conectar no banco de teste");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("falha ao rodar migrations");

        pool
    }

    async fn insert_tenant(pool: &PgPool, tenant_id: Uuid, name: &str) {
        sqlx::query(
            r#"
            INSERT INTO tenants (id, name, slug, billing_due_date)
            VALUES ($1, $2, $3, (CURRENT_DATE + INTERVAL '30 days')::date)
            "#,
        )
            .bind(tenant_id)
            .bind(name)
            .bind(format!("{}-{}", name.to_lowercase(), tenant_id))
            .execute(pool)
            .await
            .expect("falha ao criar tenant de teste");
    }

    async fn cleanup_tenant(pool: &PgPool, tenant_id: Uuid) {
        sqlx::query("DELETE FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .execute(pool)
            .await
            .expect("falha ao limpar tenant de teste");
    }

    fn make_token(secret: &str, tenant_id: Uuid) -> String {
        let claims = Claims {
            sub: Uuid::new_v4().to_string(),
            tenant_id: Some(tenant_id.to_string()),
            role: "owner".to_string(),
            scope: "tenant".to_string(),
            exp: (Utc::now() + chrono::Duration::days(7)).timestamp() as usize,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .expect("falha ao gerar token de teste")
    }

    async fn call_json(
        app: &Router,
        method: &str,
        path: &str,
        token: Option<&str>,
        body: Option<&str>,
    ) -> (StatusCode, String) {
        let mut req = Request::builder().method(method).uri(path);
        req = req.header("content-type", "application/json");

        if let Some(t) = token {
            req = req.header("authorization", format!("Bearer {t}"));
        }

        let request = req
            .body(Body::from(body.unwrap_or_default().to_string()))
            .expect("falha ao construir request");

        let resp = app
            .clone()
            .oneshot(request)
            .await
            .expect("falha ao executar request");
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), usize::MAX)
            .await
            .expect("falha ao ler body");
        let text = String::from_utf8(bytes.to_vec()).expect("body não UTF-8");

        (status, text)
    }

    fn parse_json(text: &str) -> Value {
        serde_json::from_str(text).expect("resposta não é JSON válido")
    }

    #[tokio::test]
    async fn http_flow_create_list_delete_class() {
        let pool = test_pool().await;
        let secret = "test-secret-http";
        let tenant_id = Uuid::new_v4();
        insert_tenant(&pool, tenant_id, "tenant-http-flow").await;
        let app = routes(pool.clone(), secret.to_string());
        let token = make_token(secret, tenant_id);

        let (create_status, create_body) = call_json(
            &app,
            "POST",
            "/classes",
            Some(&token),
            Some(r#"{"name":"Turma HTTP","grade":"1 ano","year":2026}"#),
        )
        .await;
        assert_eq!(create_status, StatusCode::OK);
        let created = parse_json(&create_body);
        let class_id = created
            .get("id")
            .and_then(|v| v.as_str())
            .expect("id ausente na criação");

        let (list_status, list_body) = call_json(&app, "GET", "/classes", Some(&token), None).await;
        assert_eq!(list_status, StatusCode::OK);
        let list = parse_json(&list_body).as_array().cloned().expect("lista inválida");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].get("id").and_then(|v| v.as_str()), Some(class_id));

        let (delete_status, delete_body) =
            call_json(&app, "DELETE", &format!("/classes/{class_id}"), Some(&token), None).await;
        assert_eq!(delete_status, StatusCode::OK);
        assert_eq!(
            parse_json(&delete_body).get("ok").and_then(|v| v.as_bool()),
            Some(true)
        );

        let (list2_status, list2_body) = call_json(&app, "GET", "/classes", Some(&token), None).await;
        assert_eq!(list2_status, StatusCode::OK);
        let list2 = parse_json(&list2_body).as_array().cloned().expect("lista inválida");
        assert!(list2.is_empty());

        cleanup_tenant(&pool, tenant_id).await;
    }

    #[tokio::test]
    async fn http_list_classes_is_scoped_by_tenant() {
        let pool = test_pool().await;
        let secret = "test-secret-scope";
        let tenant_a = Uuid::new_v4();
        let tenant_b = Uuid::new_v4();
        insert_tenant(&pool, tenant_a, "tenant-http-a").await;
        insert_tenant(&pool, tenant_b, "tenant-http-b").await;

        let app = routes(pool.clone(), secret.to_string());
        let token_a = make_token(secret, tenant_a);
        let token_b = make_token(secret, tenant_b);

        let (create_a_status, _) = call_json(
            &app,
            "POST",
            "/classes",
            Some(&token_a),
            Some(r#"{"name":"Turma A","grade":"1 ano","year":2026}"#),
        )
        .await
        ;
        assert_eq!(create_a_status, StatusCode::OK);

        let (create_b_status, _) = call_json(
            &app,
            "POST",
            "/classes",
            Some(&token_b),
            Some(r#"{"name":"Turma B","grade":"2 ano","year":2026}"#),
        )
        .await;
        assert_eq!(create_b_status, StatusCode::OK);

        let (list_a_status, list_a_body) =
            call_json(&app, "GET", "/classes", Some(&token_a), None).await;
        assert_eq!(list_a_status, StatusCode::OK);
        let list_a = parse_json(&list_a_body).as_array().cloned().expect("lista inválida");
        assert_eq!(list_a.len(), 1);
        assert_eq!(list_a[0].get("name").and_then(|v| v.as_str()), Some("Turma A"));

        cleanup_tenant(&pool, tenant_a).await;
        cleanup_tenant(&pool, tenant_b).await;
    }

    #[tokio::test]
    async fn http_create_class_requires_auth() {
        let pool = test_pool().await;
        let app = routes(pool, "test-secret-auth".to_string());

        let (status, _) = call_json(
            &app,
            "POST",
            "/classes",
            None,
            Some(r#"{"name":"Turma Sem Auth","grade":"1 ano","year":2026}"#),
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn http_create_class_validates_empty_name() {
        let pool = test_pool().await;
        let secret = "test-secret-validation";
        let tenant_id = Uuid::new_v4();
        insert_tenant(&pool, tenant_id, "tenant-http-validation").await;
        let app = routes(pool.clone(), secret.to_string());
        let token = make_token(secret, tenant_id);

        let (status, _) = call_json(
            &app,
            "POST",
            "/classes",
            Some(&token),
            Some(r#"{"name":"","grade":"1 ano","year":2026}"#),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        cleanup_tenant(&pool, tenant_id).await;
    }
}
