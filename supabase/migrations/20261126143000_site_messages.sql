-- Development migration. Do not apply to production until this migration has been checked on a copy.
-- Contact form messages for the platform admin inbox.
-- The browser role cannot read or write these rows. The API uses the service role.

begin;

create table public.site_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (
    length(email) between 3 and 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or length(btrim(phone)) between 7 and 20),
  business_name text check (business_name is null or length(btrim(business_name)) between 1 and 160),
  service text check (service is null or length(btrim(service)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'replied')),
  created_at timestamptz not null default now()
);

create table public.site_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.site_messages(id),
  body text not null check (length(btrim(body)) between 1 and 5000),
  sent_at timestamptz not null default now()
);

create index site_messages_created on public.site_messages (created_at desc);
create index site_message_replies_message on public.site_message_replies (message_id, sent_at);

comment on table public.site_messages is
  'Contact form messages for the platform admin. A reply is stored after the email provider accepts it.';

alter table public.site_messages enable row level security;
alter table public.site_messages force row level security;
alter table public.site_message_replies enable row level security;
alter table public.site_message_replies force row level security;

revoke all on public.site_messages from public, anon, authenticated;
revoke all on public.site_message_replies from public, anon, authenticated;
grant select, insert, update on public.site_messages to service_role;
grant select, insert on public.site_message_replies to service_role;

commit;
