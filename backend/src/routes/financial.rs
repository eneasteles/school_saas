use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::env;
use sqlx::Row;
use uuid::Uuid;
use validator::Validate;

use crate::auth::jwt::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFinancialContractRequest {
    pub student_id: Uuid,
    pub payer_person_id: Option<Uuid>,
    pub recipient_person_ids: Vec<Uuid>,
    #[validate(length(min = 2))]
    pub description: String,
    pub total_amount: f64,
    pub installments_count: i32,
    pub first_due_date: NaiveDate,
    pub due_day: Option<i32>,
    pub billing_mode: Option<String>,
    pub school_pix_key: Option<String>,
    pub school_payment_instructions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MarkInstallmentPaidRequest {
    pub paid_at: Option<NaiveDate>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFinancialAccountRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub account_type: String,
    pub initial_balance: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct FinancialAccountResponse {
    pub id: Uuid,
    pub name: String,
    pub account_type: String,
    pub initial_balance: f64,
    pub current_balance: f64,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFinancialCounterpartyRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
pub struct FinancialCounterpartyResponse {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFinancialCategoryRequest {
    #[validate(length(min = 2))]
    pub name: String,
    pub flow: String,
}

#[derive(Debug, Serialize)]
pub struct FinancialCategoryResponse {
    pub id: Uuid,
    pub name: String,
    pub flow: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePayableRequest {
    #[validate(length(min = 2))]
    pub description: String,
    pub vendor_person_id: Option<Uuid>,
    pub vendor_counterparty_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub due_date: NaiveDate,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct MarkPayablePaidRequest {
    pub account_id: Uuid,
    pub paid_at: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct PayableResponse {
    pub id: Uuid,
    pub description: String,
    pub vendor_person_id: Option<Uuid>,
    pub vendor_counterparty_id: Option<Uuid>,
    pub vendor_name: Option<String>,
    pub category_id: Option<Uuid>,
    pub category: Option<String>,
    pub due_date: NaiveDate,
    pub amount: f64,
    pub status: String,
    pub account_id: Option<Uuid>,
    pub paid_at: Option<NaiveDate>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateReceivableRequest {
    #[validate(length(min = 2))]
    pub description: String,
    pub payer_person_id: Option<Uuid>,
    pub payer_counterparty_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub due_date: NaiveDate,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct MarkReceivableReceivedRequest {
    pub account_id: Uuid,
    pub received_at: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct ReceivableResponse {
    pub id: Uuid,
    pub description: String,
    pub payer_person_id: Option<Uuid>,
    pub payer_counterparty_id: Option<Uuid>,
    pub payer_name: Option<String>,
    pub category_id: Option<Uuid>,
    pub category: Option<String>,
    pub due_date: NaiveDate,
    pub amount: f64,
    pub status: String,
    pub source_type: String,
    pub contract_id: Option<Uuid>,
    pub installment_id: Option<Uuid>,
    pub student_id: Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub received_at: Option<NaiveDate>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTransferRequest {
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub transfer_date: NaiveDate,
    pub amount: f64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TransferResponse {
    pub id: Uuid,
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub transfer_date: NaiveDate,
    pub amount: f64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallmentResponse {
    pub id: Uuid,
    pub installment_number: i32,
    pub due_date: NaiveDate,
    pub amount: f64,
    pub status: String,
    pub boleto_code: Option<String>,
    pub boleto_url: Option<String>,
    pub boleto_pdf_url: Option<String>,
    pub pix_copy_paste: Option<String>,
    pub payment_instructions: Option<String>,
    pub emailed_at: Option<chrono::NaiveDateTime>,
    pub paid_at: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct ContractResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub student_id: Uuid,
    pub student_name: String,
    pub school_name: String,
    pub school_code: String,
    pub school_city: Option<String>,
    pub school_signature_name: Option<String>,
    pub payer_person_id: Option<Uuid>,
    pub recipient_person_ids: Vec<Uuid>,
    pub description: String,
    pub total_amount: f64,
    pub installments_count: i32,
    pub first_due_date: NaiveDate,
    pub due_day: Option<i32>,
    pub billing_mode: String,
    pub school_pix_key: Option<String>,
    pub school_payment_instructions: Option<String>,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
    pub installments: Vec<InstallmentResponse>,
}

#[derive(Debug, Serialize)]
pub struct SendEmailResult {
    pub sent_to: i32,
    pub installments_sent: i32,
}

#[derive(Debug, Serialize)]
pub struct ContractTemplateResponse {
    pub school_name: String,
    pub school_code: String,
    pub school_city: Option<String>,
    pub school_signature_name: Option<String>,
    pub template: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContractTemplateRequest {
    pub template: String,
    pub school_city: Option<String>,
    pub school_signature_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FinancialGuardianStatementQuery {
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct FinancialGuardianStatementItem {
    pub receivable_id: Uuid,
    pub description: String,
    pub student_id: Option<Uuid>,
    pub student_name: Option<String>,
    pub due_date: NaiveDate,
    pub amount: f64,
    pub status: String,
    pub received_at: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct FinancialGuardianStatementResponse {
    pub person_id: Uuid,
    pub person_name: String,
    pub person_email: Option<String>,
    pub person_phone: Option<String>,
    pub person_document: Option<String>,
    pub person_street: Option<String>,
    pub person_address_number: Option<String>,
    pub person_neighborhood: Option<String>,
    pub person_city_name: Option<String>,
    pub person_state_uf: Option<String>,
    pub school_name: String,
    pub school_code: String,
    pub school_city: Option<String>,
    pub school_signature_name: Option<String>,
    pub total_paid: f64,
    pub total_open: f64,
    pub pending_balance_total: f64,
    pub items: Vec<FinancialGuardianStatementItem>,
}

pub fn routes(pool: sqlx::PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };
    Router::new()
        .route("/financial/accounts", post(create_financial_account).get(list_financial_accounts))
        .route(
            "/financial/counterparties",
            post(create_financial_counterparty).get(list_financial_counterparties),
        )
        .route(
            "/financial/categories",
            post(create_financial_category).get(list_financial_categories),
        )
        .route("/financial/transfers", post(create_transfer).get(list_transfers))
        .route("/financial/payables", post(create_payable).get(list_payables))
        .route("/financial/payables/:payable_id/pay", put(mark_payable_paid))
        .route("/financial/receivables", post(create_receivable).get(list_receivables))
        .route("/financial/receivables/:receivable_id/receive", put(mark_receivable_received))
        .route("/financial/payers/:person_id/statement", get(get_financial_guardian_statement))
        .route("/financial/contracts", post(create_contract).get(list_contracts))
        .route(
            "/financial/contract-template",
            get(get_contract_template).put(update_contract_template),
        )
        .route("/financial/contracts/:contract_id", get(get_contract))
        .route("/financial/contracts/:contract_id/generate-boletos", post(generate_boletos))
        .route("/financial/contracts/:contract_id/send-boletos-email", post(send_boletos_email))
        .route(
            "/financial/contracts/:contract_id/installments/:installment_id/pay",
            put(mark_installment_paid),
        )
        .with_state(state)
}

async fn create_financial_account(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateFinancialAccountRequest>,
) -> Result<Json<FinancialAccountResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let account_type = normalize_account_type(req.account_type.as_str())?;
    let initial_balance = round2(req.initial_balance.unwrap_or(0.0));

    let row = sqlx::query(
        r#"
        INSERT INTO financial_accounts (id, tenant_id, name, account_type, initial_balance, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id, name, account_type, initial_balance::float8 AS initial_balance, is_active
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.tenant_id)
    .bind(req.name.trim())
    .bind(account_type)
    .bind(initial_balance)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(FinancialAccountResponse {
        id: row.get("id"),
        name: row.get("name"),
        account_type: row.get("account_type"),
        initial_balance: row.get("initial_balance"),
        current_balance: row.get("initial_balance"),
        is_active: row.get("is_active"),
    }))
}

async fn list_financial_accounts(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<FinancialAccountResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT
          a.id,
          a.name,
          a.account_type,
          a.initial_balance::float8 AS initial_balance,
          a.is_active,
          (
            a.initial_balance
            + COALESCE(SUM(
              CASE
                WHEN m.movement_type = 'credit' THEN m.amount
                ELSE -m.amount
              END
            ), 0)
          )::float8 AS current_balance
        FROM financial_accounts a
        LEFT JOIN financial_account_movements m
          ON m.account_id = a.id
         AND m.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1
        GROUP BY a.id
        ORDER BY a.is_active DESC, a.name ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(
        rows.into_iter()
            .map(|row| FinancialAccountResponse {
                id: row.get("id"),
                name: row.get("name"),
                account_type: row.get("account_type"),
                initial_balance: row.get("initial_balance"),
                current_balance: row.get("current_balance"),
                is_active: row.get("is_active"),
            })
            .collect(),
    ))
}

async fn create_financial_counterparty(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateFinancialCounterpartyRequest>,
) -> Result<Json<FinancialCounterpartyResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let kind = normalize_counterparty_kind(req.kind.as_str())?;

    let row = sqlx::query(
        r#"
        INSERT INTO financial_counterparties (id, tenant_id, name, kind, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING id, name, kind, is_active
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.tenant_id)
    .bind(req.name.trim())
    .bind(kind)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(FinancialCounterpartyResponse {
        id: row.get("id"),
        name: row.get("name"),
        kind: row.get("kind"),
        is_active: row.get("is_active"),
    }))
}

async fn list_financial_counterparties(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<FinancialCounterpartyResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    let rows = sqlx::query(
        r#"
        SELECT id, name, kind, is_active
        FROM financial_counterparties
        WHERE tenant_id = $1
        ORDER BY is_active DESC, name ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(
        rows.into_iter()
            .map(|row| FinancialCounterpartyResponse {
                id: row.get("id"),
                name: row.get("name"),
                kind: row.get("kind"),
                is_active: row.get("is_active"),
            })
            .collect(),
    ))
}

async fn create_financial_category(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateFinancialCategoryRequest>,
) -> Result<Json<FinancialCategoryResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let flow = normalize_category_flow(req.flow.as_str())?;

    let row = sqlx::query(
        r#"
        INSERT INTO financial_categories (id, tenant_id, name, flow, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING id, name, flow, is_active
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.tenant_id)
    .bind(req.name.trim())
    .bind(flow)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(FinancialCategoryResponse {
        id: row.get("id"),
        name: row.get("name"),
        flow: row.get("flow"),
        is_active: row.get("is_active"),
    }))
}

async fn list_financial_categories(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<FinancialCategoryResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    let rows = sqlx::query(
        r#"
        SELECT id, name, flow, is_active
        FROM financial_categories
        WHERE tenant_id = $1
        ORDER BY is_active DESC, name ASC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(
        rows.into_iter()
            .map(|row| FinancialCategoryResponse {
                id: row.get("id"),
                name: row.get("name"),
                flow: row.get("flow"),
                is_active: row.get("is_active"),
            })
            .collect(),
    ))
}

async fn create_payable(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreatePayableRequest>,
) -> Result<Json<PayableResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    if req.amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Valor deve ser maior que zero".into()));
    }
    if let Some(id) = req.vendor_person_id {
        ensure_person_belongs_to_tenant(&state.pool, user.tenant_id, id).await?;
    }
    if let Some(id) = req.vendor_counterparty_id {
        ensure_counterparty_belongs_to_tenant(&state.pool, user.tenant_id, id, "vendor").await?;
    }
    if let Some(id) = req.category_id {
        ensure_category_belongs_to_tenant(&state.pool, user.tenant_id, id, "payable").await?;
    }

    let row = sqlx::query(
        r#"
        INSERT INTO financial_payables (
          id, tenant_id, description, vendor_person_id, vendor_counterparty_id, category_id, due_date, amount, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING id, description, vendor_person_id, vendor_counterparty_id, category_id,
                  vendor_name AS vendor_name_legacy, category AS category_legacy, due_date,
                  amount::float8 AS amount, status, account_id, paid_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.tenant_id)
    .bind(req.description.trim())
    .bind(req.vendor_person_id)
    .bind(req.vendor_counterparty_id)
    .bind(req.category_id)
    .bind(req.due_date)
    .bind(round2(req.amount))
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let vendor_person_id: Option<Uuid> = row.get("vendor_person_id");
    let vendor_name = match load_person_name(&state.pool, user.tenant_id, vendor_person_id).await? {
        Some(v) => Some(v),
        None => match load_counterparty_name(&state.pool, user.tenant_id, row.get("vendor_counterparty_id")).await? {
            Some(v) => Some(v),
            None => row.get("vendor_name_legacy"),
        },
    };
    let category_name = match load_category_name(&state.pool, user.tenant_id, row.get("category_id")).await? {
        Some(v) => Some(v),
        None => row.get("category_legacy"),
    };
    Ok(Json(PayableResponse {
        id: row.get("id"),
        description: row.get("description"),
        vendor_person_id,
        vendor_counterparty_id: row.get("vendor_counterparty_id"),
        vendor_name,
        category_id: row.get("category_id"),
        category: category_name,
        due_date: row.get("due_date"),
        amount: row.get("amount"),
        status: row.get("status"),
        account_id: row.get("account_id"),
        paid_at: row.get("paid_at"),
    }))
}

async fn list_payables(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<PayableResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT id, description, vendor_person_id, vendor_counterparty_id, category_id,
               vendor_name AS vendor_name_legacy, category AS category_legacy, due_date,
               amount::float8 AS amount, status, account_id, paid_at
        FROM financial_payables
        WHERE tenant_id = $1
        ORDER BY status ASC, due_date ASC, created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let vendor_person_id: Option<Uuid> = row.get("vendor_person_id");
        let vendor_counterparty_id: Option<Uuid> = row.get("vendor_counterparty_id");
        let category_id: Option<Uuid> = row.get("category_id");
        out.push(PayableResponse {
            id: row.get("id"),
            description: row.get("description"),
            vendor_person_id,
            vendor_counterparty_id,
            vendor_name: match load_person_name(&state.pool, user.tenant_id, vendor_person_id).await? {
                Some(v) => Some(v),
                None => match load_counterparty_name(&state.pool, user.tenant_id, vendor_counterparty_id).await? {
                    Some(v) => Some(v),
                    None => row.get("vendor_name_legacy"),
                },
            },
            category_id,
            category: match load_category_name(&state.pool, user.tenant_id, category_id).await? {
                Some(v) => Some(v),
                None => row.get("category_legacy"),
            },
            due_date: row.get("due_date"),
            amount: row.get("amount"),
            status: row.get("status"),
            account_id: row.get("account_id"),
            paid_at: row.get("paid_at"),
        });
    }
    Ok(Json(out))
}

async fn mark_payable_paid(
    State(state): State<AppState>,
    user: AuthUser,
    Path(payable_id): Path<Uuid>,
    Json(req): Json<MarkPayablePaidRequest>,
) -> Result<Json<PayableResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    ensure_account_belongs_to_tenant(&state.pool, user.tenant_id, req.account_id).await?;

    let paid_at = req.paid_at.unwrap_or_else(|| Utc::now().date_naive());
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        UPDATE financial_payables
        SET status = 'paid',
            account_id = $3,
            paid_at = $4
        WHERE tenant_id = $1
          AND id = $2
          AND status = 'pending'
        RETURNING id, description, vendor_person_id, vendor_counterparty_id, category_id,
                  vendor_name AS vendor_name_legacy, category AS category_legacy, due_date,
                  amount::float8 AS amount, status, account_id, paid_at
        "#,
    )
    .bind(user.tenant_id)
    .bind(payable_id)
    .bind(req.account_id)
    .bind(paid_at)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::BAD_REQUEST, "Conta a pagar não encontrada ou já quitada".into()))?;
    let amount: f64 = row.get("amount");
    insert_account_movement(
        &mut tx,
        user.tenant_id,
        req.account_id,
        "debit",
        "payable_payment",
        payable_id,
        paid_at,
        amount,
        Some("Baixa de conta a pagar"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let vendor_person_id: Option<Uuid> = row.get("vendor_person_id");
    let vendor_counterparty_id: Option<Uuid> = row.get("vendor_counterparty_id");
    let category_id: Option<Uuid> = row.get("category_id");
    Ok(Json(PayableResponse {
        id: row.get("id"),
        description: row.get("description"),
        vendor_person_id,
        vendor_counterparty_id,
        vendor_name: match load_person_name(&state.pool, user.tenant_id, vendor_person_id).await? {
            Some(v) => Some(v),
            None => match load_counterparty_name(&state.pool, user.tenant_id, vendor_counterparty_id).await? {
                Some(v) => Some(v),
                None => row.get("vendor_name_legacy"),
            },
        },
        category_id,
        category: match load_category_name(&state.pool, user.tenant_id, category_id).await? {
            Some(v) => Some(v),
            None => row.get("category_legacy"),
        },
        due_date: row.get("due_date"),
        amount,
        status: row.get("status"),
        account_id: row.get("account_id"),
        paid_at: row.get("paid_at"),
    }))
}

async fn create_receivable(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateReceivableRequest>,
) -> Result<Json<ReceivableResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    if req.amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Valor deve ser maior que zero".into()));
    }
    if let Some(id) = req.payer_person_id {
        ensure_person_belongs_to_tenant(&state.pool, user.tenant_id, id).await?;
    }
    if let Some(id) = req.payer_counterparty_id {
        ensure_counterparty_belongs_to_tenant(&state.pool, user.tenant_id, id, "payer").await?;
    }
    if let Some(id) = req.category_id {
        ensure_category_belongs_to_tenant(&state.pool, user.tenant_id, id, "receivable").await?;
    }

    let row = sqlx::query(
        r#"
        INSERT INTO financial_receivables (
          id, tenant_id, description, payer_person_id, payer_counterparty_id, category_id, due_date, amount, status, source_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'manual')
        RETURNING id, description, payer_person_id, payer_counterparty_id, category_id, due_date,
                  amount::float8 AS amount, status, source_type, contract_id, installment_id,
                  student_id, account_id, received_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.tenant_id)
    .bind(req.description.trim())
    .bind(req.payer_person_id)
    .bind(req.payer_counterparty_id)
    .bind(req.category_id)
    .bind(req.due_date)
    .bind(round2(req.amount))
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let payer_person_id: Option<Uuid> = row.get("payer_person_id");
    let payer_counterparty_id: Option<Uuid> = row.get("payer_counterparty_id");
    let category_id: Option<Uuid> = row.get("category_id");
    Ok(Json(ReceivableResponse {
        id: row.get("id"),
        description: row.get("description"),
        payer_person_id,
        payer_counterparty_id,
        payer_name: match load_person_name(&state.pool, user.tenant_id, payer_person_id).await? {
            Some(v) => Some(v),
            None => load_counterparty_name(&state.pool, user.tenant_id, payer_counterparty_id).await?,
        },
        category_id,
        category: load_category_name(&state.pool, user.tenant_id, category_id).await?,
        due_date: row.get("due_date"),
        amount: row.get("amount"),
        status: row.get("status"),
        source_type: row.get("source_type"),
        contract_id: row.get("contract_id"),
        installment_id: row.get("installment_id"),
        student_id: row.get("student_id"),
        account_id: row.get("account_id"),
        received_at: row.get("received_at"),
    }))
}

async fn list_receivables(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<ReceivableResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT id, description, payer_person_id, payer_counterparty_id, category_id, payer_name AS payer_name_legacy,
               category AS category_legacy, due_date,
               amount::float8 AS amount, status, source_type, contract_id, installment_id,
               student_id, account_id, received_at
        FROM financial_receivables
        WHERE tenant_id = $1
        ORDER BY status ASC, due_date ASC, created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let payer_person_id: Option<Uuid> = row.get("payer_person_id");
        let payer_counterparty_id: Option<Uuid> = row.get("payer_counterparty_id");
        let category_id: Option<Uuid> = row.get("category_id");
        out.push(ReceivableResponse {
            id: row.get("id"),
            description: row.get("description"),
            payer_person_id,
            payer_counterparty_id,
            payer_name: match load_person_name(&state.pool, user.tenant_id, payer_person_id).await? {
                Some(v) => Some(v),
                None => match load_counterparty_name(&state.pool, user.tenant_id, payer_counterparty_id).await? {
                    Some(v) => Some(v),
                    None => row.get("payer_name_legacy"),
                },
            },
            category_id,
            category: match load_category_name(&state.pool, user.tenant_id, category_id).await? {
                Some(v) => Some(v),
                None => row.get("category_legacy"),
            },
            due_date: row.get("due_date"),
            amount: row.get("amount"),
            status: row.get("status"),
            source_type: row.get("source_type"),
            contract_id: row.get("contract_id"),
            installment_id: row.get("installment_id"),
            student_id: row.get("student_id"),
            account_id: row.get("account_id"),
            received_at: row.get("received_at"),
        });
    }
    Ok(Json(out))
}

async fn get_financial_guardian_statement(
    State(state): State<AppState>,
    user: AuthUser,
    Path(person_id): Path<Uuid>,
    Query(query): Query<FinancialGuardianStatementQuery>,
) -> Result<Json<FinancialGuardianStatementResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_person_belongs_to_tenant(&state.pool, user.tenant_id, person_id).await?;

    let person_row = sqlx::query(
        r#"
        SELECT full_name, email, phone, document, street, address_number, neighborhood, city_name, state_uf
        FROM people
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
    .ok_or((StatusCode::NOT_FOUND, "Responsável financeiro não encontrado".into()))?;
    let person_name: String = person_row.get("full_name");

    let school_row = sqlx::query(
        r#"
        SELECT name, slug, school_city, school_signature_name
        FROM tenants
        WHERE id = $1
        "#,
    )
    .bind(user.tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?
    .ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;

    let rows = sqlx::query(
        r#"
        SELECT
          fr.id AS receivable_id,
          fr.description,
          fr.student_id,
          COALESCE(ps.full_name, s.name) AS student_name,
          fr.due_date,
          fr.amount::float8 AS amount,
          fr.status,
          fr.received_at
        FROM financial_receivables fr
        LEFT JOIN students s
          ON s.id = fr.student_id
         AND s.tenant_id = fr.tenant_id
        LEFT JOIN people ps
          ON ps.id = s.person_id
         AND ps.tenant_id = s.tenant_id
        WHERE fr.tenant_id = $1
          AND fr.payer_person_id = $2
          AND ($3::date IS NULL OR fr.due_date >= $3)
          AND ($4::date IS NULL OR fr.due_date <= $4)
        ORDER BY fr.due_date DESC, fr.created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .bind(query.date_from)
    .bind(query.date_to)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut total_paid = 0.0_f64;
    let mut total_open = 0.0_f64;
    let pending_balance_total = sqlx::query_scalar::<_, f64>(
        r#"
        SELECT COALESCE(SUM(amount::float8), 0)
        FROM financial_receivables
        WHERE tenant_id = $1
          AND payer_person_id = $2
          AND status = 'pending'
        "#,
    )
    .bind(user.tenant_id)
    .bind(person_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let amount: f64 = row.get("amount");
        let status: String = row.get("status");
        if status == "received" {
            total_paid += amount;
        } else if status == "pending" {
            total_open += amount;
        }
        items.push(FinancialGuardianStatementItem {
            receivable_id: row.get("receivable_id"),
            description: row.get("description"),
            student_id: row.get("student_id"),
            student_name: row.get("student_name"),
            due_date: row.get("due_date"),
            amount,
            status,
            received_at: row.get("received_at"),
        });
    }

    Ok(Json(FinancialGuardianStatementResponse {
        person_id,
        person_name,
        person_email: person_row.get("email"),
        person_phone: person_row.get("phone"),
        person_document: person_row.get("document"),
        person_street: person_row.get("street"),
        person_address_number: person_row.get("address_number"),
        person_neighborhood: person_row.get("neighborhood"),
        person_city_name: person_row.get("city_name"),
        person_state_uf: person_row.get("state_uf"),
        school_name: school_row.get("name"),
        school_code: school_row.get("slug"),
        school_city: school_row.get("school_city"),
        school_signature_name: school_row.get("school_signature_name"),
        total_paid: round2(total_paid),
        total_open: round2(total_open),
        pending_balance_total: round2(pending_balance_total),
        items,
    }))
}

async fn mark_receivable_received(
    State(state): State<AppState>,
    user: AuthUser,
    Path(receivable_id): Path<Uuid>,
    Json(req): Json<MarkReceivableReceivedRequest>,
) -> Result<Json<ReceivableResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    ensure_account_belongs_to_tenant(&state.pool, user.tenant_id, req.account_id).await?;

    let received_at = req.received_at.unwrap_or_else(|| Utc::now().date_naive());
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = sqlx::query(
        r#"
        UPDATE financial_receivables
        SET status = 'received',
            account_id = $3,
            received_at = $4
        WHERE tenant_id = $1
          AND id = $2
          AND status = 'pending'
        RETURNING id, description, payer_person_id, payer_counterparty_id, category_id, due_date,
                  payer_name AS payer_name_legacy, category AS category_legacy,
                  amount::float8 AS amount, status, source_type, contract_id, installment_id,
                  student_id, account_id, received_at
        "#,
    )
    .bind(user.tenant_id)
    .bind(receivable_id)
    .bind(req.account_id)
    .bind(received_at)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::BAD_REQUEST, "Conta a receber não encontrada ou já recebida".into()))?;
    let amount: f64 = row.get("amount");
    insert_account_movement(
        &mut tx,
        user.tenant_id,
        req.account_id,
        "credit",
        "receivable_payment",
        receivable_id,
        received_at,
        amount,
        Some("Baixa de conta a receber"),
    )
    .await?;

    if let Some(installment_id) = row.get::<Option<Uuid>, _>("installment_id") {
        sqlx::query(
            r#"
            UPDATE financial_installments
            SET status = 'paid',
                paid_at = COALESCE(paid_at, $3)
            WHERE tenant_id = $1
              AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(installment_id)
        .bind(received_at)
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let payer_person_id: Option<Uuid> = row.get("payer_person_id");
    let payer_counterparty_id: Option<Uuid> = row.get("payer_counterparty_id");
    let category_id: Option<Uuid> = row.get("category_id");
    Ok(Json(ReceivableResponse {
        id: row.get("id"),
        description: row.get("description"),
        payer_person_id,
        payer_counterparty_id,
        payer_name: match load_person_name(&state.pool, user.tenant_id, payer_person_id).await? {
            Some(v) => Some(v),
            None => match load_counterparty_name(&state.pool, user.tenant_id, payer_counterparty_id).await? {
                Some(v) => Some(v),
                None => row.get("payer_name_legacy"),
            },
        },
        category_id,
        category: match load_category_name(&state.pool, user.tenant_id, category_id).await? {
            Some(v) => Some(v),
            None => row.get("category_legacy"),
        },
        due_date: row.get("due_date"),
        amount,
        status: row.get("status"),
        source_type: row.get("source_type"),
        contract_id: row.get("contract_id"),
        installment_id: row.get("installment_id"),
        student_id: row.get("student_id"),
        account_id: row.get("account_id"),
        received_at: row.get("received_at"),
    }))
}

async fn create_transfer(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateTransferRequest>,
) -> Result<Json<TransferResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    if req.amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Valor deve ser maior que zero".into()));
    }
    if req.from_account_id == req.to_account_id {
        return Err((StatusCode::BAD_REQUEST, "Selecione contas diferentes para transferência".into()));
    }
    ensure_account_belongs_to_tenant(&state.pool, user.tenant_id, req.from_account_id).await?;
    ensure_account_belongs_to_tenant(&state.pool, user.tenant_id, req.to_account_id).await?;

    let transfer_id = Uuid::new_v4();
    let amount = round2(req.amount);
    let note = req.note.as_deref().map(str::trim).filter(|v| !v.is_empty());

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"
        INSERT INTO financial_transfers (
          id, tenant_id, from_account_id, to_account_id, transfer_date, amount, note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(transfer_id)
    .bind(user.tenant_id)
    .bind(req.from_account_id)
    .bind(req.to_account_id)
    .bind(req.transfer_date)
    .bind(amount)
    .bind(note)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    insert_account_movement(
        &mut tx,
        user.tenant_id,
        req.from_account_id,
        "debit",
        "transfer_out",
        transfer_id,
        req.transfer_date,
        amount,
        Some("Transferência enviada"),
    )
    .await?;
    insert_account_movement(
        &mut tx,
        user.tenant_id,
        req.to_account_id,
        "credit",
        "transfer_in",
        transfer_id,
        req.transfer_date,
        amount,
        Some("Transferência recebida"),
    )
    .await?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(TransferResponse {
        id: transfer_id,
        from_account_id: req.from_account_id,
        to_account_id: req.to_account_id,
        transfer_date: req.transfer_date,
        amount,
        note: note.map(str::to_string),
    }))
}

async fn list_transfers(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<TransferResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let rows = sqlx::query(
        r#"
        SELECT id, from_account_id, to_account_id, transfer_date,
               amount::float8 AS amount, note
        FROM financial_transfers
        WHERE tenant_id = $1
        ORDER BY transfer_date DESC, created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    Ok(Json(
        rows.into_iter()
            .map(|row| TransferResponse {
                id: row.get("id"),
                from_account_id: row.get("from_account_id"),
                to_account_id: row.get("to_account_id"),
                transfer_date: row.get("transfer_date"),
                amount: row.get("amount"),
                note: row.get("note"),
            })
            .collect(),
    ))
}

async fn get_contract_template(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<ContractTemplateResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;

    let row = sqlx::query(
        r#"
        SELECT name, slug, school_city, school_signature_name, financial_contract_template
        FROM tenants
        WHERE id = $1
        "#,
    )
    .bind(user.tenant_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;
    let template: Option<String> = row.get("financial_contract_template");
    Ok(Json(ContractTemplateResponse {
        school_name: row.get("name"),
        school_code: row.get("slug"),
        school_city: row.get("school_city"),
        school_signature_name: row.get("school_signature_name"),
        template: template.unwrap_or_else(default_financial_contract_template),
    }))
}

async fn update_contract_template(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<UpdateContractTemplateRequest>,
) -> Result<Json<ContractTemplateResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin"])?;
    let trimmed_template = req.template.trim();
    if trimmed_template.len() < 40 {
        return Err((StatusCode::BAD_REQUEST, "Template do contrato muito curto".into()));
    }

    let row = sqlx::query(
        r#"
        UPDATE tenants
        SET financial_contract_template = $2,
            school_city = $3,
            school_signature_name = $4
        WHERE id = $1
        RETURNING name, slug, school_city, school_signature_name, financial_contract_template
        "#,
    )
    .bind(user.tenant_id)
    .bind(trimmed_template)
    .bind(req.school_city.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .bind(
        req.school_signature_name
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty()),
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Escola não encontrada".into()))?;
    Ok(Json(ContractTemplateResponse {
        school_name: row.get("name"),
        school_code: row.get("slug"),
        school_city: row.get("school_city"),
        school_signature_name: row.get("school_signature_name"),
        template: row.get("financial_contract_template"),
    }))
}

async fn create_contract(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateFinancialContractRequest>,
) -> Result<Json<ContractResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if req.installments_count <= 0 {
        return Err((StatusCode::BAD_REQUEST, "Parcelas deve ser maior que zero".into()));
    }
    if req.total_amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Valor total deve ser maior que zero".into()));
    }
    let billing_mode = normalize_billing_mode(req.billing_mode.as_deref())?;
    let school_pix_key = req.school_pix_key.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(str::to_string);
    let school_payment_instructions = req
        .school_payment_instructions
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);
    if billing_mode == "school_booklet_pix" && school_pix_key.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Informe a chave PIX para o modo Carnê + PIX".into()));
    }
    ensure_student_belongs_to_tenant(&state.pool, user.tenant_id, req.student_id).await?;
    if let Some(payer) = req.payer_person_id {
        ensure_financial_person_belongs_to_tenant(&state.pool, user.tenant_id, payer).await?;
    }
    for person_id in &req.recipient_person_ids {
        ensure_financial_person_belongs_to_tenant(&state.pool, user.tenant_id, *person_id).await?;
    }

    let contract_id = Uuid::new_v4();
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"
        INSERT INTO financial_contracts (
          id, tenant_id, student_id, payer_person_id, description, total_amount,
          installments_count, first_due_date, due_day, billing_mode, school_pix_key,
          school_payment_instructions, status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
        "#,
    )
    .bind(contract_id)
    .bind(user.tenant_id)
    .bind(req.student_id)
    .bind(req.payer_person_id)
    .bind(req.description.trim())
    .bind(req.total_amount)
    .bind(req.installments_count)
    .bind(req.first_due_date)
    .bind(req.due_day)
    .bind(billing_mode)
    .bind(school_pix_key)
    .bind(school_payment_instructions)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;

    for person_id in &req.recipient_person_ids {
        sqlx::query(
            r#"
            INSERT INTO financial_contract_recipients (contract_id, person_id, tenant_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (contract_id, person_id) DO NOTHING
            "#,
        )
        .bind(contract_id)
        .bind(person_id)
        .bind(user.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erro DB: {e}")))?;
    }

    create_installments_for_contract(&mut tx, user.tenant_id, contract_id).await?;

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    get_contract(State(state), user, Path(contract_id)).await
}

async fn list_contracts(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<ContractResponse>>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    let rows = sqlx::query(
        r#"
        SELECT c.id
        FROM financial_contracts c
        WHERE c.tenant_id = $1
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = row.get("id");
        out.push(load_contract_response(&state.pool, user.tenant_id, id).await?);
    }
    Ok(Json(out))
}

async fn get_contract(
    State(state): State<AppState>,
    user: AuthUser,
    Path(contract_id): Path<Uuid>,
) -> Result<Json<ContractResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    let data = load_contract_response(&state.pool, user.tenant_id, contract_id).await?;
    Ok(Json(data))
}

async fn generate_boletos(
    State(state): State<AppState>,
    user: AuthUser,
    Path(contract_id): Path<Uuid>,
) -> Result<Json<ContractResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_contract_belongs_to_tenant(&state.pool, user.tenant_id, contract_id).await?;
    let contract_row = sqlx::query(
        r#"
        SELECT
          c.billing_mode,
          c.school_pix_key,
          c.school_payment_instructions,
          c.description AS contract_description,
          COALESCE(p.full_name, s.name) AS student_name
        FROM financial_contracts c
        JOIN students s ON s.id = c.student_id AND s.tenant_id = c.tenant_id
        LEFT JOIN people p ON p.id = s.person_id AND p.tenant_id = s.tenant_id
        WHERE c.tenant_id = $1 AND c.id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(contract_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let billing_mode: String = contract_row.get("billing_mode");
    let school_pix_key: Option<String> = contract_row.get("school_pix_key");
    let school_payment_instructions: Option<String> = contract_row.get("school_payment_instructions");
    let contract_description: String = contract_row.get("contract_description");
    let student_name: String = contract_row.get("student_name");

    let rows = sqlx::query(
        r#"
        SELECT id, due_date, amount::float8 AS amount
        FROM financial_installments
        WHERE tenant_id = $1
          AND contract_id = $2
          AND status IN ('pending', 'overdue')
        ORDER BY installment_number ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(contract_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let boleto_base_url = boleto_base_url();

    for row in rows {
        let installment_id: Uuid = row.get("id");
        let due_date: NaiveDate = row.get("due_date");
        let amount: f64 = row.get("amount");
        let (code, url, pdf_url, pix_copy_paste, payment_instructions) = if billing_mode == "provider_boleto" {
            let code = format!(
                "BLT-{}-{}",
                due_date.format("%Y%m%d"),
                &installment_id.to_string()[..8]
            );
            let url = format!("{boleto_base_url}/{code}");
            let pdf_url = format!("{boleto_base_url}/{code}.pdf");
            (code, Some(url), Some(pdf_url), None, school_payment_instructions.clone())
        } else if billing_mode == "school_booklet_pix" {
            let code = format!(
                "CRN-PIX-{}-{}",
                due_date.format("%Y%m%d"),
                &installment_id.to_string()[..8]
            );
            let pix_description = format!("{student_name} - {contract_description}");
            let pix_payload = school_pix_key
                .clone()
                .map(|key| build_school_pix_payload(&key, amount, due_date, &installment_id, &pix_description));
            (
                code,
                None,
                None,
                pix_payload,
                school_payment_instructions.clone(),
            )
        } else {
            let code = format!(
                "CRN-{}-{}",
                due_date.format("%Y%m%d"),
                &installment_id.to_string()[..8]
            );
            (code, None, None, None, school_payment_instructions.clone())
        };
        sqlx::query(
            r#"
            UPDATE financial_installments
            SET boleto_code = $3,
                boleto_url = $4,
                boleto_pdf_url = $5,
                pix_copy_paste = $6,
                payment_instructions = $7
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(user.tenant_id)
        .bind(installment_id)
        .bind(code)
        .bind(url)
        .bind(pdf_url)
        .bind(pix_copy_paste)
        .bind(payment_instructions)
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    get_contract(State(state), user, Path(contract_id)).await
}

fn boleto_base_url() -> String {
    let raw = env::var("BOLETO_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3333/boletos".to_string());
    raw.trim_end_matches('/').to_string()
}

fn normalize_billing_mode(mode: Option<&str>) -> Result<String, (StatusCode, String)> {
    let normalized = mode.unwrap_or("school_booklet").trim().to_lowercase();
    match normalized.as_str() {
        "provider_boleto" | "school_booklet" | "school_booklet_pix" => Ok(normalized),
        _ => Err((StatusCode::BAD_REQUEST, "Modo de cobrança inválido".into())),
    }
}

fn build_school_pix_payload(
    pix_key: &str,
    amount: f64,
    _due_date: NaiveDate,
    installment_id: &Uuid,
    description: &str,
) -> String {
    let merchant_name = sanitize_pix_field(
        &env::var("PIX_MERCHANT_NAME").unwrap_or_else(|_| "ESCOLA".to_string()),
        25,
        "ESCOLA",
    );
    let merchant_city = sanitize_pix_field(
        &env::var("PIX_MERCHANT_CITY").unwrap_or_else(|_| "CIDADE".to_string()),
        15,
        "CIDADE",
    );
    let txid_raw = installment_id.to_string().replace('-', "").to_uppercase();
    let txid: String = txid_raw.chars().take(25).collect();
    let pix_description = sanitize_pix_description(description, 50);

    let mut merchant_account_info = String::new();
    merchant_account_info.push_str(&tlv("00", "br.gov.bcb.pix"));
    merchant_account_info.push_str(&tlv("01", pix_key.trim()));
    if !pix_description.is_empty() {
        merchant_account_info.push_str(&tlv("02", &pix_description));
    }

    let mut additional_data = String::new();
    additional_data.push_str(&tlv("05", &txid));

    let mut payload = String::new();
    payload.push_str(&tlv("00", "01"));
    payload.push_str(&tlv("26", &merchant_account_info));
    payload.push_str(&tlv("52", "0000"));
    payload.push_str(&tlv("53", "986"));
    payload.push_str(&tlv("54", &format!("{:.2}", round2(amount))));
    payload.push_str(&tlv("58", "BR"));
    payload.push_str(&tlv("59", &merchant_name));
    payload.push_str(&tlv("60", &merchant_city));
    payload.push_str(&tlv("62", &additional_data));
    payload.push_str("6304");

    let crc = crc16_ccitt_false(&payload);
    payload.push_str(&format!("{crc:04X}"));
    payload
}

fn tlv(id: &str, value: &str) -> String {
    let len = value.chars().count();
    format!("{id}{len:02}{value}")
}

fn sanitize_pix_field(value: &str, max_len: usize, fallback: &str) -> String {
    let cleaned = value
        .trim()
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ')
        .collect::<String>();
    let compact = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let out: String = compact.chars().take(max_len).collect();
    if out.is_empty() {
        fallback.to_string()
    } else {
        out
    }
}

fn sanitize_pix_description(value: &str, max_len: usize) -> String {
    let cleaned = value
        .trim()
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '.' || *c == '-' || *c == '/')
        .collect::<String>();
    cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_len)
        .collect()
}

fn crc16_ccitt_false(input: &str) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for b in input.as_bytes() {
        crc ^= (*b as u16) << 8;
        for _ in 0..8 {
            if (crc & 0x8000) != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

async fn send_boletos_email(
    State(state): State<AppState>,
    user: AuthUser,
    Path(contract_id): Path<Uuid>,
) -> Result<Json<SendEmailResult>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_contract_belongs_to_tenant(&state.pool, user.tenant_id, contract_id).await?;

    let recipients = sqlx::query(
        r#"
        SELECT p.id AS person_id, p.email
        FROM financial_contract_recipients fcr
        JOIN people p
          ON p.id = fcr.person_id
         AND p.tenant_id = fcr.tenant_id
        WHERE fcr.tenant_id = $1 AND fcr.contract_id = $2
          AND p.email IS NOT NULL
        ORDER BY p.full_name ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(contract_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let installments = sqlx::query(
        r#"
        SELECT id, installment_number, due_date, amount::float8 AS amount, boleto_code, pix_copy_paste, payment_instructions
        FROM financial_installments
        WHERE tenant_id = $1 AND contract_id = $2
          AND status IN ('pending', 'overdue')
        ORDER BY installment_number ASC
        "#,
    )
    .bind(user.tenant_id)
    .bind(contract_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let mut sent_to = 0;
    for r in recipients {
        let recipient_person_id: Uuid = r.get("person_id");
        let recipient_email: String = r.get("email");
        sent_to += 1;

        for inst in &installments {
            let installment_id: Uuid = inst.get("id");
            let n: i32 = inst.get("installment_number");
            let due: NaiveDate = inst.get("due_date");
            let amount: f64 = inst.get("amount");
            let code: Option<String> = inst.get("boleto_code");
            let pix_copy_paste: Option<String> = inst.get("pix_copy_paste");
            let payment_instructions: Option<String> = inst.get("payment_instructions");

            let subject = format!("Boleto da parcela {n}");
            let mut body = format!(
                "Parcela {n} vence em {} no valor de R$ {}. Código: {}",
                due.format("%d/%m/%Y"),
                amount,
                code.unwrap_or_else(|| "A gerar".to_string())
            );
            if let Some(instr) = payment_instructions {
                body.push_str(&format!("\nInstruções: {instr}"));
            }
            if let Some(pix) = pix_copy_paste {
                body.push_str(&format!("\nPIX copia e cola: {pix}"));
            }

            sqlx::query(
                r#"
                INSERT INTO financial_email_logs (
                  id, tenant_id, contract_id, installment_id, recipient_person_id,
                  recipient_email, subject, body, sent_at
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user.tenant_id)
            .bind(contract_id)
            .bind(installment_id)
            .bind(recipient_person_id)
            .bind(&recipient_email)
            .bind(subject)
            .bind(body)
            .execute(&state.pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

            sqlx::query(
                r#"UPDATE financial_installments
                   SET emailed_at = NOW()
                   WHERE tenant_id = $1 AND id = $2"#,
            )
            .bind(user.tenant_id)
            .bind(installment_id)
            .execute(&state.pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
        }
    }

    Ok(Json(SendEmailResult {
        sent_to,
        installments_sent: installments.len() as i32,
    }))
}

async fn mark_installment_paid(
    State(state): State<AppState>,
    user: AuthUser,
    Path((contract_id, installment_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<MarkInstallmentPaidRequest>,
) -> Result<Json<ContractResponse>, (StatusCode, String)> {
    user.require_any_role(&["owner", "admin", "staff"])?;
    ensure_contract_belongs_to_tenant(&state.pool, user.tenant_id, contract_id).await?;

    let paid_at = req.paid_at.unwrap_or_else(|| Utc::now().date_naive());

    sqlx::query(
        r#"
        UPDATE financial_installments
        SET status = 'paid',
            paid_at = $3
        WHERE tenant_id = $1
          AND contract_id = $2
          AND id = $4
        "#,
    )
    .bind(user.tenant_id)
    .bind(contract_id)
    .bind(paid_at)
    .bind(installment_id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    sqlx::query(
        r#"
        UPDATE financial_receivables
        SET status = 'received',
            received_at = COALESCE(received_at, $3)
        WHERE tenant_id = $1
          AND installment_id = $2
        "#,
    )
    .bind(user.tenant_id)
    .bind(installment_id)
    .bind(paid_at)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    get_contract(State(state), user, Path(contract_id)).await
}

async fn load_contract_response(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    contract_id: Uuid,
) -> Result<ContractResponse, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT
          c.id, c.tenant_id, c.student_id, c.payer_person_id, c.description,
          c.total_amount::float8 AS total_amount, c.installments_count, c.first_due_date, c.due_day,
          c.billing_mode, c.school_pix_key, c.school_payment_instructions,
          t.name AS school_name, t.slug AS school_code, t.school_city, t.school_signature_name,
          c.status, c.created_at,
          COALESCE(p.full_name, s.name) AS student_name
        FROM financial_contracts c
        JOIN tenants t ON t.id = c.tenant_id
        JOIN students s ON s.id = c.student_id AND s.tenant_id = c.tenant_id
        LEFT JOIN people p ON p.id = s.person_id AND p.tenant_id = s.tenant_id
        WHERE c.tenant_id = $1 AND c.id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let row = row.ok_or((StatusCode::NOT_FOUND, "Contrato não encontrado".into()))?;

    let recipients = sqlx::query(
        r#"
        SELECT person_id
        FROM financial_contract_recipients
        WHERE tenant_id = $1 AND contract_id = $2
        ORDER BY person_id ASC
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let installments_rows = sqlx::query(
        r#"
        SELECT id, installment_number, due_date, amount::float8 AS amount, status,
               boleto_code, boleto_url, boleto_pdf_url, pix_copy_paste, payment_instructions,
               emailed_at, paid_at
        FROM financial_installments
        WHERE tenant_id = $1 AND contract_id = $2
        ORDER BY installment_number ASC
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let installments = installments_rows
        .into_iter()
        .map(|r| InstallmentResponse {
            id: r.get("id"),
            installment_number: r.get("installment_number"),
            due_date: r.get("due_date"),
            amount: r.get("amount"),
            status: r.get("status"),
            boleto_code: r.get("boleto_code"),
            boleto_url: r.get("boleto_url"),
            boleto_pdf_url: r.get("boleto_pdf_url"),
            pix_copy_paste: r.get("pix_copy_paste"),
            payment_instructions: r.get("payment_instructions"),
            emailed_at: r.get("emailed_at"),
            paid_at: r.get("paid_at"),
        })
        .collect();

    Ok(ContractResponse {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        student_id: row.get("student_id"),
        student_name: row.get("student_name"),
        school_name: row.get("school_name"),
        school_code: row.get("school_code"),
        school_city: row.get("school_city"),
        school_signature_name: row.get("school_signature_name"),
        payer_person_id: row.get("payer_person_id"),
        recipient_person_ids: recipients.into_iter().map(|r| r.get("person_id")).collect(),
        description: row.get("description"),
        total_amount: row.get("total_amount"),
        installments_count: row.get("installments_count"),
        first_due_date: row.get("first_due_date"),
        due_day: row.get("due_day"),
        billing_mode: row.get("billing_mode"),
        school_pix_key: row.get("school_pix_key"),
        school_payment_instructions: row.get("school_payment_instructions"),
        status: row.get("status"),
        created_at: row.get("created_at"),
        installments,
    })
}

async fn create_installments_for_contract(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    contract_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT total_amount::float8 AS total_amount, installments_count, first_due_date, due_day
        FROM financial_contracts
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

    let total_amount: f64 = row.get("total_amount");
    let installments_count: i32 = row.get("installments_count");
    let first_due_date: NaiveDate = row.get("first_due_date");
    let due_day: Option<i32> = row.get("due_day");
    let contract_description: String = sqlx::query_scalar(
        r#"
        SELECT description
        FROM financial_contracts
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let student_row = sqlx::query(
        r#"
        SELECT c.student_id, c.payer_person_id, COALESCE(p.full_name, s.name) AS student_name
        FROM financial_contracts c
        JOIN students s ON s.id = c.student_id AND s.tenant_id = c.tenant_id
        LEFT JOIN people p ON p.id = s.person_id AND p.tenant_id = s.tenant_id
        WHERE c.tenant_id = $1 AND c.id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(contract_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let student_id: Uuid = student_row.get("student_id");
    let payer_person_id: Option<Uuid> = student_row.get("payer_person_id");
    let student_name: String = student_row.get("student_name");

    let base = round2(total_amount / installments_count as f64);
    let mut allocated = 0.0_f64;

    for i in 1..=installments_count {
        let mut due_date = add_months(first_due_date, i - 1);
        if let Some(day) = due_day {
            let max_day = days_in_month(due_date.year(), due_date.month());
            let final_day = day.clamp(1, max_day as i32) as u32;
            if let Some(adjusted) = NaiveDate::from_ymd_opt(due_date.year(), due_date.month(), final_day) {
                due_date = adjusted;
            }
        }

        let amount = if i == installments_count {
            round2(total_amount - allocated)
        } else {
            allocated += base;
            base
        };

        let installment_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO financial_installments (
              id, contract_id, tenant_id, installment_number, due_date, amount, status
            )
            VALUES ($1,$2,$3,$4,$5,$6,'pending')
            "#,
        )
        .bind(installment_id)
        .bind(contract_id)
        .bind(tenant_id)
        .bind(i)
        .bind(due_date)
        .bind(round2(amount))
        .execute(&mut **tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;

        let receivable_description = format!(
            "Parcela {}/{} - {} ({})",
            i, installments_count, contract_description, student_name
        );
        sqlx::query(
            r#"
            INSERT INTO financial_receivables (
              id, tenant_id, description, payer_name, payer_person_id, payer_counterparty_id, category, category_id,
              due_date, amount, status, source_type, contract_id, installment_id, student_id
            )
            VALUES ($1,$2,$3,$4,$5,NULL,'mensalidade',NULL,$6,$7,'pending','installment',$8,$9,$10)
            ON CONFLICT (installment_id) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(receivable_description)
        .bind(student_name.clone())
        .bind(payer_person_id)
        .bind(due_date)
        .bind(round2(amount))
        .bind(contract_id)
        .bind(installment_id)
        .bind(student_id)
        .execute(&mut **tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    }

    Ok(())
}

async fn ensure_contract_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    contract_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query("SELECT 1 FROM financial_contracts WHERE tenant_id = $1 AND id = $2")
        .bind(tenant_id)
        .bind(contract_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if row.is_none() {
        return Err((StatusCode::NOT_FOUND, "Contrato não encontrado".into()));
    }
    Ok(())
}

async fn ensure_student_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    student_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query("SELECT 1 FROM students WHERE tenant_id = $1 AND id = $2")
        .bind(tenant_id)
        .bind(student_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Aluno inválido para este tenant".into()));
    }
    Ok(())
}

async fn ensure_financial_person_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    person_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT 1
        FROM people p
        JOIN person_roles pr ON pr.person_id = p.id
        WHERE p.tenant_id = $1 AND p.id = $2
          AND pr.role_code = 'financial_guardian'
        "#,
    )
    .bind(tenant_id)
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Responsável financeiro inválido para este tenant".into()));
    }
    Ok(())
}

async fn ensure_person_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    person_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT 1
        FROM people
        WHERE tenant_id = $1 AND id = $2 AND is_active = TRUE
        "#,
    )
    .bind(tenant_id)
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Pessoa inválida para este tenant".into()));
    }
    Ok(())
}

async fn ensure_account_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    account_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT 1
        FROM financial_accounts
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    if row.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Conta financeira inválida".into()));
    }
    Ok(())
}

async fn ensure_counterparty_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    counterparty_id: Uuid,
    expected_kind: &str,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT kind
        FROM financial_counterparties
        WHERE tenant_id = $1 AND id = $2 AND is_active = TRUE
        "#,
    )
    .bind(tenant_id)
    .bind(counterparty_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let row = row.ok_or((StatusCode::BAD_REQUEST, "Cadastro financeiro inválido".into()))?;
    let kind: String = row.get("kind");
    if !(kind == "both" || kind == expected_kind) {
        return Err((StatusCode::BAD_REQUEST, "Cadastro financeiro incompatível".into()));
    }
    Ok(())
}

async fn ensure_category_belongs_to_tenant(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    category_id: Uuid,
    expected_flow: &str,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT flow
        FROM financial_categories
        WHERE tenant_id = $1 AND id = $2 AND is_active = TRUE
        "#,
    )
    .bind(tenant_id)
    .bind(category_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    let row = row.ok_or((StatusCode::BAD_REQUEST, "Categoria financeira inválida".into()))?;
    let flow: String = row.get("flow");
    if !(flow == "both" || flow == expected_flow) {
        return Err((StatusCode::BAD_REQUEST, "Categoria financeira incompatível".into()));
    }
    Ok(())
}

async fn load_counterparty_name(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    counterparty_id: Option<Uuid>,
) -> Result<Option<String>, (StatusCode, String)> {
    let Some(counterparty_id) = counterparty_id else {
        return Ok(None);
    };
    let name = sqlx::query_scalar::<_, String>(
        r#"
        SELECT name
        FROM financial_counterparties
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(counterparty_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    Ok(name)
}

async fn load_category_name(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    category_id: Option<Uuid>,
) -> Result<Option<String>, (StatusCode, String)> {
    let Some(category_id) = category_id else {
        return Ok(None);
    };
    let name = sqlx::query_scalar::<_, String>(
        r#"
        SELECT name
        FROM financial_categories
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(category_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    Ok(name)
}

async fn load_person_name(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
) -> Result<Option<String>, (StatusCode, String)> {
    let Some(person_id) = person_id else {
        return Ok(None);
    };
    let name = sqlx::query_scalar::<_, String>(
        r#"
        SELECT full_name
        FROM people
        WHERE tenant_id = $1 AND id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    Ok(name)
}

async fn insert_account_movement(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    account_id: Uuid,
    movement_type: &str,
    origin_type: &str,
    origin_id: Uuid,
    movement_date: NaiveDate,
    amount: f64,
    note: Option<&str>,
) -> Result<(), (StatusCode, String)> {
    sqlx::query(
        r#"
        INSERT INTO financial_account_movements (
          id, tenant_id, account_id, movement_type, origin_type, origin_id, movement_date, amount, note
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(tenant_id)
    .bind(account_id)
    .bind(movement_type)
    .bind(origin_type)
    .bind(origin_id)
    .bind(movement_date)
    .bind(round2(amount))
    .bind(note)
    .execute(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Erro DB".into()))?;
    Ok(())
}

fn normalize_account_type(value: &str) -> Result<String, (StatusCode, String)> {
    let normalized = value.trim().to_lowercase();
    match normalized.as_str() {
        "current" | "cash" => Ok(normalized),
        _ => Err((StatusCode::BAD_REQUEST, "Tipo de conta inválido".into())),
    }
}

fn normalize_counterparty_kind(value: &str) -> Result<String, (StatusCode, String)> {
    let normalized = value.trim().to_lowercase();
    match normalized.as_str() {
        "vendor" | "payer" | "both" => Ok(normalized),
        _ => Err((StatusCode::BAD_REQUEST, "Tipo de cadastro financeiro inválido".into())),
    }
}

fn normalize_category_flow(value: &str) -> Result<String, (StatusCode, String)> {
    let normalized = value.trim().to_lowercase();
    match normalized.as_str() {
        "payable" | "receivable" | "both" => Ok(normalized),
        _ => Err((StatusCode::BAD_REQUEST, "Fluxo de categoria inválido".into())),
    }
}

fn default_financial_contract_template() -> String {
    r#"CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS

Escola: {{school_name}} ({{school_code}})
Cidade: {{school_city}}
Data: {{date}}

Aluno(a): {{student_name}}
Responsavel financeiro: {{payer_name}}

Plano contratado: {{description}}
Valor total: R$ {{total_amount}}
Quantidade de parcelas: {{installments_count}}
Primeiro vencimento: {{first_due_date}}

As partes acima identificadas acordam com as condicoes de prestacao de servicos educacionais e pagamento das mensalidades.

Assinaturas:

____________________________________
Responsavel Financeiro

____________________________________
Escola - {{school_signature_name}}
"#
    .to_string()
}

fn add_months(date: NaiveDate, months: i32) -> NaiveDate {
    let total = date.month0() as i32 + months;
    let year = date.year() + total.div_euclid(12);
    let month0 = total.rem_euclid(12) as u32;
    let month = month0 + 1;
    let max_day = days_in_month(year, month);
    let day = date.day().min(max_day);
    NaiveDate::from_ymd_opt(year, month, day).expect("data válida")
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let (next_y, next_m) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let next_first = NaiveDate::from_ymd_opt(next_y, next_m, 1).expect("data válida");
    let current_first = NaiveDate::from_ymd_opt(year, month, 1).expect("data válida");
    (next_first - current_first).num_days() as u32
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}
