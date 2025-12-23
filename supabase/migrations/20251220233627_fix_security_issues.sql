/*
  # Fix Security and Performance Issues

  1. RLS Policy Optimization
    - Replace `auth.jwt()` with `(select auth.jwt())` in admin policies
    - Prevents re-evaluation of auth function for each row
    - Improves query performance at scale

  2. Function Security
    - Add stable search_path to `update_updated_at_column` function
    - Prevents search path injection attacks
    - Sets explicit schema reference

  3. Index Cleanup
    - Remove unused indexes that are not being utilized
    - `idx_blog_posts_slug` - Not used (slug lookups happen via unique constraint)
    - `idx_blog_posts_category` - Not used (no category filtering in current queries)

  4. Important Notes
    - Admin email: joshua@nextwavedigitalsolution.com
    - These changes improve security and performance
    - No functionality changes, only optimizations
*/

-- Drop and recreate admin policies with optimized auth function calls
DROP POLICY IF EXISTS "Admin can insert posts" ON blog_posts;
DROP POLICY IF EXISTS "Admin can update posts" ON blog_posts;
DROP POLICY IF EXISTS "Admin can delete posts" ON blog_posts;

-- Optimized admin-only policy for inserting posts
CREATE POLICY "Admin can insert posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((select auth.jwt())->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

-- Optimized admin-only policy for updating posts
CREATE POLICY "Admin can update posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    ((select auth.jwt())->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  )
  WITH CHECK (
    ((select auth.jwt())->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

-- Optimized admin-only policy for deleting posts
CREATE POLICY "Admin can delete posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (
    ((select auth.jwt())->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

-- Fix function search path vulnerability
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger after function update
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Remove unused indexes
DROP INDEX IF EXISTS idx_blog_posts_slug;
DROP INDEX IF EXISTS idx_blog_posts_category;