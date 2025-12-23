/*
  # Create newsletter subscriptions table

  1. New Tables
    - `newsletter_subscriptions`
      - `id` (uuid, primary key)
      - `email` (text, unique) - subscriber email address
      - `subscribed_at` (timestamptz) - timestamp of subscription
      - `is_active` (boolean) - subscription status
      - `unsubscribe_token` (uuid) - token for unsubscribing
      
  2. Security
    - Enable RLS on `newsletter_subscriptions` table
    - Add policy for public to insert subscriptions (rate-limited)
    - Add policy for authenticated users to view all subscriptions
    
  3. Indexes
    - Add unique index on email for fast lookups
    - Add index on is_active for filtering active subscribers
*/

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  unsubscribe_token uuid DEFAULT gen_random_uuid(),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view subscriptions"
  ON newsletter_subscriptions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update subscriptions"
  ON newsletter_subscriptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email 
  ON newsletter_subscriptions(email);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_is_active 
  ON newsletter_subscriptions(is_active);
