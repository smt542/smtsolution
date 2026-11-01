-- 0335 (QA #48 후속): 자동수납 모드에서 퇴실월 부과분도 잔액 수납 처리한다(메모 '퇴실정산(일할) 처리').
--  ② 관리비 일할액은 payments 로 기록되지 않으므로, 퇴실월 고지분을 열어두면 퇴실자 미수로 영구 잔존한다.
--  기존 자동수납 행과 같은 방식(같은 트랜잭션 created_at)이라 퇴실 취소 시 함께 되돌린다(cancel 의 memo 조건 확장).
--  납기 미도래 이전 월분은 그대로 둔다. 수동 모드는 변경 없음. 라이브 정의를 치환한다.
begin;

do $do$
declare
  v_def text;
  v_new text;
  r record;
begin
  -- complete_moving_settlement
  v_def := pg_get_functiondef('public.complete_moving_settlement(bigint)'::regprocedure);
  v_new := v_def;
  for r in select * from (values
    ($q$        and bc.period <> date_trunc('month', v_move_out_date)::date
        and coalesce($q$,
     $q$        and (bc.period = date_trunc('month', v_move_out_date)::date or coalesce($q$),
    ($q$            ) < (timezone('Asia/Seoul', now()))::date
      group by$q$,
     $q$            ) < (timezone('Asia/Seoul', now()))::date)
      group by$q$),
    ($q$'other', 'full', '퇴실정산 자동수납', v_move_out_date$q$,
     $q$'other', 'full', case when v_row.period = date_trunc('month', v_move_out_date)::date then '퇴실정산(일할) 처리' else '퇴실정산 자동수납' end, v_move_out_date$q$)
  ) t(o, n)
  loop
    if position(r.o in v_new) = 0 then raise exception 'complete patch target not found: %', left(r.o, 60); end if;
    v_new := replace(v_new, r.o, r.n);
  end loop;
  execute v_new;

  -- cancel_moving_settlement_moveout
  v_def := pg_get_functiondef('public.cancel_moving_settlement_moveout(bigint)'::regprocedure);
  if position($q$and memo = '퇴실정산 자동수납'$q$ in v_def) = 0 then raise exception 'cancel patch target not found'; end if;
  execute replace(v_def, $q$and memo = '퇴실정산 자동수납'$q$, $q$and memo in ('퇴실정산 자동수납', '퇴실정산(일할) 처리')$q$);
end
$do$;

commit;
