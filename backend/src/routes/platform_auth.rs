use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct PlatformAuthState {
    pub jwt_secret: String,
    pub platform_admin_email: String,
    pub platform_admin_password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct PlatformLoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct PlatformAuthResponse {
    pub user_id: Uuid,
    pub token: String,
    pub role: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    tenant_id: Option<String>,
    role: String,
    scope: String,
    exp: usize,
}

pub fn routes(jwt_secret: String, platform_admin_email: String, platform_admin_password: String) -> Router {
    let state = PlatformAuthState {
        jwt_secret,
        platform_admin_email,
        platform_admin_password,
    };

    Router::new()
        .route("/platform/auth/login", post(login))
        .with_state(state)
}

async fn login(
    State(state): State<PlatformAuthState>,
    Json(req): Json<PlatformLoginRequest>,
) -> Result<Json<PlatformAuthResponse>, (StatusCode, String)> {
    req.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let email = req.email.trim().to_lowercase();
    if email != state.platform_admin_email || req.password != state.platform_admin_password {
        return Err((StatusCode::UNAUTHORIZED, "Credenciais inválidas".into()));
    }

    let user_id = Uuid::new_v4();
    let token = make_platform_jwt(&state.jwt_secret, user_id)?;

    Ok(Json(PlatformAuthResponse {
        user_id,
        token,
        role: "platform_admin".to_string(),
        scope: "platform".to_string(),
    }))
}

fn make_platform_jwt(jwt_secret: &str, user_id: Uuid) -> Result<String, (StatusCode, String)> {
    let exp = (chrono::Utc::now() + chrono::Duration::days(7)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id: None,
        role: "platform_admin".to_string(),
        scope: "platform".to_string(),
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro token".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::Request,
    };
    use serde_json::Value;
    use tower::util::ServiceExt;

    async fn call(
        app: Router,
        body: &str,
    ) -> (StatusCode, String) {
        let req = Request::builder()
            .method("POST")
            .uri("/platform/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .expect("falha request");

        let resp = app.oneshot(req).await.expect("falha oneshot");
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), usize::MAX)
            .await
            .expect("falha body");
        let text = String::from_utf8(bytes.to_vec()).expect("utf8");
        (status, text)
    }

    #[tokio::test]
    async fn platform_login_success() {
        let app = routes(
            "test-secret".to_string(),
            "admin@platform.local".to_string(),
            "admin123456".to_string(),
        );

        let (status, body) = call(
            app,
            r#"{"email":"admin@platform.local","password":"admin123456"}"#,
        )
        .await;

        assert_eq!(status, StatusCode::OK);
        let json: Value = serde_json::from_str(&body).expect("json inválido");
        assert_eq!(json.get("scope").and_then(|v| v.as_str()), Some("platform"));
        assert!(json.get("token").and_then(|v| v.as_str()).is_some());
    }

    #[tokio::test]
    async fn platform_login_invalid_credentials() {
        let app = routes(
            "test-secret".to_string(),
            "admin@platform.local".to_string(),
            "admin123456".to_string(),
        );

        let (status, _) = call(
            app,
            r#"{"email":"admin@platform.local","password":"senha-errada"}"#,
        )
        .await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
}
