"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CustomDropdown, Input, Panel, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CloseIcon, UnitCardIcon } from "@/components/icons";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useSavePaymentHistory, useUnitOverpaidByMonth } from "@/hooks/reactquery/payments";
import type { DepositType, PaymentMethod } from "@/hooks/reactquery/payments";
import { useOccupancies } from "@/hooks/reactquery/occupancies";
import { useLateFeeSettings, useSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  receiptKeys,
  type ReceiptLateFeeSplit,
  type ReceiptPaymentRow,
  type ReceiptStatementPaymentRow,
} from "@/hooks/reactquery/receipts";
import type { RateTier } from "@/lib/billing/lateFee";
import { toMonthInput } from "@/lib/billing/period";
import { openMessengerWith } from "@/lib/messaging/messengerHandoff";
import {
  DEPOSIT_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  POLICY_PAYMENT_METHODS,
  formatCurrency,
} from "../receiptFormat";
import {
  buildHistoryRows,
  cloneRows,
  displayLateFee,
  emptyFields,
  normalizeAmount,
  type HistoryDisplayRow,
  type HistoryPayment,
  type PaymentFields,
} from "./paymentHistoryRows";
import {
  buildAddedRow,
  buildFooterRows,
  buildPaymentHistoryOps,
  buildUnpaidSmsBody,
  fillPaymentForAction,
  isActionableRow,
  mgmtAccountLine,
  saveSuccessMessage,
  splitLateFeeRows,
  sumFooterRows,
  validateDraftRows,
} from "./paymentHistoryOps";

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

// 구분 = 수납 구분(정책: 일반·지로·이체·무통), 은행 = 입금 은행(수납: 무통장입금·지로입금).
// 처리 유형(완납·원금·분할)은 처리 버튼이 정해 저장만 한다.
const METHOD_OPTIONS = POLICY_PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));
const DEPOSIT_TYPE_OPTIONS = [
  { value: "", label: "선택 안 함" },
  ...Object.entries(DEPOSIT_TYPE_LABEL).map(([value, label]) => ({ value, label })),
];

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

// 연체료 이전(수.연) 행은 연체료만 있어 원금 수납이 없다. 저장은 연체료 미수금(0292)으로 한다.
const LATE_ONLY_PRINCIPAL_MESSAGE = "연체료 이전 행은 원금이 없어요. 수납으로 처리해 주세요";

export function PaymentHistorySection({
  orgId,
  buildingId,
  buildingName,
  buildingAddress,
  hasUnit,
  isLoading,
  payments,
  historySummaries,
  lateFeeSplits,
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
  lateFeeSplits?: ReceiptLateFeeSplit[];
  summary: ReceiptPaymentRow | undefined;
  period: string;
  unitId: number | null;
  canEdit: boolean;
  canSendMessages: boolean;
}) {
  const queryClient = useQueryClient();
  const saveHistory = useSavePaymentHistory();
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
  // 연체료는 조직 설정(사용 여부·납기후 가산율)과 입주별 연체료 부과 여부를 따른다.
  const lateFeeSettings = useLateFeeSettings(hasUnit ? orgId : null);
  const { data: unitOccupancies } = useOccupancies(hasUnit && unitId !== null ? unitId : 0);
  const lateFeeEnabledByOccupancy = useMemo(
    () => new Map((unitOccupancies ?? []).map((occupancy) => [occupancy.id, occupancy.lateFeeEnabled])),
    [unitOccupancies],
  );
  // 그 달 연체료 한도를 넘은 초과 수납은 과수납(다음 고지서 「전월과수납」 차감, QA #31).
  const overpaidByMonth = useUnitOverpaidByMonth(hasUnit ? unitId : null);
  const historyRows = useMemo(
    () => buildHistoryRows(payments, historySummaries, summary, period, tiers, {
      settings: lateFeeSettings,
      lateFeeEnabledByOccupancy,
      lateFeeSplits,
      overpaidByMonth,
    }),
    [historySummaries, lateFeeEnabledByOccupancy, lateFeeSettings, lateFeeSplits, overpaidByMonth, payments, period, summary, tiers],
  );
  const visibleRows = isEditing && canEdit ? draftRows : historyRows;
  const isPaymentMutationPending = saveHistory.isPending;

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
    return buildAddedRow(`draft-${draftId.current}`, period, summary, historyRows);
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
    if (!row || !isActionableRow(row)) return;

    if (row.lateOnly && action === "split") return;
    if (row.lateOnly && action === "principal") {
      toast.warning(LATE_ONLY_PRINCIPAL_MESSAGE);
      return;
    }

    if (action === "split") {
      if (row.lateFee <= 0) return;
      draftId.current += 1;
      const splitKey = `draft-${draftId.current}`;
      setDraftRows((current) => splitLateFeeRows(current, key, splitKey));
      toast.success("연체료를 새 행으로 이전했어요");
      return;
    }

    updateRow(key, (current) => fillPaymentForAction(current, action));
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
        fields: current.split ? { ...emptyFields(), memo: current.split.memo ?? "" } : emptyFields(),
        draftSource: "none",
        saved: false,
      }));
      return;
    }
    // 저장된 연체료 이전 행(수납 없음)은 저장 시 미수금을 취소하도록 예약한다.
    if (row.split && !row.payment) {
      updateRow(key, (current) => ({ ...current, cancelRequested: !current.cancelRequested }));
      return;
    }
    if (row.payment?.status === "active") {
      updateRow(key, (current) => ({ ...current, cancelRequested: !current.cancelRequested }));
    }
  };

  /** 삭제(취소)된 수납 되살리기 예약 토글 — 수정으로 대체된 취소 건은 대상이 아니다. */
  const toggleRestore = (key: string) => {
    const row = draftRows.find((candidate) => candidate.key === key);
    if (!row || row.payment?.status !== "canceled" || row.payment.replacedBy) return;
    updateRow(key, (current) => ({ ...current, restoreRequested: !current.restoreRequested }));
  };

  const updateBillDraft = (key: string, patch: Partial<{ charged: string; lateFee: string }>) => {
    updateRow(key, (row) => (row.billDraft ? { ...row, billDraft: { ...row.billDraft, ...patch }, saved: false } : row));
  };

  const updateFields = (key: string, patch: Partial<PaymentFields>) => {
    updateRow(key, (row) => ({ ...row, fields: { ...row.fields, ...patch }, saved: false }));
  };

  const save = async () => {
    if (unitId === null) return;

    const invalidMessage = validateDraftRows(draftRows);
    if (invalidMessage) {
      toast.warning(invalidMessage);
      return;
    }
    const ops = buildPaymentHistoryOps(draftRows, unitId);

    // 취소·추가·수정을 한 트랜잭션으로 저장한다. 하나라도 실패하면 전부 롤백되므로 초안은 그대로 둔다.
    try {
      const result = ops.length > 0 ? await saveHistory.mutateAsync(ops) : null;
      if (result) await refreshSummary();
      setIsEditing(false);
      setDraftRows([]);
      setFocusRowKey(null);
      toast.success(saveSuccessMessage(result));
    } catch (error) {
      toast.error(error, "저장하지 못했어요");
    }
  };

  const footerRows = useMemo(() => buildFooterRows(visibleRows), [visibleRows]);
  const footerTotals = sumFooterRows(footerRows);

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

    openMessengerWith({
      cascade: {
        type: "tenant",
        buildingId: summary.buildingId,
        unitIds: [summary.unitId],
      },
      body: buildUnpaidSmsBody({
        buildingName,
        buildingAddress,
        summary,
        footerRows,
        total: footerTotals.total,
        accountLine: mgmtAccountLine(setupConfig),
      }),
      channel: "sms",
    });
  };

  const renderActionCell = (row: HistoryDisplayRow) => {
    const canceled = row.payment?.status === "canceled" || row.cancelCompleted;
    const disabled = isPaymentMutationPending || row.saved;
    if (canceled) {
      // 삭제한 수납은 되살릴 수 있다(수정으로 대체된 취소 건 제외).
      if (row.payment?.status !== "canceled" || row.payment.replacedBy) return null;
      return (
        <div className="whitespace-nowrap">
          <button
            type="button"
            onClick={() => toggleRestore(row.key)}
            disabled={disabled}
            className={row.restoreRequested ? ACT_CLASS : ACT_PRI_CLASS}
          >
            {row.restoreRequested ? "되돌리기" : "되살리기"}
          </button>
        </div>
      );
    }
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
        ) : row.payment?.status === "active" || (row.split && !row.payment) ? (
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
    // 되살리기 예약한 취소 건은 음영을 걷어 저장 후 모습을 미리 보여준다.
    const dimmed = (canceled && !row.restoreRequested) || reserved;
    const unpaid = Math.max(row.rowSummary?.unpaid ?? 0, 0);
    const isUnpaid = row.rowSummary ? unpaid + row.lateFee > 0 : row.lateOnly && row.lateFee > 0;
    const td = `${TD_BASE} ${isEditing ? TD_EDIT_PAD : TD_VIEW_PAD}`;
    const unpaidBar = isUnpaid ? " shadow-[inset_3px_0_0_var(--color-red)]" : "";

    return (
      <tr
        key={row.key}
        className={`leading-[normal] [&:hover>td]:bg-row-hover ${dimmed ? "opacity-50" : ""}`}
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
          {isEditing && row.billDraft && !row.saved ? (
            <NumericField
              value={row.billDraft.charged}
              ariaLabel="당월계"
              disabled={fieldsDisabled}
              onChange={(charged) => updateBillDraft(row.key, { charged })}
            />
          ) : formatCurrency(row.rowSummary?.charged ?? null)}
        </td>
        <td className={`${td} text-right num ${row.lateFee > 0 ? "text-red" : "text-t1"}`}>
          {isEditing && row.billDraft && !row.saved ? (
            <NumericField
              value={row.billDraft.lateFee}
              ariaLabel="연체"
              disabled={fieldsDisabled}
              onChange={(lateFee) => updateBillDraft(row.key, { lateFee })}
            />
          ) : formatCurrency(displayLateFee(row) > 0 ? displayLateFee(row) : null)}
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
              chevron="accent"
              menuTransition
              ariaLabel="은행"
              size="cell"
              position="fixed"
              menuMinWidth={112}
              value={row.fields.depositType}
              options={DEPOSIT_TYPE_OPTIONS}
              disabled={fieldsDisabled}
              onChange={(depositType) => updateFields(row.key, { depositType: depositType as DepositType | "" })}
            />
          ) : (
            row.payment?.depositType ? DEPOSIT_TYPE_LABEL[row.payment.depositType] ?? "-" : "-"
          )}
        </td>
        <td className={`${td} text-t1`}>
          {isEditing ? (
            <CustomDropdown
              chevron="accent"
              menuTransition
              ariaLabel="구분"
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
            <Input
              size="26"
              aria-label="비고"
              value={row.fields.memo}
              disabled={fieldsDisabled}
              onChange={(event) => updateFields(row.key, { memo: event.target.value })}
            />
          ) : (
            // 그 달 과수납은 비고에 함께 적는다(다음 확정 고지서에서 전월과수납으로 차감, QA #31).
            [row.payment?.memo, row.overpaid ? `과수납 ${formatCurrency(row.overpaid)}` : null]
              .filter(Boolean)
              .join(" · ") || "-"
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
            저장
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
