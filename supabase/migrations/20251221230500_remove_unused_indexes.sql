/*
  # Remove unused indexes from newsletter_subscriptions

  This migration removes redundant and unused indexes to improve database performance.

  1. Changes
    - Drop `idx_newsletter_subscriptions_email` - redundant because UNIQUE constraint already creates an index
    - Drop `idx_newsletter_subscriptions_is_active` - unused index
  
  2. Notes
    - The email column still maintains its UNIQUE constraint and associated index
    - If is_active queries become frequent in the future, the index can be recreated
*/

DROP INDEX IF EXISTS idx_newsletter_subscriptions_email;
DROP INDEX IF EXISTS idx_newsletter_subscriptions_is_active;
