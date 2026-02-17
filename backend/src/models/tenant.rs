use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}
