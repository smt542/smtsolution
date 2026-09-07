import type { Deposit } from "./bankParse";

export interface MatchUnit { unitId: number; unitNo: string; payerNo: string | null; payerName: string | null; tenantName: string | null; unpaid: number | null; }
export interface MatchedDeposit {
  deposit: Deposit; unitId: number; unitNo: string; unpaid: number | null; delta: number | null;
  /** 입금액이 미납액을 초과하는가(초과분은 자동 수납 금지 → 수동 검토). unpaid=null이면 판정 불가로 false. */
  overpay: boolean;
  /** 실제 자동 수납으로 기록할 금액. 초과분은 미납액으로 캡(음수 미납 방지). unpaid=null이면 입금액 그대로. */
  postAmount: number;
}
/** 이름이 복수 세대와 일치해 자동 확정하지 않는 입금(수동 선택 대상). candidates에 후보 세대 목록을 담는다. */
export interface AmbiguousDeposit { deposit: Deposit; candidates: MatchUnit[]; }
export interface MatchResult { matched: MatchedDeposit[]; ambiguous: AmbiguousDeposit[]; unmatched: Deposit[]; }

/** 매칭된 입금 1건의 초과 여부·자동 수납 금액을 산출(단일 소스). */
export function resolveMatch(deposit: Deposit, unit: MatchUnit): MatchedDeposit {
  const unpaid = unit.unpaid;
  const overpay = unpaid != null && deposit.amount > unpaid;
  return {
    deposit,
    unitId: unit.unitId,
    unitNo: unit.unitNo,
    unpaid,
    delta: unpaid == null ? null : deposit.amount - unpaid,
    overpay,
    // 초과분은 미납액까지만 자동 반영(음수 미납 방지). 부족/일치/미부과는 입금액 그대로.
    postAmount: overpay ? (unpaid as number) : deposit.amount,
  };
}

export function normalizeName(s: string): string {
  return (s ?? "").replace(/[\s()（）]/g, "").toLocaleLowerCase("ko-KR");
}

function normalizeNameWithoutDigits(s: string): string {
  return normalizeName(s).replace(/\d+/g, "");
}

export function matchDeposits(deposits: Deposit[], units: MatchUnit[]): MatchResult {
  const byPayerNo = new Map<string, MatchUnit>();
  for (const u of units) if (u.payerNo) byPayerNo.set(u.payerNo.trim(), u);

  const matched: MatchedDeposit[] = [];
  const ambiguous: AmbiguousDeposit[] = [];
  const unmatched: Deposit[] = [];

  for (const d of deposits) {
    let hit: MatchUnit | undefined;
    // 복수 일치 시 자동 확정하지 않고 수동 선택 대상으로 넘길 후보 목록.
    let candidates: MatchUnit[] = [];
    if (d.customerNo && byPayerNo.has(d.customerNo.trim())) {
      hit = byPayerNo.get(d.customerNo.trim());
    } else if (d.name) {
      const key = normalizeName(d.name);
      const exactCandidates = units.filter(
        (u) => (u.payerName && normalizeName(u.payerName) === key) || (u.tenantName && normalizeName(u.tenantName) === key),
      );
      if (exactCandidates.length === 1) {
        hit = exactCandidates[0];
      } else if (exactCandidates.length > 1) {
        candidates = exactCandidates;
      } else {
        const digitlessKey = normalizeNameWithoutDigits(d.name);
        const fallbackCandidates = digitlessKey
          ? units.filter(
              (u) => (u.payerName && normalizeNameWithoutDigits(u.payerName) === digitlessKey)
                || (u.tenantName && normalizeNameWithoutDigits(u.tenantName) === digitlessKey),
            )
          : [];
        if (fallbackCandidates.length === 1) hit = fallbackCandidates[0];
        else if (fallbackCandidates.length > 1) candidates = fallbackCandidates;
      }
    }
    if (hit) { matched.push(resolveMatch(d, hit)); continue; }
    // 복수 후보 → 수동 선택 대상(자동 확정 금지). 후보 없음 → 미매칭.
    if (candidates.length > 1) { ambiguous.push({ deposit: d, candidates }); continue; }
    unmatched.push(d);
  }
  return { matched, ambiguous, unmatched };
}
