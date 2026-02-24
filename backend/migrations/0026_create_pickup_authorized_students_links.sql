CREATE TABLE IF NOT EXISTS pickup_authorized_students (
  pickup_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pickup_person_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_pickup_authorized_students_tenant
  ON pickup_authorized_students (tenant_id, pickup_person_id, student_id);
