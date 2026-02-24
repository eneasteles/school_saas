ALTER TABLE financial_contracts
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'school_booklet',
  ADD COLUMN IF NOT EXISTS school_pix_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS school_payment_instructions TEXT NULL;

ALTER TABLE financial_installments
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT NULL;
