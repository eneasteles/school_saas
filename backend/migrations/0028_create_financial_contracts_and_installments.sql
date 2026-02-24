CREATE TABLE IF NOT EXISTS financial_contracts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payer_person_id UUID NULL REFERENCES people(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  installments_count INT NOT NULL,
  first_due_date DATE NOT NULL,
  due_day INT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_contracts_tenant_student
  ON financial_contracts (tenant_id, student_id);

CREATE TABLE IF NOT EXISTS financial_contract_recipients (
  contract_id UUID NOT NULL REFERENCES financial_contracts(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_contract_recipients_tenant
  ON financial_contract_recipients (tenant_id, person_id);

CREATE TABLE IF NOT EXISTS financial_installments (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES financial_contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  boleto_code TEXT NULL,
  boleto_url TEXT NULL,
  boleto_pdf_url TEXT NULL,
  emailed_at TIMESTAMP NULL,
  paid_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_financial_installments_tenant_due
  ON financial_installments (tenant_id, due_date, status);
