use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Student {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub registration: String,
    pub created_at: DateTime<Utc>,
}
