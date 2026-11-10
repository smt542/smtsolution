import type { PaymentHistoryOp, SavePaymentHistoryResult } from "@/hooks/reactquery/payments";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import type { SetupConfig } from "@/hooks/reactquery/setupConfig";
import { toMonthInput } from "@/lib/billing/period";
import { formatCurrency, unitLabel } from "../receiptFormat";
import {
  emptyFields,
  fieldsEqual,
  formatInputNumber,
  isNewDraft,
  normalizeAmount,
  todayInput,
  type HistoryDisplayRow,
} from "./paymentHistoryRows";

/**
 * 수납 이력 편집의 순수 비즈니스 규칙(UI·React 상태와 무관).
 * PaymentHistorySection 은 상태 보관·토스트·렌더링만 맡고, 행 변환·저장 연산·합계·문자 본문은 여기서 만든다.
 */

export type HistoryAction = "full" | "principal" | "split";

// ── 초안 행 생성 ──────────────────────────────────────────────

/** 「추가」로 만드는 새 수납 초안. 그 달 당월계·남은 연체료를 지금 값(수정 전 기준)으로 채운다. */
export function buildAddedRow(
  key: string,
  period: string,
  summary: ReceiptPaymentRow | undefined,
  historyRows: HistoryDisplayRow[],
): HistoryDisplayRow {
  const chargedInitial = summary?.charged != null ? formatInputNumber(summary.charged) : "";
  const monthLateFee = historyRows.find((candidate) => candidate.rowPeriod === period && candidate.rowSummary)?.lateFee ?? 0;
  const lateFeeInitial = monthLateFee > 0 ? formatInputNumber(monthLateFee) : "";
  return {
    key,
    rowPeriod: period,
    rowSummary: undefined,
    dueDate: summary?.dueDate ?? null,
    payment: null,
    fields: emptyFields(),
    originalFields: null,
    lateFee: 0,
    collectedLateFee: 0,
    draftSource: "added",
    billDraft: { charged: chargedInitial, lateFee: lateFeeInitial, chargedInitial, lateFeeInitial },
    lateOnly: false,
    cancelRequested: false,
    cancelCompleted: false,
    restoreRequested: false,
    saved: false,
  };
}

/** 처리 버튼을 누를 수 있는 행인지(취소·취소 예약 행 제외). */
export function isActionableRow(row: HistoryDisplayRow): boolean {
  return !(row.cancelRequested || row.cancelCompleted || row.payment?.status === "canceled");
}

/** 수.연: 원 행의 남은 연체료를 연체료 이전(수.연) 초안 행으로 나눈다. 원 행 바로 위에 넣고 원 행 연체료는 0 이 된다. */
export function splitLateFeeRows(rows: HistoryDisplayRow[], key: string, splitKey: string): HistoryDisplayRow[] {
  const index = rows.findIndex((candidate) => candidate.key === key);
  if (index < 0) return rows;
  const row = rows[index];
  const splitRow: HistoryDisplayRow = {
    key: splitKey,
    rowPeriod: row.rowPeriod,
    rowSummary: undefined,
    dueDate: row.dueDate,
    payment: null,
    fields: {
      ...emptyFields(row.fields.method, row.fields.kind),
      fee: row.fields.fee,
      memo: "연체료 이전",
    },
    originalFields: null,
    lateFee: row.lateFee,
    collectedLateFee: 0,
    draftSource: "split",
    lateOnly: true,
    cancelRequested: false,
    cancelCompleted: false,
    restoreRequested: false,
    saved: false,
  };
  const next = [...rows];
  next[index] = { ...row, lateFee: 0 };
  next.splice(index, 0, splitRow);
  return next;
}

/**
 * 완납(full)·원금(principal) 처리: 수납액을 잔액으로 채운다.
 * 기존 수납 행이면 그 수납액에 남은 금액을 더한다(record_payment_edit 가 이 행을 새 금액으로
 * 다시 기록하므로, 잔액만 넣으면 이미 낸 금액이 사라진다). 요약 행은 기존 금액이 0 이다.
 */
export function fillPaymentForAction(row: HistoryDisplayRow, action: "full" | "principal"): HistoryDisplayRow {
  const unpaidPrincipal = Math.max(row.rowSummary?.unpaid ?? 0, 0);
  const balance = unpaidPrincipal + row.lateFee;
  const existingAmount = row.payment?.status === "active" ? row.payment.amount : 0;
  return {
    ...row,
    fields: {
      ...row.fields,
      amount: formatInputNumber(existingAmount + (action === "full" ? balance : unpaidPrincipal)),
      paidAt: todayInput(),
      kind: row.lateOnly ? "partial" : action === "full" ? "full" : "principal",
      memo: row.lateOnly ? "연체료 이전" : action === "full" ? "" : "연체료 미수납",
    },
    draftSource: row.payment ? row.draftSource : row.draftSource === "none" ? "summary" : row.draftSource,
    saved: false,
  };
}

// ── 저장 ─────────────────────────────────────────────────────

/** 저장된 활성 수납 행이 수정되어 edit 연산이 필요한지. */
export function needsPaymentEdit(row: HistoryDisplayRow): boolean {
  return Boolean(
    row.payment
    && row.payment.status === "active"
    && !row.cancelRequested
    && !row.cancelCompleted
    && !row.saved
    && row.originalFields
    && !fieldsEqual(row.fields, row.originalFields),
  );
}

/** 저장 전 검증. 문제가 있으면 사용자 안내 문구를, 없으면 null 을 돌려준다. */
export function validateDraftRows(rows: HistoryDisplayRow[]): string | null {
  for (const row of rows) {
    const isCanceled = row.cancelRequested
      || row.cancelCompleted
      || row.payment?.status === "canceled";
    const needsNewRecord = isNewDraft(row) && !row.saved;
    const needsEdit = needsPaymentEdit(row);
    if (isCanceled || (!needsNewRecord && !needsEdit)) continue;
    if (needsEdit && normalizeAmount(row.fields.amount) <= 0) return "수납액을 올바르게 입력해 주세요";
  }
  return null;
}

/**
 * 초안 행 → save_payment_history 연산 목록.
 * 추가 행의 당월계·연체(bill)는 같은 달 수납보다 먼저 반영한다(고지 확정이 있어야 미납·연체가 계산됨).
 */
export function buildPaymentHistoryOps(rows: HistoryDisplayRow[], unitId: number): PaymentHistoryOp[] {
  const ops: PaymentHistoryOp[] = [];
  for (const row of rows) {
    if (row.restoreRequested && row.payment?.status === "canceled") {
      ops.push({ op: "restore", paymentId: row.payment.id });
      continue;
    }
    if (
      row.cancelRequested
      && row.payment?.status === "active"
      && !row.cancelCompleted
    ) {
      ops.push({ op: "cancel", paymentId: row.payment.id });
      continue;
    }
    if (row.cancelRequested && row.split && !row.payment) {
      ops.push({ op: "cancel_split", splitId: row.split.id });
      continue;
    }

    const amount = normalizeAmount(row.fields.amount);
    const input = {
      unitId,
      period: row.rowPeriod,
      amount,
      fee: normalizeAmount(row.fields.fee),
      method: row.fields.method,
      kind: row.fields.kind,
      depositType: row.fields.depositType || null,
      paidAt: row.fields.paidAt || null,
      memo: row.fields.memo || null,
    };
    // 수.연 초안: 나눈 연체료를 미수금으로 저장하고, 수납액이 있으면 그 수납도 함께 연결한다.
    if (row.draftSource === "split" && !row.saved) {
      ops.push({ op: "split", splitAmount: row.lateFee, splitMemo: row.fields.memo || null, ...input });
      continue;
    }
    if (isNewDraft(row) && !row.saved) {
      if (amount > 0) ops.push({ op: "record", lateFeeSplitId: row.split?.id ?? null, ...input });
      continue;
    }
    if (needsPaymentEdit(row) && row.payment) ops.push({ op: "edit", oldPaymentId: row.payment.id, ...input });
  }

  const billOps: PaymentHistoryOp[] = [];
  for (const row of rows) {
    if (!row.billDraft || row.saved || row.draftSource !== "added") continue;
    const { charged, lateFee, chargedInitial, lateFeeInitial } = row.billDraft;
    const setCharged = charged.trim() !== "" && charged !== chargedInitial;
    const setLateFee = lateFee !== lateFeeInitial;
    if (!setCharged && !setLateFee) continue;
    billOps.push({
      op: "bill",
      unitId,
      period: row.rowPeriod,
      charged: setCharged ? normalizeAmount(charged) : null,
      setCharged,
      // 연체 칸을 비우면 수동 값을 지우고 자동 계산으로 되돌린다.
      lateFee: setLateFee && lateFee.trim() !== "" ? normalizeAmount(lateFee) : null,
      setLateFee,
    });
  }
  return [...billOps, ...ops];
}

/** 저장 성공 안내 문구. */
export function saveSuccessMessage(result: SavePaymentHistoryResult | null): string {
  const addedCount = result?.recorded ?? 0;
  const restoredCount = result?.restored ?? 0;
  const allocated = result?.allocated ?? 0;
  // 선택한 달 미납을 넘는 금액은 이전 미납 달부터 나눠 수납했다(QA #31). 남은 초과분은 과수납으로 남는다.
  if (allocated > 0) return `${addedCount}건이 추가되었어요. 초과 금액 ${formatCurrency(allocated)}원은 이전 미납 달부터 나눠 수납했어요`;
  if (addedCount > 0) return `${addedCount}건이 추가되었어요`;
  if (restoredCount > 0) return `${restoredCount}건을 되살렸어요`;
  return "수납 이력을 저장했어요";
}

// ── 하단 미납 합계·미납 문자 ─────────────────────────────────

export interface FooterPeriodRow {
  period: string;
  unpaidPrincipal: number;
  lateFee: number;
  total: number;
}

/** 월별 미납 원금 + 남은 연체료. 합계가 0 인 달은 뺀다. */
export function buildFooterRows(rows: HistoryDisplayRow[]): FooterPeriodRow[] {
  const byPeriod = new Map<string, FooterPeriodRow>();
  for (const row of rows) {
    const current = byPeriod.get(row.rowPeriod) ?? {
      period: row.rowPeriod,
      unpaidPrincipal: 0,
      lateFee: 0,
      total: 0,
    };
    if (row.rowSummary) {
      current.unpaidPrincipal = Math.max(row.rowSummary.unpaid ?? 0, 0);
    }
    if (row.rowSummary || row.lateOnly) current.lateFee += row.lateFee;
    byPeriod.set(row.rowPeriod, current);
  }
  return [...byPeriod.values()]
    .map((row) => ({ ...row, total: row.unpaidPrincipal + row.lateFee }))
    .filter((row) => row.total > 0);
}

export function sumFooterRows(rows: FooterPeriodRow[]): { unpaid: number; lateFee: number; total: number } {
  return rows.reduce(
    (totals, row) => ({
      unpaid: totals.unpaid + row.unpaidPrincipal,
      lateFee: totals.lateFee + row.lateFee,
      total: totals.total + row.total,
    }),
    { unpaid: 0, lateFee: 0, total: 0 },
  );
}

/**
 * 입금 계좌 = 고지서에 인쇄되는 관리비 계좌(고지서 설정과 같은 규칙: 계좌 2에 출력을 고른 경우만 계좌 2).
 * 정본 문구 `국민 123-45-6789 (스마일종합관리)` 형식이며, 예금주가 없으면 괄호를 뺀다. 계좌가 없으면 null.
 */
export function mgmtAccountLine(setupConfig: SetupConfig | null | undefined): string | null {
  if (!setupConfig) return null;
  const account = !setupConfig.mgmtPrint1 && setupConfig.mgmtPrint2
    ? { bank: setupConfig.mgmtBank2, acct: setupConfig.mgmtAcct2, holder: setupConfig.mgmtHolder2 }
    : { bank: setupConfig.mgmtBank1, acct: setupConfig.mgmtAcct1, holder: setupConfig.mgmtHolder1 };
  if (!account.bank || !account.acct) return null;
  return `${account.bank} ${account.acct}${account.holder ? ` (${account.holder})` : ""}`;
}

/** 미납 안내 문자 본문. */
export function buildUnpaidSmsBody({
  buildingName,
  buildingAddress,
  summary,
  footerRows,
  total,
  accountLine,
}: {
  buildingName: string;
  buildingAddress: string | null;
  summary: ReceiptPaymentRow;
  footerRows: FooterPeriodRow[];
  total: number;
  accountLine: string | null;
}): string {
  const lines = [
    [buildingName, unitLabel(summary)].filter(Boolean).join(" "),
    buildingAddress ?? "",
    "",
    ...footerRows.map((row) => `${toMonthInput(row.period)}분  ${formatCurrency(row.total)}원`),
    "",
    `합계  ${formatCurrency(total)}원`,
    "",
    "입금 부탁드립니다.",
  ];
  if (accountLine) lines.push(accountLine);
  return lines.join("\n");
}
