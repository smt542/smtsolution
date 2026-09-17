-- 장기수선비 원장 저장 RPC가 저장된 행 id를 입력 순서대로 돌려주도록 바꾼다.
--
-- 배경: 새 행(추가)에 영수증·공사사진을 붙이려면 첨부를 연결할 ledger row id가 필요한데,
-- 저장 RPC가 void라 방금 insert된 행의 id를 알 수 없었다. 그래서 새 행은 한 번 저장한 뒤에야
-- 첨부가 가능했다. 반환값을 bigint[]로 바꿔 클라이언트가 p_rows[i] -> 반환[i]로 매핑하고,
-- 저장 직후 스테이징해 둔 파일을 그 id에 업로드할 수 있게 한다.
--
-- jsonb_array_elements는 배열 순서를 보존하므로 반환 배열의 i번째는 p_rows의 i번째 행에 대응한다.
-- 갱신 행은 기존 id를, 신규 행은 새로 발급된 id를 담는다.
--
-- 반환 타입 변경이라 create or replace가 불가능해 drop 후 재생성한다. 권한도 함께 복원한다.
-- 로직(권한 검사·검증·갱신 조건·soft delete)은 0025와 동일하게 유지한다.

drop function if exists save_long_term_repair_ledger(bigint, jsonb, bigint[]);

create function save_long_term_repair_ledger(
  p_building_id bigint,
  p_rows jsonb,
  p_deleted_ids bigint[] default '{}'::bigint[]
)
returns bigint[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org bigint;
  v_item jsonb;
  v_id bigint;
  v_before jsonb;
  v_entry_date date;
  v_entry_no text;
  v_fund_note text;
  v_deposit bigint;
  v_withdrawal bigint;
  v_memo text;
  v_ids bigint[] := '{}'::bigint[];
  v_deleted_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('settings') then
    raise exception 'forbidden: settings required';
  end if;
  if not exists (
    select 1 from buildings b
    where b.id = p_building_id and b.org_id = v_org and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;
  if p_rows is not null and jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    v_entry_date := (v_item ->> 'entry_date')::date;
    v_entry_no := coalesce(v_item ->> 'entry_no', '');
    v_fund_note := coalesce(v_item ->> 'fund_note', '');
    v_deposit := coalesce((v_item ->> 'deposit')::bigint, 0);
    v_withdrawal := coalesce((v_item ->> 'withdrawal')::bigint, 0);
    v_memo := nullif(v_item ->> 'memo', '');

    if v_entry_date is null then
      raise exception 'entry_date is required';
    end if;
    if v_deposit < 0 or v_withdrawal < 0 then
      raise exception 'amount must be non-negative';
    end if;

    if v_id is null then
      insert into long_term_repair_ledger(
        org_id, building_id, entry_date, entry_no, fund_note, deposit, withdrawal, memo
      ) values (
        v_org, p_building_id, v_entry_date, v_entry_no, v_fund_note,
        v_deposit, v_withdrawal, v_memo
      )
      returning id into v_id;
    else
      select to_jsonb(l) into v_before
      from long_term_repair_ledger l
      where l.id = v_id
        and l.org_id = v_org
        and l.building_id = p_building_id
        and l.deleted_at is null;
      if v_before is null then
        raise exception 'ledger row not found: %', v_id;
      end if;

      update long_term_repair_ledger l
      set entry_date = v_entry_date,
          entry_no = v_entry_no,
          fund_note = v_fund_note,
          deposit = v_deposit,
          withdrawal = v_withdrawal,
          memo = v_memo
      where l.id = v_id
        and row(l.entry_date, l.entry_no, l.fund_note, l.deposit, l.withdrawal, l.memo)
          is distinct from
            row(v_entry_date, v_entry_no, v_fund_note, v_deposit, v_withdrawal, v_memo);
    end if;

    v_ids := v_ids || v_id;
  end loop;

  for v_deleted_id in select unnest(coalesce(p_deleted_ids, '{}'::bigint[])) loop
    update long_term_repair_ledger l
    set deleted_at = now()
    where l.id = v_deleted_id
      and l.org_id = v_org
      and l.building_id = p_building_id
      and l.deleted_at is null;
  end loop;

  return v_ids;
end
$$;

revoke execute on function save_long_term_repair_ledger(bigint, jsonb, bigint[]) from public, anon;
grant execute on function save_long_term_repair_ledger(bigint, jsonb, bigint[]) to authenticated;
