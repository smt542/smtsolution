-- Label-master rows are soft-deleted. Keep labels unique only among active rows
-- so a deleted label can be created again without colliding with its old row.

alter table public.settlement_check_items
  drop constraint if exists settlement_check_items_org_id_label_key;
create unique index if not exists settlement_check_items_org_label_active_key
  on public.settlement_check_items (org_id, label)
  where deleted_at is null;

alter table public.as_categories
  drop constraint if exists as_categories_org_id_label_key;
create unique index if not exists as_categories_org_label_active_key
  on public.as_categories (org_id, label)
  where deleted_at is null;

alter table public.room_types
  drop constraint if exists room_types_org_id_label_key;
create unique index if not exists room_types_org_label_active_key
  on public.room_types (org_id, label)
  where deleted_at is null;

alter table public.cleaning_teams
  drop constraint if exists cleaning_teams_org_id_label_key;
create unique index if not exists cleaning_teams_org_label_active_key
  on public.cleaning_teams (org_id, label)
  where deleted_at is null;

alter table public.septic_vendors
  drop constraint if exists septic_vendors_org_id_label_key;
create unique index if not exists septic_vendors_org_label_active_key
  on public.septic_vendors (org_id, label)
  where deleted_at is null;
