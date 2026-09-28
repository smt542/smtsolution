"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CustomDropdown, Input, Panel, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CloseIcon, UnitCardIcon } from "@/components/icons";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useCancelPayment, useRecordPayment, useRecordPaymentEdit } from "@/hooks/reactquery/payments";
import type { PaymentKind, PaymentMethod } from "@/hooks/reactquery/payments";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  receiptKeys,
  type ReceiptPaymentRow,
  type ReceiptStatementPaymentRow,
} from "@/hooks/reactquery/receipts";
import type { RateTier } from "@/lib/billing/lateFee";
import { toMonthInput } from "@/lib/billing/period";
import { openMessengerWith } from "@/lib/messaging/messengerHandoff";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  formatCurrency,
  unitLabel,
} from "../receiptFormat";
import {
  buildHistoryRows,
  cloneRows,
  emptyFields,
  fieldsEqual,
  formatInputNumber,
  isNewDraft,
  normalizeAmount,
  type HistoryDisplayRow,
  type HistoryPayment,
  type PaymentFields,
  todayInput,
} from "./paymentHistoryRows";

// 정본 `#rcHistWrap thead th` — 보기 모드는 auto layout + th min-width(Figma 고정 전체 폭 없음).
// 편집 모드는 사용자 결정(2026-09-23 "편집해도 표 폭 유지")으로 정본과 달리 패널 폭에 고정한다:
// table-layout:fixed + editWidth(%) + 좌우 8px. 1639 창(패널 1013, 세로 스크롤바 시 998)에서
// 가로 스크롤 없이 처리 버튼 4개·날짜·드롭다운 라벨이 잘리지 않게 실측으로 나눈 값이다.
const COLUMNS = [
  { key: "action", label: "처리", minWidth: 150, editWidth: "17.7%" },
  { key: "period", label: "년 월", minWidth: 78, editWidth: "7.5%" },
  { key: "charged", label: "당월계", minWidth: 86, editWidth: "8%", numeric: true },
  { key: "lateFee", label: "연체", minWidth: 70, editWidth: "5.8%", numeric: true },
  { key: "amount", label: "수납액", minWidth: 86, editWidth: "8%", numeric: true },
  { key: "fee", label: "수료", minWidth: 56, editWidth: "6.1%", numeric: true },
  { key: "paidAt", label: "수납일자", minWidth: 92, editWidth: "9.3%" },
  { key: "method", label: "은행", minWidth: 96, editWidth: "10.5%" },
  { key: "kind", label: "구분", minWidth: 60, editWidth: "8.1%" },
  { key: "memo", label: "비고", minWidth: 120, editWidth: "9.9%" },
  { key: "dueDate", label: "기한", minWidth: 80, editWidth: "9.1%" },
] as const;

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));
const KIND_OPTIONS = (Object.keys(PAYMENT_KIND_LABEL) as PaymentKind[]).map((value) => ({
  value,
  label: PAYMENT_KIND_LABEL[value],
}));

const TH_BASE =
  "sticky top-0 z-[2] whitespace-nowrap border-b border-line bg-[#FBFCFD] py-[11px] text-[12px] font-bold text-t3";
// 셀 색은 칸마다 하나만 준다(베이스에 두고 덧붙이면 CSS 생성 순서가 이긴다).
const TD_BASE = "whitespace-nowrap border-b border-line2 py-[12px] text-[13.5px] font-normal";
const TD_VIEW_PAD = "px-[16px]";
const TD_EDIT_PAD = "overflow-hidden text-ellipsis px-[8px]";
// 정본 `.uc-mini` — 색·굵기·패딩은 변형마다 한 벌씩(겹치면 CSS 생성 순서가 이긴다).
const MINI_BASE =
  "inline-flex h-[26px] items-center justify-center gap-[5px] rounded-[8px] border text-[11.5px] leading-[normal] disabled:cursor-not-allowed";
const MINI_BUTTON_CLASS =
  `${MINI_BASE} border-line bg-surface px-[10px] font-bold text-t2 hover:border-[#C9D0D8] hover:bg-[#F7F9FA] disabled:opacity-50`;
const MINI_PRI_CLASS = `${MINI_BASE} border-teal bg-teal px-[10px] font-bold text-white hover:bg-teal-d disabled:opacity-50`;
const MINI_X_CLASS =
  "inline-flex size-[26px] items-center justify-center rounded-[8px] border border-line bg-surface p-0 text-t3 hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2";
// 처리 칸 버튼: 정본 `#rcHistBody td *{font-weight:400!important}` + `.rc-ab2{margin-right:3px}`.
// 좌우 패딩은 편집 폭 유지를 위해 정본 10px → 6px.
const ACT_BASE = `${MINI_BASE} mr-[3px] px-[6px] font-normal`;
const ACT_CLASS = `${ACT_BASE} border-line bg-surface text-t2 hover:border-[#C9D0D8] hover:bg-[#F7F9FA] disabled:opacity-50`;
const ACT_PRI_CLASS = `${ACT_BASE} border-teal bg-teal text-white hover:bg-teal-d disabled:opacity-50`;
const ACT_DEL_CLASS = `${ACT_BASE} border-red-t bg-surface text-red hover:border-[#C9D0D8] hover:bg-[#F7F9FA] disabled:opacity-50`;

interface FooterPeriodRow {
  period: string;
  unpaidPrincipal: number;
  lateFee: number;
  total: number;
}

function slashDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", "/") : "-";
}

function dotDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "-";
}

function NumericField({
  value,
  ariaLabel,
  disabled,
  autoFocus,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      size="26"
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value}
      autoFocus={autoFocus}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^0-9]/g, "");
        onChange(raw ? Number(raw).toLocaleString("ko-KR") : "");
      }}
      className="text-right num"
    />
  );
}

export function PaymentHistorySection({
  orgId,
  buildingId,
  buildingName,
  buildingAddress,
  hasUnit,
  isLoading,
  payments,
  historySummaries,
  summary,
  period,
  unitId,
  canEdit,
  canSendMessages,
}: {
  orgId: number;
  buildingId: number | null;
  buildingName: string;
  buildingAddress: string | null;
  hasUnit: boolean;
  isLoading: boolean;
  payments: HistoryPayment[];
  historySummaries?: ReceiptStatementPaymentRow[];
  summary: ReceiptPaymentRow | undefined;
  period: string;
  unitId: number | null;
  canEdit: boolean;
  canSendMessages: boolean;
}) {
  const queryClient = useQueryClient();
  const record = useRecordPayment();
  const recordEdit = useRecordPaymentEdit();
  const cancel = useCancelPayment();
  const { data: lateFeeRateTiers = [] } = useLateFeeRateTiers(hasUnit ? orgId : null);
  const { data: setupConfig } = useSetupConfig(hasUnit ? orgId : undefined);
  const draftId = useRef(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draftRows, setDraftRows] = useState<HistoryDisplayRow[]>([]);
  const [focusRowKey, setFocusRowKey] = useState<string | null>(null);

  const tiers = useMemo<RateTier[]>(
    () => lateFeeRateTiers.map((tier) => ({
      fromMonth: tier.fromMonth,
      toMonth: tier.toMonth,
      monthlyRate: tier.monthlyRate,
    })),
    [lateFeeRateTiers],
  );
  const historyRows = useMemo(
    () => buildHistoryRows(payments, historySummaries, summary, period, tiers),
    [historySummaries, payments, period, summary, tiers],
  );
  const visibleRows = isEditing && canEdit ? draftRows : historyRows;
  const isPaymentSavePending = record.isPending || recordEdit.isPending;
  const isPaymentMutationPending = isPaymentSavePending || cancel.isPending;

  const refreshSummary = async () => {
    const invalidations = [
      queryClient.invalidateQueries({
        queryKey: receiptKeys.workspace(orgId, period),
        exact: true,
      }),
    ];
    if (buildingId !== null && unitId !== null) {
      invalidations.push(queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (
            key[0] !== receiptKeys.all[0]
            || key[1] !== "statement"
            || key[2] !== buildingId
          ) {
            return false;
          }
          const scope = key[3];
          const startPeriod = key[4];
          const endPeriod = key[5];
          return (scope === "building" || scope === unitId)
            && typeof startPeriod === "string"
            && typeof endPeriod === "string"
            && startPeriod <= period
            && endPeriod >= period;
        },
      }));
    }
    await Promise.all(invalidations);
  };

  const createAddedRow = (): HistoryDisplayRow => {
    draftId.current += 1;
    return {
      key: `draft-${draftId.current}`,
      rowPeriod: period,
      rowSummary: undefined,
      dueDate: summary?.dueDate ?? null,
      payment: null,
      fields: emptyFields(),
      originalFields: null,
      lateFee: 0,
      draftSource: "added",
      lateOnly: false,
      cancelRequested: false,
      cancelCompleted: false,
      saved: false,
    };
  };

  const openAdd = () => {
    if (!hasUnit || unitId === null) {
      toast.warning("호실을 선택해 주세요");
      return;
    }
    const row = createAddedRow();
    setFocusRowKey(row.key);
    if (isEditing && canEdit) {
      setDraftRows((current) => [row, ...current]);
      return;
    }
    setDraftRows([row, ...cloneRows(historyRows)]);
    setIsEditing(true);
  };

  const openEdit = () => {
    if (historyRows.length === 0) return;
    setFocusRowKey(null);
    setDraftRows(cloneRows(historyRows));
    setIsEditing(true);
  };

  const closeEditor = () => {
    setDraftRows([]);
    setFocusRowKey(null);
    setIsEditing(false);
  };

  const updateRow = (key: string, update: (row: HistoryDisplayRow) => HistoryDisplayRow) => {
    setDraftRows((current) => current.map((row) => (row.key === key ? update(row) : row)));
  };

  const applyAction = (key: string, action: "full" | "principal" | "split") => {
    const row = draftRows.find((candidate) => candidate.key === key);
    if (!row || row.cancelRequested || row.cancelCompleted || row.payment?.status === "canceled") return;

    const unpaidPrincipal = Math.max(row.rowSummary?.unpaid ?? 0, 0);
    const balance = unpaidPrincipal + row.lateFee;
    if (action === "split") {
      if (row.lateFee <= 0) return;
      draftId.current += 1;
      const splitRow: HistoryDisplayRow = {
        key: `draft-${draftId.current}`,
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
        draftSource: "split",
        lateOnly: true,
        cancelRequested: false,
        cancelCompleted: false,
        saved: false,
      };
      setDraftRows((current) => {
        const index = current.findIndex((candidate) => candidate.key === key);
        if (index < 0) return current;
        const next = [...current];
        next[index] = { ...next[index], lateFee: 0 };
        next.splice(index, 0, splitRow);
        return next;
      });
      toast.success("연체료를 새 행으로 이전했어요");
      return;
    }

    // 기존 수납 행이면 그 수납액에 남은 금액을 더한다(record_payment_edit 가 이 행을 새 금액으로
    // 다시 기록하므로, 잔액만 넣으면 이미 낸 금액이 사라진다). 요약 행은 기존 금액이 0 이다.
    const existingAmount = row.payment?.status === "active" ? row.payment.amount : 0;
    updateRow(key, (current) => ({
      ...current,
      fields: {
        ...current.fields,
        amount: formatInputNumber(existingAmount + (action === "full" ? balance : unpaidPrincipal)),
        paidAt: todayInput(),
        kind: current.lateOnly ? "partial" : action === "full" ? "full" : "principal",
        memo: current.lateOnly ? "연체료 이전" : action === "full" ? "" : "연체료 미수납",
      },
      draftSource: current.payment ? current.draftSource : current.draftSource === "none" ? "summary" : current.draftSource,
      saved: false,
    }));
    toast.success(action === "full" ? "전액 수납 처리했어요" : "당월계를 수납 처리했어요");
  };

  const removeOrReserve = (key: string) => {
    const row = draftRows.find((candidate) => candidate.key === key);
    if (!row || row.cancelCompleted || row.payment?.status === "canceled") return;
    if (row.draftSource === "added" || row.draftSource === "split") {
      setDraftRows((current) => current.filter((candidate) => candidate.key !== key));
      return;
    }
    if (row.draftSource === "summary") {
      updateRow(key, (current) => ({
        ...current,
        fields: emptyFields(),
        draftSource: "none",
        saved: false,
      }));
      return;
    }
    if (row.payment?.status === "active") {
      updateRow(key, (current) => ({ ...current, cancelRequested: !current.cancelRequested }));
    }
  };

  const updateFields = (key: string, patch: Partial<PaymentFields>) => {
    updateRow(key, (row) => ({ ...row, fields: { ...row.fields, ...patch }, saved: false }));
  };

  const save = async () => {
    if (unitId === null) return;

    for (const row of draftRows) {
      const isCanceled = row.cancelRequested
        || row.cancelCompleted
        || row.payment?.status === "canceled";
      const needsNewRecord = isNewDraft(row) && !row.saved;
      const needsEdit = Boolean(
        row.payment
        && row.payment.status === "active"
        && !row.cancelRequested
        && !row.cancelCompleted
        && !row.saved
        && row.originalFields
        && !fieldsEqual(row.fields, row.originalFields),
      );
      if (isCanceled || (!needsNewRecord && !needsEdit)) continue;
      if (needsEdit && normalizeAmount(row.fields.amount) <= 0) {
        toast.warning("수납액을 올바르게 입력해 주세요");
        return;
      }
    }

    const successfulKeys = new Set<string>();
    let addedCount = 0;
    try {
      for (const row of draftRows) {
        if (
          row.cancelRequested
          && row.payment?.status === "active"
          && !row.cancelCompleted
        ) {
          await cancel.mutateAsync(row.payment.id);
          successfulKeys.add(row.key);
          continue;
        }

        const amount = normalizeAmount(row.fields.amount);
        if (isNewDraft(row) && !row.saved) {
          if (amount <= 0) continue;
          await record.mutateAsync({
            unitId,
            period: row.rowPeriod,
            amount,
            fee: normalizeAmount(row.fields.fee),
            method: row.fields.method,
            kind: row.fields.kind,
            paidAt: row.fields.paidAt || null,
            memo: row.fields.memo || null,
          });
          addedCount += 1;
          successfulKeys.add(row.key);
          continue;
        }

        const needsEdit = Boolean(
          row.payment
          && row.payment.status === "active"
          && !row.cancelRequested
          && !row.cancelCompleted
          && !row.saved
          && row.originalFields
          && !fieldsEqual(row.fields, row.originalFields),
        );
        if (needsEdit && row.payment) {
          await recordEdit.mutateAsync({
            oldPaymentId: row.payment.id,
            unitId,
            period: row.rowPeriod,
            amount,
            fee: normalizeAmount(row.fields.fee),
            method: row.fields.method,
            kind: row.fields.kind,
            paidAt: row.fields.paidAt || null,
            memo: row.fields.memo || null,
          });
          successfulKeys.add(row.key);
        }
      }

      if (successfulKeys.size > 0) await refreshSummary();
      setIsEditing(false);
      setDraftRows([]);
      setFocusRowKey(null);
      toast.success(addedCount > 0 ? `${addedCount}건이 추가되었어요` : "수납 이력을 저장했어요");
    } catch (error) {
      setDraftRows((current) => current.map((row) => {
        if (!successfulKeys.has(row.key)) return row;
        if (row.cancelRequested && row.payment) {
          return { ...row, cancelRequested: false, cancelCompleted: true, saved: true };
        }
        return { ...row, saved: true };
      }));
      if (successfulKeys.size > 0) {
        try {
          await refreshSummary();
        } catch {
          // 성공한 변동은 이미 서버에 반영됐으므로 실패 토스트는 원래 저장 실패만 알린다.
        }
      }
      toast.error(error, "저장하지 못했어요");
    }
  };

  const footerRows = useMemo<FooterPeriodRow[]>(() => {
    const byPeriod = new Map<string, FooterPeriodRow>();
    for (const row of visibleRows) {
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
  }, [visibleRows]);
  const footerTotals = footerRows.reduce(
    (totals, row) => ({
      unpaid: totals.unpaid + row.unpaidPrincipal,
      lateFee: totals.lateFee + row.lateFee,
      total: totals.total + row.total,
    }),
    { unpaid: 0, lateFee: 0, total: 0 },
  );

  const sendUnpaidSms = () => {
    if (!summary) return;
    if (!canSendMessages) {
      toast.warning("문자 발송 권한이 필요해요");
      return;
    }
    if (!summary.phone) {
      toast.warning("등록된 입주자 연락처가 없어요");
      return;
    }

    const lines = [
      [buildingName, unitLabel(summary)].filter(Boolean).join(" "),
      buildingAddress ?? "",
      "",
      ...footerRows.map((row) => `${toMonthInput(row.period)}분  ${formatCurrency(row.total)}원`),
      "",
      `합계  ${formatCurrency(footerTotals.total)}원`,
      "",
      "입금 부탁드립니다.",
    ];
    const settleAccount = setupConfig?.settleBank && setupConfig.settleAcct && setupConfig.settleHolder
      ? `${setupConfig.settleBank} ${setupConfig.settleAcct} (${setupConfig.settleHolder})`
      : null;
    if (settleAccount) lines.push(settleAccount);

    openMessengerWith({
      cascade: {
        type: "tenant",
        buildingId: summary.buildingId,
        unitIds: [summary.unitId],
      },
      body: lines.join("\n"),
      channel: "sms",
    });
  };

  const renderActionCell = (row: HistoryDisplayRow) => {
    const canceled = row.payment?.status === "canceled" || row.cancelCompleted;
    const disabled = isPaymentMutationPending || row.saved;
    if (canceled) return null;
    return (
      <div className="whitespace-nowrap">
        {(row.draftSource === "added" || row.draftSource === "split" || row.draftSource === "summary") && !row.saved ? (
          <button
            type="button"
            onClick={() => removeOrReserve(row.key)}
            disabled={disabled}
            className={ACT_DEL_CLASS}
          >
            삭제
          </button>
        ) : row.payment?.status === "active" ? (
          <button
            type="button"
            onClick={() => removeOrReserve(row.key)}
            disabled={isPaymentMutationPending || row.saved}
            className={row.cancelRequested ? ACT_CLASS : ACT_DEL_CLASS}
          >
            {row.cancelRequested ? "되돌리기" : "삭제"}
          </button>
        ) : null}
        {!row.cancelRequested && !row.saved && (
          <>
            <button
              type="button"
              onClick={() => applyAction(row.key, "full")}
              disabled={disabled}
              className={ACT_PRI_CLASS}
            >
              수납
            </button>
            <button
              type="button"
              onClick={() => applyAction(row.key, "principal")}
              disabled={disabled}
              className={ACT_CLASS}
            >
              원금
            </button>
            <button
              type="button"
              onClick={() => applyAction(row.key, "split")}
              disabled={disabled}
              className={ACT_CLASS}
            >
              수.연
            </button>
          </>
        )}
      </div>
    );
  };

  const renderPaymentRow = (row: HistoryDisplayRow) => {
    const canceled = row.payment?.status === "canceled" || row.cancelCompleted;
    const reserved = row.cancelRequested;
    const fieldsDisabled = canceled || reserved || row.saved || isPaymentMutationPending;
    const unpaid = Math.max(row.rowSummary?.unpaid ?? 0, 0);
    const isUnpaid = row.rowSummary ? unpaid + row.lateFee > 0 : row.lateOnly && row.lateFee > 0;
    const td = `${TD_BASE} ${isEditing ? TD_EDIT_PAD : TD_VIEW_PAD}`;
    const unpaidBar = isUnpaid ? " shadow-[inset_3px_0_0_var(--color-red)]" : "";

    return (
      <tr
        key={row.key}
        className={`leading-[normal] [&:hover>td]:bg-[#FBFCFD] ${canceled || reserved ? "opacity-50" : ""}`}
      >
        {/* 정본 `tr.unpaid>td:first-child` — 편집 모드에선 처리 칸이 첫 칸이다. */}
        {isEditing && (
          <td className={`${td} text-t1 align-middle${unpaidBar}`}>
            {renderActionCell(row)}
          </td>
        )}
        <td className={`${td} text-t1 num${isEditing ? "" : unpaidBar}`}>
          {toMonthInput(row.rowPeriod)}
        </td>
        <td className={`${td} text-right text-t1 num`} title={isEditing ? formatCurrency(row.rowSummary?.charged ?? null) : undefined}>
          {formatCurrency(row.rowSummary?.charged ?? null)}
        </td>
        <td className={`${td} text-right num ${row.lateFee > 0 ? "text-red" : "text-t1"}`}>
          {formatCurrency(row.lateFee > 0 ? row.lateFee : null)}
        </td>
        <td className={`${td} text-right text-t1 num`}>
          {isEditing && row.draftSource !== "none" ? (
            <NumericField
              value={row.fields.amount}
              ariaLabel="수납액"
              disabled={fieldsDisabled}
              autoFocus={focusRowKey === row.key}
              onChange={(amount) => updateFields(row.key, { amount })}
            />
          ) : isEditing && row.payment ? (
            formatCurrency(normalizeAmount(row.fields.amount))
          ) : formatCurrency(row.payment?.amount ?? null)}
        </td>
        <td className={`${td} text-right text-t1 num`}>
          {isEditing ? (
            <NumericField
              value={row.fields.fee}
              ariaLabel="수료"
              disabled={fieldsDisabled}
              onChange={(fee) => updateFields(row.key, { fee })}
            />
          ) : (
            formatCurrency(row.payment?.fee ?? null)
          )}
        </td>
        <td className={`${td} text-t1 num`}>
          {isEditing && row.draftSource !== "none" ? (
            <DpDatePicker
              ariaLabel="수납일자"
              value={row.fields.paidAt}
              onChange={(paidAt) => updateFields(row.key, { paidAt })}
              placeholder="날짜 선택"
              disabled={fieldsDisabled}
              displayFormatter={(value) => value.replaceAll("-", "/")}
              triggerClassName="dp-ctl flex h-[26px] cursor-pointer items-center justify-between gap-[8px] whitespace-nowrap text-[13.5px] font-normal text-t1 disabled:cursor-default disabled:opacity-50"
              triggerOpenClassName="text-t1"
            />
          ) : isEditing && row.payment ? slashDate(row.fields.paidAt) : slashDate(row.payment?.paidAt)}
        </td>
        <td className={`${td} text-t1`}>
          {isEditing ? (
            <CustomDropdown
              ariaLabel="은행/방법"
              size="cell"
              position="fixed"
              menuMinWidth={112}
              value={row.fields.method}
              options={METHOD_OPTIONS}
              disabled={fieldsDisabled}
              onChange={(method) => updateFields(row.key, { method: method as PaymentMethod })}
            />
          ) : (
            row.payment ? PAYMENT_METHOD_LABEL[row.payment.method] ?? row.payment.method : "-"
          )}
        </td>
        <td className={`${td} text-t1`}>
          {isEditing ? (
            <CustomDropdown
              ariaLabel="구분"
              size="cell"
              position="fixed"
              menuMinWidth={112}
              value={row.fields.kind}
              options={KIND_OPTIONS}
              disabled={fieldsDisabled}
              onChange={(kind) => updateFields(row.key, { kind: kind as PaymentKind })}
            />
          ) : (
            row.payment ? PAYMENT_KIND_LABEL[row.payment.kind] ?? row.payment.kind : "-"
          )}
        </td>
        <td className={`${td} text-t1`}>
          {isEditing ? (
            <Input
              size="26"
              aria-label="비고"
              value={row.fields.memo}
              disabled={fieldsDisabled}
              onChange={(event) => updateFields(row.key, { memo: event.target.value })}
            />
          ) : (
            row.payment?.memo || "-"
          )}
        </td>
        <td className={`${td} text-t1 num`}>{dotDate(row.dueDate)}</td>
      </tr>
    );
  };

  const action = canEdit ? (
    <div className="flex items-center gap-[6px]">
      <button type="button" onClick={openAdd} className={MINI_BUTTON_CLASS}>
        추가
      </button>
      {isEditing ? (
        <>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isPaymentMutationPending}
            className={MINI_PRI_CLASS}
          >
            {isPaymentSavePending ? "수납 저장 중…" : "저장"}
          </button>
          <button
            type="button"
            onClick={closeEditor}
            className={MINI_X_CLASS}
            title="취소"
            aria-label="수납 이력 편집 취소"
          >
            <CloseIcon className="size-[14px] stroke-[2.2]" aria-hidden="true" />
          </button>
        </>
      ) : (
        <button type="button" onClick={openEdit} className={MINI_BUTTON_CLASS}>
          수정
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <Panel title="수납 이력" action={action} flush className="min-h-[266px] flex-1">
      {!hasUnit ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[5px] px-[24px] py-[40px] text-center">
          <span className="mb-[4px] flex size-[54px] items-center justify-center rounded-[16px] bg-teal-t text-teal">
            <UnitCardIcon variant="receipt-history" className="size-[26px]" aria-hidden="true" />
          </span>
          <p className="text-[15px] font-bold leading-[normal] text-t1">호수를 선택해 주세요</p>
          <p className="text-[13px] leading-[1.55] text-t3">선택한 세대의 월별 수납 이력이<br />여기에 표시돼요</p>
        </div>
      ) : isLoading ? (
        <div className="flex min-h-[246px] flex-1 items-center justify-center"><Spinner label="수납 이력 불러오는 중" /></div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <table
              className={`w-full border-collapse whitespace-nowrap text-[12.5px] leading-[normal] ${
                isEditing ? "min-w-[980px] table-fixed" : "table-auto"
              }`}
            >
              {isEditing && (
                <colgroup>
                  {COLUMNS.map((column) => (
                    <col key={column.key} style={{ width: column.editWidth }} />
                  ))}
                </colgroup>
              )}
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    (column.key === "action" && !isEditing) ? null : (
                      <th
                        key={column.key}
                        style={isEditing ? undefined : { minWidth: column.minWidth }}
                        className={`${TH_BASE} ${isEditing ? "px-[8px]" : "px-[16px]"} ${"numeric" in column && column.numeric ? "text-right" : "text-left"}`}
                      >
                        {column.label}
                      </th>
                    )
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {visibleRows.map(renderPaymentRow)}
              </tbody>
            </table>
          </div>

          <div className="flex flex-none flex-wrap items-center gap-x-[10px] gap-y-[8px] border-t border-line bg-[#FBFCFD] px-[14px] py-[11px] num leading-[normal]">
            <span className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap text-[12.5px] font-medium text-t1">
              <i className="not-italic text-[12px] font-medium text-t3">미납</i>
              <b className="font-medium text-red">{formatCurrency(footerTotals.unpaid)}</b>
            </span>
            <span className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap text-[12.5px] font-medium text-t1">
              <i className="not-italic text-[12px] font-medium text-t3">연체료</i>
              <b className="font-medium text-red">{formatCurrency(footerTotals.lateFee)}</b>
            </span>
            <span className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap text-[12.5px] font-medium text-t1">
              <i className="not-italic text-[12px] font-medium text-t3">미납합계</i>
              <b className="font-medium text-red">{formatCurrency(footerTotals.total)}</b>
            </span>
            <button
              type="button"
              onClick={sendUnpaidSms}
              disabled={footerTotals.total <= 0}
              className={`${MINI_BASE} ml-auto border-teal bg-teal px-[10px] font-bold text-white hover:bg-teal-d disabled:pointer-events-none disabled:opacity-40`}
            >
              문자 전송
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
