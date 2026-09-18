-- 0174: PII access audit log foundation.
-- Append-only from the application surface: service_role writes, while authenticated
-- users can read only rows belonging to one of their organizations (or platform admins).

create table if not exists public.access_log (
  id          bigserial primary key,
  org_id      bigint,
  actor_id    uuid,
  actor_label text,
  persona     text check (persona in (
    'manager_staff', 'field_partner', 'platform_admin', 'resident', 'public'
  )),
  event       text not null check (event in (
    'PII_REVEAL', 'EXPORT_XLSX', 'EXPORT_CSV', 'PRINT',
    'SEND_SMS', 'SEND_ALIMTALK', 'SEND_FAX', 'PUBLIC_LINK_VIEW'
  )),
  target_kind text,
  target_id   text,
  field       text,
  row_count   integer,
  detail      jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists access_log_org_created_at_idx
  on public.access_log (org_id, created_at desc);
create index if not exists access_log_actor_created_at_idx
  on public.access_log (actor_id, created_at desc);
create index if not exists access_log_event_created_at_idx
  on public.access_log (event, created_at desc);
create index if not exists access_log_created_at_idx
  on public.access_log (created_at);

comment on table public.access_log is
  'PII access audit log. App-surface writes are append-only and service_role-only; org_id and actor_id intentionally have no foreign keys so history survives organization and actor deletion.';
comment on column public.access_log.org_id is
  'Organization identifier snapshot. Intentionally has no foreign key so the log survives organization deletion.';
comment on column public.access_log.actor_id is
  'auth.users identifier snapshot. Intentionally has no foreign key so resident hard-delete cannot erase the audit trail.';
comment on column public.access_log.actor_label is
  'Login ID or display-name snapshot captured at event time.';
comment on column public.access_log.field is
  'PII field revealed or included in the operation, such as phone, phone2, phone3, or fax_number.';

comment on column public.access_log.ip is
  'Client IP snapshot stored as text, not inet: x-forwarded-for is attacker-controlled and a malformed value must never fail the insert.';

alter table public.access_log enable row level security;

drop policy if exists access_log_select on public.access_log;
create policy access_log_select on public.access_log
  for select to authenticated
  using (
    (org_id in (select my_org_ids()) and current_user_is_manager_staff())
    or current_user_is_platform_admin()
  );

-- No INSERT/UPDATE/DELETE policies: only service_role may append through the admin client.
revoke insert, update, delete, truncate on table public.access_log
  from anon, authenticated, public;
revoke all on table public.access_log from anon;
grant select on table public.access_log to authenticated;

-- Do not expose the bigserial sequence to the app roles. service_role retains its
-- default sequence privileges for inserts through the admin client.
revoke all on sequence public.access_log_id_seq from anon, authenticated, public;
