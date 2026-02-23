-- Turmas (classes)
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade text NOT NULL,              -- ex: "1º ano", "2º ano", "6º ano"
  year int NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, year)
);

-- Vínculo no aluno (nullable no começo)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS class_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_class_id_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES classes(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
