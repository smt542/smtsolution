import type { Deposit } from "./bankParse";

export interface MatchUnit { unitId: number; unitNo: string; payerNo: string | null; payerName: string | null; tenantName: string | null; unpaid: number | null; }
export interface MatchedDeposit { deposit: Deposit; unitId: number; unitNo: string; unpaid: number | null; delta: number | null; }
export interface MatchResult { matched: MatchedDeposit[]; unmatched: Deposit[]; }

export function normalizeName(s: string): string {
  return (s ?? "").replace(/[\s()（）]/g, "").replace(/\d+/g, "").toLocaleLowerCase("ko-KR");
}

export function matchDeposits(deposits: Deposit[], units: MatchUnit[]): MatchResult {
  const byPayerNo = new Map<string, MatchUnit>();
  for (const u of units) if (u.payerNo) byPayerNo.set(u.payerNo.trim(), u);

  const matched: MatchedDeposit[] = [];
  const unmatched: Deposit[] = [];

  for (const d of deposits) {
    let hit: MatchUnit | undefined;
    if (d.customerNo && byPayerNo.has(d.customerNo.trim())) {
      hit = byPayerNo.get(d.customerNo.trim());
    } else if (d.name) {
      const key = normalizeName(d.name);
      const cands = units.filter(
        (u) => (u.payerName && normalizeName(u.payerName) === key) || (u.tenantName && normalizeName(u.tenantName) === key),
      );
      if (cands.length === 1) hit = cands[0];
    }
    if (!hit) { unmatched.push(d); continue; }
    matched.push({
      deposit: d, unitId: hit.unitId, unitNo: hit.unitNo, unpaid: hit.unpaid,
      delta: hit.unpaid == null ? null : d.amount - hit.unpaid,
    });
  }
  return { matched, unmatched };
}
