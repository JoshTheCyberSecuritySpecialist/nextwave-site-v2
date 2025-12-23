/*
  # Create Blog Posts Table

  1. New Tables
    - `blog_posts`
      - `id` (uuid, primary key) - Unique identifier
      - `title` (text, required) - Blog post title
      - `slug` (text, unique, required) - SEO-friendly URL slug
      - `excerpt` (text, required) - Short description/preview
      - `content` (text, required) - Full markdown content
      - `category` (text, required) - Post category
      - `author` (text, required) - Author name
      - `published_at` (timestamptz) - Publication date
      - `read_time` (integer, required) - Estimated read time in minutes
      - `featured_image` (text) - Optional image URL
      - `status` (text, required) - 'draft' or 'published'
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `blog_posts` table
    - Allow public read access to published posts only
    - Restrict write access to authenticated users only

  3. Indexes
    - Index on slug for fast lookups
    - Index on status and published_at for filtering
    - Index on category for filtering

  4. Notes
    - Posts must have status 'draft' or 'published'
    - Only published posts are visible to public
    - Slug must be unique for SEO-friendly URLs
    - Read time calculated in minutes
*/

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  author text NOT NULL DEFAULT 'NextWave Team',
  published_at timestamptz,
  read_time integer NOT NULL DEFAULT 5,
  featured_image text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);

-- Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public users can view published posts only
CREATE POLICY "Public can view published posts"
  ON blog_posts
  FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated users can view all posts
CREATE POLICY "Authenticated users can view all posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert posts
CREATE POLICY "Authenticated users can insert posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update posts
CREATE POLICY "Authenticated users can update posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete posts
CREATE POLICY "Authenticated users can delete posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();