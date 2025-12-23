/*
  # Allow anonymous users to manage blog posts

  1. Security Changes
    - Update RLS policies to allow anonymous (anon) users to insert, update, and delete blog posts
    - This is for development/demo purposes
    - In production, these should be restricted to authenticated users only

  2. Notes
    - These policies allow anyone to manage blog posts
    - This is intentional for demo purposes
    - For production use, authentication should be implemented
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can insert posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete posts" ON blog_posts;

-- Allow anon users to insert posts
CREATE POLICY "Anyone can insert posts"
  ON blog_posts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon users to update posts
CREATE POLICY "Anyone can update posts"
  ON blog_posts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon users to delete posts
CREATE POLICY "Anyone can delete posts"
  ON blog_posts
  FOR DELETE
  TO anon, authenticated
  USING (true);