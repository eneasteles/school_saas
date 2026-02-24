CREATE TABLE IF NOT EXISTS financial_email_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES financial_contracts(id) ON DELETE CASCADE,
  installment_id UUID NULL REFERENCES financial_installments(id) ON DELETE SET NULL,
  recipient_person_id UUID NULL REFERENCES people(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_email_logs_tenant_contract
  ON financial_email_logs (tenant_id, contract_id, sent_at DESC);
