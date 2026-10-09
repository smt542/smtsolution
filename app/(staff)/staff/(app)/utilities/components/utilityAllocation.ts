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
