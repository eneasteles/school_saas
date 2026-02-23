ALTER TABLE student_grades
  DROP CONSTRAINT IF EXISTS student_grades_tenant_id_class_id_student_id_term_subject_key;

ALTER TABLE student_grades
  DROP CONSTRAINT IF EXISTS student_grades_unique_term_subject;
