CREATE TABLE IF NOT EXISTS person_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO person_types (code, label) VALUES
  ('student', 'Aluno'),
  ('parent', 'Pai/Mae'),
  ('guardian', 'Responsavel'),
  ('teacher', 'Professor'),
  ('staff', 'Funcionario'),
  ('supplier', 'Fornecedor')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL REFERENCES person_types(code),
  full_name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  document TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_tenant
  ON people (tenant_id);

CREATE INDEX IF NOT EXISTS idx_people_tenant_type
  ON people (tenant_id, person_type);

CREATE INDEX IF NOT EXISTS idx_people_tenant_name
  ON people (tenant_id, lower(full_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_tenant_type_email
  ON people (tenant_id, person_type, lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS person_id UUID NULL;

ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS person_id UUID NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS person_id UUID NULL;

INSERT INTO people (id, tenant_id, person_type, full_name, email, phone, document, notes, is_active, created_at)
SELECT
  s.id,
  s.tenant_id,
  'student',
  s.name,
  s.student_email,
  s.guardian_phone,
  NULL,
  s.notes,
  TRUE,
  s.created_at
FROM students s
ON CONFLICT (id) DO NOTHING;

INSERT INTO people (id, tenant_id, person_type, full_name, email, phone, document, notes, is_active, created_at)
SELECT
  g.id,
  g.tenant_id,
  'guardian',
  g.full_name,
  g.email,
  g.phone,
  g.document,
  g.notes,
  g.is_active,
  g.created_at
FROM guardians g
ON CONFLICT (id) DO NOTHING;

INSERT INTO people (id, tenant_id, person_type, full_name, email, phone, document, notes, is_active, created_at)
SELECT
  u.id,
  u.tenant_id,
  CASE
    WHEN u.role = 'teacher' THEN 'teacher'
    ELSE 'staff'
  END,
  COALESCE(NULLIF(trim(u.full_name), ''), split_part(u.email, '@', 1)),
  u.email,
  u.phone,
  NULL,
  NULL,
  TRUE,
  u.created_at
FROM users u
ON CONFLICT (id) DO NOTHING;

UPDATE students s
SET person_id = s.id
WHERE s.person_id IS NULL
  AND EXISTS (SELECT 1 FROM people p WHERE p.id = s.id);

UPDATE guardians g
SET person_id = g.id
WHERE g.person_id IS NULL
  AND EXISTS (SELECT 1 FROM people p WHERE p.id = g.id);

UPDATE users u
SET person_id = u.id
WHERE u.person_id IS NULL
  AND EXISTS (SELECT 1 FROM people p WHERE p.id = u.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_person_id_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guardians_person_id_fkey'
  ) THEN
    ALTER TABLE guardians
      ADD CONSTRAINT guardians_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_person_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_person_id
  ON students (person_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guardians_person_id
  ON guardians (person_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_person_id
  ON users (person_id);

ALTER TABLE students
  ALTER COLUMN person_id SET NOT NULL;

ALTER TABLE guardians
  ALTER COLUMN person_id SET NOT NULL;

ALTER TABLE users
  ALTER COLUMN person_id SET NOT NULL;
