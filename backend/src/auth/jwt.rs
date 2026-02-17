use axum::{
    async_trait,
    extract::{FromRequestParts, State},
    http::{request::Parts, StatusCode},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // user_id
    pub tenant_id: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Pegamos AppState via State extractor
        let State(app): State<crate::state::AppState> =
            State::from_request_parts(parts, state).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, "State inválido".into())
            })?;

        let auth = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Sem Authorization".into()))?;

        let token = auth
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Bearer inválido".into()))?;

        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(app.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Token inválido".into()))?;

        let user_id = Uuid::parse_str(&data.claims.sub)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "sub inválido".into()))?;
        let tenant_id = Uuid::parse_str(&data.claims.tenant_id)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "tenant inválido".into()))?;

        Ok(AuthUser {
            user_id,
            tenant_id,
            role: data.claims.role,
        })
    }
}
