INSERT INTO person_types (code, label)
VALUES ('financial_guardian', 'Responsavel Financeiro')
ON CONFLICT (code) DO NOTHING;
