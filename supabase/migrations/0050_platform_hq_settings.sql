-- 0050_platform_hq_settings.sql
-- 본사 플랫폼 설정(PHASE 1): 발송 단가·잔액 알림·청구 계좌와 청구서 기본값 싱글턴.
-- 의존: 0000(profiles·audit_log), 0011(current_user_is_platform_admin).

create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  rate_krw_alimtalk integer not null default 0,
  rate_krw_sms integer not null default 0,
  rate_krw_fax integer not null default 0,
  low_balance_threshold integer not null default 0,
  billing_bank text,
  billing_account_no text,
  billing_account_holder text,
  business_reg_no text,
  invoice_notice text,
  billing_basis text,
  payment_due_days integer not null default 0,
  vat_rate numeric not null default 10,
  contact_person text,
  updated_by uuid references public.profiles(user_id),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings(id)
values (1)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

create policy platform_settings_platform_select
  on public.platform_settings
  for select to authenticated
  using (public.current_user_is_platform_admin());

create policy platform_settings_platform_all
  on public.platform_settings
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

create or replace function public.platform_update_settings(
  p_rate_krw_alimtalk integer,
  p_rate_krw_sms integer,
  p_rate_krw_fax integer,
  p_low_balance_threshold integer,
  p_billing_bank text,
  p_billing_account_no text,
  p_billing_account_holder text,
  p_business_reg_no text,
  p_invoice_notice text,
  p_billing_basis text,
  p_payment_due_days integer,
  p_vat_rate numeric,
  p_contact_person text
)
returns public.platform_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_settings public.platform_settings%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  select to_jsonb(setting)
    into v_before
    from public.platform_settings setting
    where setting.id = 1;

  update public.platform_settings
    set rate_krw_alimtalk = p_rate_krw_alimtalk,
        rate_krw_sms = p_rate_krw_sms,
        rate_krw_fax = p_rate_krw_fax,
        low_balance_threshold = p_low_balance_threshold,
        billing_bank = p_billing_bank,
        billing_account_no = p_billing_account_no,
        billing_account_holder = p_billing_account_holder,
        business_reg_no = p_business_reg_no,
        invoice_notice = p_invoice_notice,
        billing_basis = p_billing_basis,
        payment_due_days = p_payment_due_days,
        vat_rate = p_vat_rate,
        contact_person = p_contact_person,
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = 1
    returning * into v_settings;

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
    null,
    (select auth.uid()),
    'PLATFORM_SETTINGS_UPDATE',
    'platform_settings',
    '1',
    v_before,
    to_jsonb(v_settings)
  );

  return v_settings;
end
$$;

revoke all on function public.platform_update_settings(
  integer, integer, integer, integer, text, text, text, text, text, text,
  integer, numeric, text
) from public, anon;
grant execute on function public.platform_update_settings(
  integer, integer, integer, integer, text, text, text, text, text, text,
  integer, numeric, text
) to authenticated;
