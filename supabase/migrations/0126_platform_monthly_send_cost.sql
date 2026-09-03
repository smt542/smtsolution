-- Platform dashboard monthly send-cost chart.
-- Keep finalized invoice channel snapshots immutable; price live usage with the
-- same current platform settings used by platform_list_org_billing(date).

create or replace function public.platform_get_monthly_send_cost(p_year int)
returns table (
  month int,
  alimtalk_krw numeric,
  sms_krw numeric,
  fax_krw numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_year is null or p_year not between 1 and 9999 then
    raise exception 'billing year must be between 1 and 9999' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  return query
  with setting as (
    select * from public.platform_settings where id = 1
  ), months as (
    select
      month_number::int as month_number,
      make_date(p_year, month_number::int, 1) as billing_month
    from generate_series(1, 12) as generated(month_number)
  ), monthly_amounts as (
    select
      months.month_number,
      coalesce(sum(
        case
          when invoice.id is not null then invoice.alimtalk_amount_krw
          else usage.alimtalk_count::bigint * setting.rate_krw_alimtalk
        end
      ), 0)::numeric as alimtalk_krw,
      coalesce(sum(
        case
          when invoice.id is not null then invoice.sms_amount_krw
          else (
            usage.sms_count::bigint * setting.rate_krw_sms
            + usage.lms_count::bigint * setting.rate_krw_lms
          )
        end
      ), 0)::numeric as sms_krw,
      coalesce(sum(
        case
          when invoice.id is not null then invoice.fax_amount_krw
          else usage.fax_pages::bigint * setting.rate_krw_fax
        end
      ), 0)::numeric as fax_krw
    from months
    cross join lateral public.platform_org_usage(months.billing_month) usage
    cross join setting
    left join public.platform_billing_invoices invoice
      on invoice.org_id = usage.org_id
      and invoice.billing_month = months.billing_month
    group by months.month_number
  )
  select
    months.month_number,
    coalesce(monthly_amounts.alimtalk_krw, 0::numeric),
    coalesce(monthly_amounts.sms_krw, 0::numeric),
    coalesce(monthly_amounts.fax_krw, 0::numeric)
  from months
  left join monthly_amounts on monthly_amounts.month_number = months.month_number
  order by months.month_number;
end
$$;

revoke all on function public.platform_get_monthly_send_cost(int)
  from public, anon;
grant execute on function public.platform_get_monthly_send_cost(int)
  to authenticated;
