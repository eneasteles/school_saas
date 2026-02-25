CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('current', 'cash')),
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_tenant
  ON financial_accounts (tenant_id, is_active, account_type);

CREATE TABLE IF NOT EXISTS financial_account_movements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('credit', 'debit')),
  origin_type TEXT NOT NULL,
  origin_id UUID NULL,
  movement_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_account_movements_tenant_account
  ON financial_account_movements (tenant_id, account_id, movement_date DESC);

CREATE TABLE IF NOT EXISTS financial_payables (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  vendor_name TEXT NULL,
  category TEXT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  account_id UUID NULL REFERENCES financial_accounts(id) ON DELETE SET NULL,
  paid_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_payables_tenant_due
  ON financial_payables (tenant_id, due_date, status);

CREATE TABLE IF NOT EXISTS financial_receivables (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  payer_name TEXT NULL,
  category TEXT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'installment')),
  contract_id UUID NULL REFERENCES financial_contracts(id) ON DELETE SET NULL,
  installment_id UUID NULL REFERENCES financial_installments(id) ON DELETE SET NULL,
  student_id UUID NULL REFERENCES students(id) ON DELETE SET NULL,
  account_id UUID NULL REFERENCES financial_accounts(id) ON DELETE SET NULL,
  received_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (installment_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_receivables_tenant_due
  ON financial_receivables (tenant_id, due_date, status);

INSERT INTO financial_receivables (
  id, tenant_id, description, payer_name, category, due_date, amount, status,
  source_type, contract_id, installment_id, student_id, received_at
)
SELECT
  fi.id,
  fi.tenant_id,
  CONCAT(
    'Parcela ',
    fi.installment_number::text,
    '/',
    fc.installments_count::text,
    ' - ',
    fc.description,
    ' (',
    COALESCE(p.full_name, s.name),
    ')'
  ) AS description,
  COALESCE(p.full_name, s.name) AS payer_name,
  'mensalidade' AS category,
  fi.due_date,
  fi.amount,
  CASE WHEN fi.status = 'paid' THEN 'received' ELSE 'pending' END AS status,
  'installment' AS source_type,
  fi.contract_id,
  fi.id AS installment_id,
  s.id AS student_id,
  fi.paid_at AS received_at
FROM financial_installments fi
JOIN financial_contracts fc
  ON fc.id = fi.contract_id
 AND fc.tenant_id = fi.tenant_id
JOIN students s
  ON s.id = fc.student_id
 AND s.tenant_id = fi.tenant_id
LEFT JOIN people p
  ON p.id = s.person_id
 AND p.tenant_id = s.tenant_id
WHERE NOT EXISTS (
  SELECT 1
  FROM financial_receivables fr
  WHERE fr.installment_id = fi.id
);

CREATE TABLE IF NOT EXISTS financial_transfers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transfers_tenant_date
  ON financial_transfers (tenant_id, transfer_date DESC);
