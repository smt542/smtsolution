import { AppError, appToast as toast } from "@/hooks/common/useAppToast";
import type { UtilityAllocationResult } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

/** 정책 2.3 / 배포본 utility-electric.dc.html:827 — 고지금액(전기) = round(부과액 × 1.11 / 10) × 10. */
export function electricityNoticeAmount(chargeAmount: number): number {
  return Math.round((chargeAmount * 1.11) / 10) * 10;
}

const STATUS_REASON: Record<string, string> = {
  needs_review: "확인 필요(음수 사용량) 호실이 있어 배분하지 않았습니다",
  no_rows: "배분할 호실 지침이 없습니다",
  no_pool_usage: "수동입력 외 호실의 사용량이 없어 단가를 계산할 수 없습니다",
  over_pinned: "수동입력 합계가 청구총액보다 큽니다",
};

/** 배분 검산(Σ호실 = 고객번호 청구총액)이 맞지 않은 고객번호를 경고 토스트로 알린다. */
export function notifyAllocationMismatch(allocation: UtilityAllocationResult[]): boolean {
  const mismatched = allocation.filter((item) => !item.matched);
  if (mismatched.length === 0) return false;
  // 토스트는 한 번에 하나만 보이므로 불일치 고객번호를 한 문장으로 묶는다.
  toast.warning(mismatched.map((item) => {
    const reason = STATUS_REASON[item.status];
    return `고객번호 ${item.customerNo} 검산 불일치: 청구총액 ${formatNumber(item.amount)}원 / 호실 합계 ${formatNumber(item.allocated)}원${reason ? ` (${reason})` : ""}`;
  }).join(" · "));
  return true;
}

/**
 * 요약표 부과액 입력 → 저장할 고객번호×월 청구총액 변경분.
 * draft 는 직접 고친 값만 넘긴다(undefined = 손대지 않음) — 총액은 직접 입력한 경우에만 생긴다(옵트인).
 * 저장값과 같으면 보내지 않고, 빈 값은 총액 삭제(null → 기존 단가×량 계산으로 복귀)로 보낸다.
 */
export function customerBillChanges(
  entries: { customerNumberId: number; savedAmount: number | null; draft: string | undefined }[],
): { customer_number_id: number; amount: number | null }[] {
  return entries.flatMap(({ customerNumberId, savedAmount, draft }): { customer_number_id: number; amount: number | null }[] => {
    if (draft === undefined) return [];
    const text = draft.replace(/,/g, "").trim();
    if (text === "") return savedAmount === null ? [] : [{ customer_number_id: customerNumberId, amount: null }];
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) throw new AppError("부과액은 0 이상의 숫자로 입력해 주세요.");
    const rounded = Math.round(amount);
    if (rounded === savedAmount) return [];
    return [{ customer_number_id: customerNumberId, amount: rounded }];
  });
}

export interface UtilityAllocationPreview {
  status: "ok" | "over_pinned" | "no_pool_usage" | "no_input";
  /** gross-up 단가(원/량). 계산 불가면 null. */
  rate: number | null;
  /** 입력 순서별 호실 부과액. 계산 불가면 빈 배열. */
  fees: number[];
}

/** Postgres round(numeric) — 0.5 는 0에서 먼 쪽으로. */
function pgRound(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * 고객번호 부과액을 호실에 배분한다(정책 2.1·2.2, 서버 utility_allocation_compute 와 같은 계산).
 *   단가        = (잔여부과액 + 잔여호실 할인합계) ÷ 잔여량   (할인은 호실 gross 를 넘지 않게 수렴)
 *   호실 부과액 = max(0, 량 × 단가 − 그 호실 할인)          (수동입력 호실은 그 금액 고정)
 *   검산        : Σ 호실 부과액 = 고객번호 부과액           (차액은 비수동 호실에 호수 순으로 1원씩 흡수)
 * 입력 배열은 호수 순(잔액 흡수 순서)이어야 한다.
 */
export function computeUtilityAllocation(
  total: number | null,
  usage: (number | null)[],
  discount: number[],
  manual: (number | null)[],
): UtilityAllocationPreview {
  const n = usage.length;
  if (total === null || n === 0) return { status: "no_input", rate: null, fees: [] };

  let pinned = 0;
  let pooledUsage = 0;
  let pooledDiscount = 0;
  const pool: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const pin = manual[i];
    if (pin !== null && pin !== undefined) {
      pinned += pin;
    } else {
      pooledUsage += usage[i] ?? 0;
      pooledDiscount += discount[i] ?? 0;
      pool.push(i);
    }
  }
  if (pooledUsage <= 0) return { status: "no_pool_usage", rate: null, fees: [] };

  const rest = total - pinned;
  let rate = (rest + pooledDiscount) / pooledUsage;
  for (let k = 0; k < 24; k += 1) {
    const capped = pool.reduce((sum, i) => sum + Math.min(discount[i] ?? 0, pgRound((usage[i] ?? 0) * rate)), 0);
    if (capped === pooledDiscount) break;
    pooledDiscount = capped;
    rate = (rest + pooledDiscount) / pooledUsage;
  }

  let status: UtilityAllocationPreview["status"] = "ok";
  if (rate < 0) {
    rate = 0;
    status = "over_pinned";
  }

  const fees = usage.map((value, i) => {
    const pin = manual[i];
    if (pin !== null && pin !== undefined) return Math.trunc(pin);
    const gross = pgRound((value ?? 0) * rate);
    return Math.max(0, gross - Math.min(discount[i] ?? 0, gross));
  });

  let diff = Math.round(total - fees.reduce((sum, fee) => sum + fee, 0));
  if (diff > 0) {
    const base = Math.trunc(diff / pool.length);
    if (base > 0) {
      pool.forEach((i) => { fees[i] += base; });
      diff -= base * pool.length;
    }
    for (let k = 0; diff > 0; k += 1) {
      fees[pool[k]] += 1;
      diff -= 1;
    }
  } else if (diff < 0) {
    for (let guard = 0; diff < 0 && guard < 2000; guard += 1) {
      const positive = pool.filter((i) => fees[i] > 0);
      if (positive.length === 0) break;
      const take = Math.min(-diff, positive.length);
      for (let k = 0; k < take; k += 1) {
        fees[positive[k]] -= 1;
        diff += 1;
      }
    }
  }

  return { status, rate, fees };
}
