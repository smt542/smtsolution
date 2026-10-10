-- 수납 이력 「구분」·「은행」을 정책 코드값으로 맞춘다(상태·코드 정의 3절).
--
-- 구분(= payments.method): 일반(general) · 지로(giro) · 이체(transfer) · 무통(deposit, 무통장).
--   기존 값(cash·auto_debit·card·other)은 과거·연동 데이터 호환을 위해 허용만 유지하고 화면에서는 고르지 않는다.
-- 은행(= payments.deposit_type, 신규): 입금 은행(수납) 무통장입금(bankbook) · 지로입금(giro). 선택 안 함(null) 가능.
-- 처리 유형(payments.kind: full·principal·partial)은 그대로 — 화면 처리 버튼이 정한다.
--
-- 변경 함수: record_payment · record_payment_edit(p_deposit_type 추가) · save_payment_history(전달) ·
--            list_unit_payments · get_payment_statement_data(반환에 deposit_type 포함)

alter table public.payments add column if not exists deposit_type text;
alter table public.payments drop constraint if exists payments_deposit_type_check;
alter table public.payments add constraint payments_deposit_type_check
  check (deposit_type is null or deposit_type in ('bankbook', 'giro'));
comment on column public.payments.deposit_type is '입금 은행(수납): bankbook=무통장입금, giro=지로입금';

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method = any (array['general', 'giro', 'transfer', 'deposit', 'cash', 'auto_debit', 'card', 'other']));

do $$
declare
  v_def text;
  v_new text;
  v_old_methods constant text := $q$('cash','transfer','auto_debit','giro','card','other')$q$;
  v_new_methods constant text := $q$('general','giro','transfer','deposit','cash','auto_debit','card','other')$q$;
  v_check constant text := $q$
  if p_deposit_type is not null and p_deposit_type not in ('bankbook','giro') then raise exception 'invalid deposit_type'; end if;$q$;
begin
  -- 1) record_payment(+p_deposit_type)
  v_def := pg_get_functiondef('public.record_payment(bigint,date,integer,text,text,text,date,integer)'::regprocedure);
  v_new := replace(v_def, 'p_fee integer DEFAULT 0)', 'p_fee integer DEFAULT 0, p_deposit_type text DEFAULT NULL::text)');
  v_new := replace(v_new, 'p_method not in ' || v_old_methods || ' then raise exception ''invalid method''; end if;',
                          'p_method not in ' || v_new_methods || ' then raise exception ''invalid method''; end if;' || v_check);
  v_new := replace(v_new, 'method, kind, memo, paid_at, source, created_by)', 'method, kind, memo, paid_at, source, created_by, deposit_type)');
  v_new := replace(v_new, '''manual'', auth.uid())', '''manual'', auth.uid(), p_deposit_type)');
  if v_new = v_def or position('p_deposit_type)' in v_new) = 0 or position('invalid deposit_type' in v_new) = 0 then
    raise exception 'record_payment patch failed';
  end if;
  drop function public.record_payment(bigint,date,integer,text,text,text,date,integer);
  execute v_new;

  -- 2) record_payment_edit(+p_deposit_type)
  v_def := pg_get_functiondef('public.record_payment_edit(bigint,bigint,date,integer,text,text,text,date,integer,text)'::regprocedure);
  v_new := replace(v_def, 'p_source text DEFAULT NULL::text)', 'p_source text DEFAULT NULL::text, p_deposit_type text DEFAULT NULL::text)');
  v_new := replace(v_new, 'p_method not in ' || v_old_methods || ' then raise exception ''invalid method''; end if;',
                          'p_method not in ' || v_new_methods || ' then raise exception ''invalid method''; end if;' || v_check);
  v_new := replace(v_new, 'source, external_ref, created_by)', 'source, external_ref, created_by, deposit_type)');
  v_new := replace(v_new, 'then v_old_ref else null end, auth.uid())', 'then v_old_ref else null end, auth.uid(), p_deposit_type)');
  if v_new = v_def or position('auth.uid(), p_deposit_type)' in v_new) = 0 or position('invalid deposit_type' in v_new) = 0 then
    raise exception 'record_payment_edit patch failed';
  end if;
  drop function public.record_payment_edit(bigint,bigint,date,integer,text,text,text,date,integer,text);
  execute v_new;

  -- 3) save_payment_history: deposit_type 전달
  v_def := pg_get_functiondef('public.save_payment_history(jsonb)'::regprocedure);
  v_new := replace(v_def, 'coalesce((v_op->>''fee'')::int, 0));', 'coalesce((v_op->>''fee'')::int, 0), v_op->>''deposit_type'');');
  v_new := replace(v_new, '(v_op->>''fee'')::int, null);', '(v_op->>''fee'')::int, null, v_op->>''deposit_type'');');
  if (length(v_new) - length(replace(v_new, 'deposit_type', ''))) / length('deposit_type') <> 2 then
    raise exception 'save_payment_history patch failed';
  end if;
  execute v_new;

  -- 4) list_unit_payments: 반환에 deposit_type
  v_def := pg_get_functiondef('public.list_unit_payments(bigint,date)'::regprocedure);
  v_new := replace(v_def, 'created_at timestamp with time zone, replaced_by bigint)', 'created_at timestamp with time zone, replaced_by bigint, deposit_type text)');
  v_new := replace(v_new, 'p.created_at, p.replaced_by', 'p.created_at, p.replaced_by, p.deposit_type');
  if position('deposit_type text)' in v_new) = 0 or position('p.deposit_type' in v_new) = 0 then
    raise exception 'list_unit_payments patch failed';
  end if;
  drop function public.list_unit_payments(bigint,date);
  execute v_new;

  -- 5) get_payment_statement_data: 수납 이력 JSON 에 deposit_type
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_payment_statement_data';
  if position('p.deposit_type' in v_def) = 0 then
    v_new := regexp_replace(v_def, 'p\.replaced_by(\s*)from payments p', 'p.replaced_by,\1  p.deposit_type\1from payments p');
    if v_new = v_def then raise exception 'get_payment_statement_data patch failed'; end if;
    execute v_new;
  end if;
end $$;

grant execute on function public.record_payment(bigint,date,integer,text,text,text,date,integer,text) to authenticated, service_role;
grant execute on function public.record_payment_edit(bigint,bigint,date,integer,text,text,text,date,integer,text,text) to authenticated, service_role;
grant execute on function public.list_unit_payments(bigint,date) to authenticated, service_role;
