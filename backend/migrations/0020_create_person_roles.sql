CREATE TABLE IF NOT EXISTS person_roles (
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES person_types(code),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_person_roles_role_code
  ON person_roles (role_code);

INSERT INTO person_roles (person_id, role_code)
SELECT p.id, p.person_type
FROM people p
ON CONFLICT (person_id, role_code) DO NOTHING;
