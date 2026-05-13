-- Allow instructor records to be created without a department
-- (e.g. during teacher self-registration before any departments are configured)
ALTER TABLE public.instructors
    ALTER COLUMN department_id DROP NOT NULL;
