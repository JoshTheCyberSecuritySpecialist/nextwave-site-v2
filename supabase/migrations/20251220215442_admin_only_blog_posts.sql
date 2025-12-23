/*
  # Admin-Only Blog Post Management

  1. Security Changes
    - Update RLS policies to only allow admin user to manage blog posts
    - Admin email: joshua@nextwavedigitalsolution.com
    - Public users can still read published posts
    - Only authenticated admin can create, update, and delete posts

  2. Policy Changes
    - DROP: General authenticated user policies
    - CREATE: Admin-only policies using email verification
    - KEEP: Public read access for published posts

  3. Notes
    - Uses auth.jwt()->>'email' to verify admin email
    - This is production-ready admin-only security
    - No other users can modify blog content
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can insert posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete posts" ON blog_posts;

-- Create admin-only policy for inserting posts
CREATE POLICY "Admin can insert posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

-- Create admin-only policy for updating posts
CREATE POLICY "Admin can update posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  )
  WITH CHECK (
    (auth.jwt()->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

-- Create admin-only policy for deleting posts
CREATE POLICY "Admin can delete posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );