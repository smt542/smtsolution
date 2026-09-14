"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CustomDropdown, Panel, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon, CloseIcon, UnitCardIcon } from "@/components/icons";
import { useCancelPayment, useRecordPayment, useRecordPaymentEdit } from "@/hooks/reactquery/payments";
import type { PaymentKind, PaymentMethod, UnitPayment } from "@/hooks/reactquery/payments";
import {
  receiptKeys,
  type ReceiptPaymentRow,
  type ReceiptStatementPaymentRow,
} from "@/hooks/reactquery/receipts";
import { toMonthInput } from "@/lib/billing/period";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  formatCurrency,
  unitLabel,
} from "../receiptFormat";

const COLS = [
  "년 월",
  "당월계",
  "연체",
  "수납액",
  "수료",
  "수납일자",
  "은행",
  "구분",
  "비고",
  "기한",
];

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));
const KIND_OPTIONS = (Object.keys(PAYMENT_KIND_LABEL) as PaymentKind[]).map((value) => ({
  value,
  label: PAYMENT_KIND_LABEL[value],
}));

interface PayForm {
  amount: string;
  fee: string;
  method: PaymentMethod;
  kind: PaymentKind;
  paidAt: string;
  memo: string;
}

type HistoryPayment = UnitPayment & { period?: string };
interface HistoryDisplayRow {
  key: string;
  rowPeriod: string;
  rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined;
  payment: HistoryPayment | null;
}

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slashDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", "/") : "-";
}

function dotDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "-";
}

function emptyForm(): PayForm {
  return { amount: "", fee: "0", method: "transfer", kind: "full", paidAt: todayInput(), memo: "" };
}

export function PaymentHistorySection({
  orgId,
  buildingId,
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
  const qc = useQueryClient();
  const record = useRecordPayment();
  const recordEdit = useRecordPaymentEdit();
  const cancel = useCancelPayment();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [form, setForm] = useState<PayForm>(emptyForm);
  const [messagingPreset, setMessagingPreset] = useState<MessagingPreset | null>(null);

  const ym = toMonthInput(period);
  const unpaid = summary?.unpaid ?? null;
  const overduePrincipal = Math.max(summary?.overdueAmount ?? 0, unpaid ?? 0);
  const lateFeeTotal = 0;
  const historyRows: HistoryDisplayRow[] = (() => {
    const summaries = historySummaries?.length
      ? [...historySummaries].sort((a, b) => b.period.localeCompare(a.period))
      : [];
    if (summaries.length === 0) {
      if (payments.length === 0) {
        return [{ key: `empty-${period}`, rowPeriod: period, rowSummary: summary, payment: null }];
      }
      return payments.map((payment, index) => ({
        key: `payment-${payment.id}`,
        rowPeriod: payment.period ?? period,
        rowSummary: index === 0 ? summary : undefined,
        payment,
      }));
    }

    const rows: HistoryDisplayRow[] = [];
    for (const rowSummary of summaries) {
      const periodPayments = payments.filter(
        (payment) => (payment.period ?? period) === rowSummary.period,
      );
      if (periodPayments.length === 0) {
        rows.push({
          key: `summary-${rowSummary.period}`,
          rowPeriod: rowSummary.period,
          rowSummary,
          payment: null,
        });
        continue;
      }
      periodPayments.forEach((payment, index) => {
        rows.push({
          key: `payment-${payment.id}`,
          rowPeriod: rowSummary.period,
          rowSummary: index === 0 ? rowSummary : undefined,
          payment,
        });
      });
    }
    return rows;
  })();

  const refreshSummary = async () => {
    const invalidations = [
      qc.invalidateQueries({
        queryKey: receiptKeys.workspace(orgId, period),
        exact: true,
      }),
    ];
    if (buildingId !== null && unitId !== null) {
      invalidations.push(qc.invalidateQueries({
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

  const openAdd = () => {
    if (!hasUnit || unitId === null) {
      toast.info("건물과 호수를 먼저 선택해 주세요.");
      return;
    }
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };
  const openEdit = (payment: UnitPayment) => {
    setEditingId(payment.id);
    setForm({
      amount: String(payment.amount),
      fee: String(payment.fee),
      method: payment.method,
      kind: payment.kind,
      paidAt: payment.paidAt.slice(0, 10),
      memo: payment.memo ?? "",
    });
    setFormOpen(true);
  };
  const openSelectedPayment = () => {
    const payment = payments.find(
      (candidate) => candidate.id === selectedPaymentId && candidate.status === "active",
    );
    if (payment) openEdit(payment);
  };

  const submit = async () => {
    if (unitId === null) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("수납액을 올바르게 입력하세요.");
      return;
    }
    // 수정 = record_payment_edit(취소+재기록 단일 트랜잭션), 추가 = record_payment.
    const isEdit = editingId !== null;
    const payload = {
      unitId,
      period,
      amount,
      fee: Number(form.fee) || 0,
      method: form.method,
      kind: form.kind,
      paidAt: form.paidAt || null,
      memo: form.memo || null,
    };
    try {
      if (isEdit) {
        await recordEdit.mutateAsync({ ...payload, oldPaymentId: editingId });
      } else {
        await record.mutateAsync(payload);
      }
      await refreshSummary();
      toast.success(isEdit ? "수납 내역을 수정했습니다." : "수납 내역을 추가했습니다.");
      setFormOpen(false);
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const cancelRow = async (payment: UnitPayment) => {
    try {
      await cancel.mutateAsync(payment.id);
      await refreshSummary();
      toast.success("수납 내역을 취소했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "취소에 실패했습니다.");
    }
  };
  const cancelEditingPayment = async () => {
    const payment = payments.find((candidate) => candidate.id === editingId);
    if (!payment) return;
    await cancelRow(payment);
    setFormOpen(false);
    setEditingId(null);
    setSelectedPaymentId(null);
  };

  const closeEditor = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const sendUnpaidSms = () => {
    if (!summary) return;
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (!summary.phone) {
      toast.info("등록된 입주자 연락처가 없습니다.");
      return;
    }
    setMessagingPreset({
      context: "미납 안내",
      channel: "sms",
      body: `${summary.tenantName ?? "입주자"}님, ${ym} 관리비 미납 안내입니다. 미납금액 ${formatCurrency(unpaid)}원, 납기일 ${summary.dueDate ?? "미정"}입니다.`,
      recipients: [
        {
          name: summary.tenantName,
          phone: summary.phone,
          unitNo: unitLabel(summary),
          kind: "tenant",
          ref: { occupancyId: summary.occupancyId ?? undefined, buildingId: summary.buildingId },
        },
      ],
    });
  };

  const miniButtonClass =
    "h-[26px] rounded-[8px] border border-line bg-surface px-[10px] text-[11.5px] font-bold leading-[normal] text-t2 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50";
  const action = canEdit ? (
    <div className="flex items-center gap-[6px]">
      <button type="button" onClick={openAdd} className={miniButtonClass}>
        추가
      </button>
      {formOpen ? (
        <>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={record.isPending || recordEdit.isPending || cancel.isPending}
            className={`${miniButtonClass} border-teal bg-teal text-white hover:bg-teal`}
          >
            저장
          </button>
          <button
            type="button"
            onClick={closeEditor}
            className="flex size-[26px] items-center justify-center rounded-[8px] border border-line bg-surface text-t3 hover:bg-bg"
            title="취소"
            aria-label="수납 이력 편집 취소"
          >
            <CloseIcon className="size-[14px]" aria-hidden="true" />
          </button>
        </>
      ) : (
        <button type="button" onClick={openSelectedPayment} className={miniButtonClass}>
          수정
        </button>
      )}
    </div>
  ) : undefined;

  const renderInlineEditor = ({
    key,
    rowPeriod,
    rowSummary,
  }: {
    key: string;
    rowPeriod: string;
    rowSummary: ReceiptStatementPaymentRow | ReceiptPaymentRow | undefined;
  }) => {
    const suggestedAmount = (rowSummary?.unpaid ?? 0) > 0
      ? rowSummary?.unpaid ?? 0
      : rowSummary?.charged ?? 0;
    const shortcut = (kind: PaymentKind, amount = suggestedAmount) => {
      setForm((previous) => ({
        ...previous,
        kind,
        amount: amount > 0 ? String(amount) : previous.amount,
      }));
    };
    const fieldClass =
      "h-[26px] rounded-[7px] border border-line bg-surface px-[7px] text-[12px] font-normal text-t1 outline-none focus:border-teal focus:ring-[3px] focus:ring-teal-t";

    return (
      <tr key={key} data-testid="payment-inline-editor" className="h-[40px] border-b border-line2 bg-teal-t2">
        <td className="whitespace-nowrap px-2 py-[6px]">
          <div className="flex items-center gap-[3px]">
            <button
              type="button"
              onClick={() => editingId !== null ? void cancelEditingPayment() : closeEditor()}
              disabled={cancel.isPending}
              className={`${miniButtonClass} border-red-t px-[8px] font-medium text-red`}
            >
              {editingId !== null ? "수납 취소" : "삭제"}
            </button>
            <button type="button" onClick={() => shortcut("full")} className={`${miniButtonClass} border-teal bg-teal px-[8px] font-medium text-white hover:bg-teal`}>
              수납
            </button>
            <button type="button" onClick={() => shortcut("principal", rowSummary?.charged ?? 0)} className={`${miniButtonClass} px-[8px] font-medium`}>
              원금
            </button>
            <button type="button" onClick={() => shortcut("partial", 0)} className={`${miniButtonClass} px-[8px] font-medium`}>
              수.연
            </button>
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-[6px] num">{toMonthInput(rowPeriod)}</td>
        <td className="px-3 py-[6px] text-right num">{formatCurrency(rowSummary?.charged ?? null)}</td>
        <td className="px-3 py-[6px] text-right text-red num">{formatCurrency(rowSummary?.unpaid ?? null)}</td>
        <td className="px-2 py-[6px] text-right">
          <input
            type="number"
            aria-label="수납액"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            className={`${fieldClass} w-[88px] text-right num`}
          />
        </td>
        <td className="px-2 py-[6px] text-right">
          <input
            type="number"
            aria-label="수수료(수료)"
            value={form.fee}
            onChange={(event) => setForm((previous) => ({ ...previous, fee: event.target.value }))}
            className={`${fieldClass} w-[76px] text-right num`}
          />
        </td>
        <td className="px-2 py-[6px]">
          <DpDatePicker
            ariaLabel="수납일자"
            value={form.paidAt}
            onChange={(paidAt) => setForm((previous) => ({ ...previous, paidAt }))}
            placeholder="날짜 선택"
            triggerClassName={`${fieldClass} flex w-[124px] cursor-pointer items-center justify-between gap-[6px] whitespace-nowrap num`}
            triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
            endAdornment={<CalendarIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
          />
        </td>
        <td className="px-2 py-[6px]">
          <div className="w-[104px] [&_.uc-dd]:w-full [&_.uc-dd-btn]:h-[26px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:gap-[5px] [&_.uc-dd-btn]:rounded-[7px] [&_.uc-dd-btn]:px-[7px] [&_.uc-dd-btn]:text-[12px] [&_.uc-dd-btn]:font-normal [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:min-w-[120px]">
            <CustomDropdown
              ariaLabel="은행/방법"
              value={form.method}
              onChange={(method) => setForm((previous) => ({ ...previous, method: method as PaymentMethod }))}
              options={METHOD_OPTIONS}
            />
          </div>
        </td>
        <td className="px-2 py-[6px]">
          <div className="w-[76px] [&_.uc-dd]:w-full [&_.uc-dd-btn]:h-[26px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:gap-[5px] [&_.uc-dd-btn]:rounded-[7px] [&_.uc-dd-btn]:px-[7px] [&_.uc-dd-btn]:text-[12px] [&_.uc-dd-btn]:font-normal [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:min-w-[96px]">
            <CustomDropdown
              ariaLabel="구분"
              value={form.kind}
              onChange={(kind) => setForm((previous) => ({ ...previous, kind: kind as PaymentKind }))}
              options={KIND_OPTIONS}
            />
          </div>
        </td>
        <td className="px-2 py-[6px]">
          <input
            aria-label="비고"
            value={form.memo}
            onChange={(event) => setForm((previous) => ({ ...previous, memo: event.target.value }))}
            className={`${fieldClass} w-[110px]`}
          />
        </td>
        <td className="whitespace-nowrap px-3 py-[6px] num">{dotDate(rowSummary?.dueDate ?? null)}</td>
      </tr>
    );
  };

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
        <div className="flex min-h-[246px] flex-1 items-center justify-center"><Spinner /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${formOpen ? "min-w-[1120px]" : "min-w-[920px]"}`}>
              <thead>
                <tr className="border-b border-[#e8ebee] bg-[#fbfcfd] text-[12px] font-bold leading-[normal] text-[#8b95a1]">
                  {formOpen && <th className="min-w-[190px] whitespace-nowrap px-[16px] py-[11px]">처리</th>}
                  {COLS.map((col) => (
                    <th key={col} className={`whitespace-nowrap px-[16px] py-[11px] ${["당월계","연체","수납액","수료"].includes(col) ? "text-right" : "text-left"}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {formOpen && editingId === null && renderInlineEditor({
                  key: "new-payment",
                  rowPeriod: period,
                  rowSummary: summary,
                })}
                {historyRows.map(({ key, rowPeriod, rowSummary, payment }) => {
                  const canceled = payment?.status === "canceled";
                  const isUnpaid = !payment || canceled;
                  if (formOpen && payment?.id === editingId) {
                    return renderInlineEditor({
                      key,
                      rowPeriod,
                      rowSummary: rowSummary ?? (rowPeriod === period ? summary : undefined),
                    });
                  }
                  return (
                    <tr
                      key={key}
                      onClick={() => payment && setSelectedPaymentId(payment.id)}
                      className={`border-b border-[#f1f3f5] last:border-0 ${
                        payment ? "cursor-pointer" : ""
                      } ${selectedPaymentId === payment?.id ? "bg-teal-t" : ""} ${canceled ? "opacity-50" : ""}`}
                    >
                      {formOpen && <td className="px-[16px] py-[12px]" />}
                      <td className={`px-[16px] py-[12px] num ${isUnpaid ? "shadow-[inset_3px_0px_0px_0px_#f04452]" : ""}`}>{toMonthInput(rowPeriod)}</td>
                      <td className="px-[16px] py-[12px] text-right num">{formatCurrency(rowSummary?.charged ?? null)}</td>
                      <td className={`px-[16px] py-[12px] text-right num ${(rowSummary?.unpaid ?? 0) > 0 ? "text-[#f04452]" : ""}`}>{formatCurrency(rowSummary?.unpaid ?? null)}</td>
                      <td className="px-[16px] py-[12px] text-right num">{payment ? formatCurrency(payment.amount) : "-"}</td>
                      <td className="px-[16px] py-[12px] text-right num">{payment ? formatCurrency(payment.fee) : "-"}</td>
                      <td className="whitespace-nowrap px-[16px] py-[12px]">{payment ? slashDate(payment.paidAt) : "-"}</td>
                      <td className="px-[16px] py-[12px]">{payment ? PAYMENT_METHOD_LABEL[payment.method] ?? payment.method : "-"}</td>
                      <td className="px-[16px] py-[12px]">{payment ? PAYMENT_KIND_LABEL[payment.kind] ?? payment.kind : "-"}</td>
                      <td className="px-[16px] py-[12px]">{payment?.memo ?? "-"}</td>
                      <td className="whitespace-nowrap px-[16px] py-[12px]">{dotDate(rowSummary?.dueDate ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-[10px] border-t border-[#e8ebee] bg-[#fbfcfd] px-[14px] py-[11px]">
            <div className="flex items-center gap-[6px]">
              <span className="text-[12px] font-medium leading-[normal] text-[#8b95a1]">미납</span>
              <span className="num text-[12.5px] font-medium leading-[normal] text-[#f04452]">{formatCurrency(overduePrincipal)}</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <span className="text-[12px] font-medium leading-[normal] text-[#8b95a1]">연체료</span>
              <span className="num text-[12.5px] font-medium leading-[normal] text-[#f04452]">{formatCurrency(lateFeeTotal)}</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <span className="text-[12px] font-medium leading-[normal] text-[#8b95a1]">미납합계</span>
              <span className="num text-[12.5px] font-medium leading-[normal] text-[#f04452]">{formatCurrency(overduePrincipal + lateFeeTotal)}</span>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={sendUnpaidSms}
                disabled={!summary || (unpaid ?? 0) <= 0}
                className="h-[26px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold leading-[normal] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                문자 전송
              </button>
            </div>
          </div>
        </>
      )}

      {messagingPreset && (
        <MessagingModal
          open
          preset={messagingPreset}
          onClose={() => setMessagingPreset(null)}
          onSent={(result) => {
            toast.success(`문자가 발송되었습니다. (성공 ${result.count}건)`);
            setMessagingPreset(null);
          }}
        />
      )}
    </Panel>
  );
}
