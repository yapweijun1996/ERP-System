-- ============================================
-- Migration: Add users.username for legacy DBs
-- Target: PostgreSQL 16+
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE public.users ADD COLUMN username VARCHAR(50);
  END IF;
END $$;

-- Backfill username for existing rows
UPDATE public.users
SET username = COALESCE(
  NULLIF(username, ''),
  NULLIF(split_part(COALESCE(email, ''), '@', 1), ''),
  id
)
WHERE username IS NULL OR username = '';

-- Enforce NOT NULL if there are no remaining NULLs
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT COUNT(*)::int INTO missing_count
  FROM public.users
  WHERE username IS NULL OR username = '';

  IF missing_count = 0 THEN
    ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
  END IF;
END $$;

-- Add uniqueness (align with current app expectations)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

