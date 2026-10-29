-- Development migration. Do not apply to production until the review checklist is approved.
-- CRM users share this Supabase project. Draft posts and newsletter rows must not be readable
-- by every authenticated account. Published posts stay public. Newsletter signup still inserts
-- through the existing edge function, which uses the service role.

begin;

drop policy if exists "Authenticated users can view all posts" on public.blog_posts;

create policy "Authenticated users can view published posts"
  on public.blog_posts
  for select
  to authenticated
  using (status = 'published');

create policy "Admin can view all posts"
  on public.blog_posts
  for select
  to authenticated
  using (
    ((select auth.jwt())->>'email')::text = 'joshua@nextwavedigitalsolution.com'
  );

drop policy if exists "Authenticated users can view subscriptions" on public.newsletter_subscriptions;
drop policy if exists "Authenticated users can update subscriptions" on public.newsletter_subscriptions;

revoke select, update, delete on public.newsletter_subscriptions from public, anon, authenticated;

commit;
