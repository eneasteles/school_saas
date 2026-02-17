use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}
