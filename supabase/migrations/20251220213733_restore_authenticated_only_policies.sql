/*
  # Restore Authentication-Only Blog Post Policies

  1. Security Changes
    - Remove public access policies for blog post management
    - Restore authenticated-only access for insert, update, and delete operations
    - Keep public read access for published posts only
    - Implement proper Row Level Security for production use

  2. Policy Changes
    - DROP: Public insert/update/delete policies
    - CREATE: Authenticated-only insert/update/delete policies
    - KEEP: Public can view published posts
    - KEEP: Authenticated users can view all posts

  3. Notes
    - Only authenticated users can manage blog posts
    - Public users can only read published posts
    - This is production-ready security
*/

-- Drop public access policies
DROP POLICY IF EXISTS "Anyone can insert posts" ON blog_posts;
DROP POLICY IF EXISTS "Anyone can update posts" ON blog_posts;
DROP POLICY IF EXISTS "Anyone can delete posts" ON blog_posts;

-- Restore authenticated-only policies for blog post management
CREATE POLICY "Authenticated users can insert posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (true);