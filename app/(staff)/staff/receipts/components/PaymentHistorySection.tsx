"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Input, Modal, Panel, Select, Spinner } from "@/components/common";
import { useCancelPayment, useRecordPayment } from "@/hooks/reactquery/payments";
import type { PaymentKind, PaymentMethod, UnitPayment } from "@/hooks/reactquery/payments";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import { toMonthInput } from "@/lib/billing/period";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  formatCurrency,
  formatDate,
  unitLabel,
} from "../receiptFormat";

const COLS = [
  "처리",
  "년월",
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

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm(): PayForm {
  return { amount: "", fee: "0", method: "transfer", kind: "full", paidAt: todayInput(), memo: "" };
}

export function PaymentHistorySection({
  hasUnit,
  isLoading,
  payments,
  summary,
  period,
  unitId,
  canEdit,
  canSendMessages,
}: {
  hasUnit: boolean;
  isLoading: boolean;
  payments: UnitPayment[];
  summary: ReceiptPaymentRow | undefined;
  period: string;
  unitId: number | null;
  canEdit: boolean;
  canSendMessages: boolean;
}) {
  const qc = useQueryClient();
  const record = useRecordPayment();
  const cancel = useCancelPayment();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PayForm>(emptyForm);
  const [messagingPreset, setMessagingPreset] = useState<MessagingPreset | null>(null);

  const ym = toMonthInput(period);
  const active = payments.filter((p) => p.status === "active");
  const paidTotal = active.reduce((sum, p) => sum + p.amount, 0);
  const unpaid = summary?.unpaid ?? null;

  const refreshSummary = () => qc.invalidateQueries({ queryKey: ["receipts"] });

  const openAdd = () => {
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

  const submit = async () => {
    if (unitId === null) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("수납액을 올바르게 입력하세요.");
      return;
    }
    // 수정 = 기존 취소 + 재기록 (payments엔 update 경로가 없음). 취소·재기록을 분리 처리해
    // 취소만 성공하고 재기록이 실패한 경우 운영자가 상황을 명확히 알 수 있게 한다.
    const isEdit = editingId !== null;
    if (isEdit) {
      try {
        await cancel.mutateAsync(editingId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "기존 수납 취소에 실패했습니다.");
        return;
      }
    }
    try {
      await record.mutateAsync({
        unitId,
        period,
        amount,
        fee: Number(form.fee) || 0,
        method: form.method,
        kind: form.kind,
        paidAt: form.paidAt || null,
        memo: form.memo || null,
      });
    } catch (error) {
      await refreshSummary();
      toast.error(
        isEdit
          ? "기존 수납은 취소되었으나 재기록에 실패했습니다. ‘수납 추가’로 다시 입력해 주세요."
          : error instanceof Error
            ? error.message
            : "저장에 실패했습니다.",
      );
      return;
    }
    await refreshSummary();
    toast.success(isEdit ? "수납 내역을 수정했습니다." : "수납 내역을 추가했습니다.");
    setFormOpen(false);
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
      body: `${summary.tenantName ?? "입주자"}님, ${ym} 관리비 미납 안내입니다. 미납금액 ${formatCurrency(unpaid)}, 납기일 ${summary.dueDate ?? "미정"}입니다.`,
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

  const action =
    canEdit && hasUnit ? (
      <Button type="button" onClick={openAdd}>
        + 수납 추가
      </Button>
    ) : undefined;

  return (
    <Panel title="수납 이력" action={action}>
      {!hasUnit ? (
        <p className="py-10 text-center text-sm text-t4">호수를 선택해 주세요</p>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
                  {COLS.map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-t3">-</td>
                    <td className="px-3 py-3 num">{ym}</td>
                    <td className="px-3 py-3 text-right num">{formatCurrency(summary?.charged ?? null)}</td>
                    <td className="px-3 py-3 text-right text-red num">{formatCurrency(unpaid)}</td>
                    <td className="px-3 py-3 text-right num">-</td>
                    <td className="px-3 py-3 text-right num">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDate(summary?.dueDate ?? null)}</td>
                  </tr>
                ) : (
                  payments.map((payment, index) => {
                    const canceled = payment.status === "canceled";
                    return (
                      <tr
                        key={payment.id}
                        className={`border-b border-line last:border-0 ${canceled ? "opacity-50" : ""}`}
                      >
                        <td className="whitespace-nowrap px-3 py-3">
                          {canceled ? (
                            <span className="text-xs text-t4">취소됨</span>
                          ) : canEdit ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(payment)}
                                className="rounded-md border border-line px-2 py-1 text-xs font-bold text-t2 hover:bg-bg"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelRow(payment)}
                                disabled={cancel.isPending}
                                className="rounded-md border border-line px-2 py-1 text-xs font-bold text-red hover:bg-red-t disabled:opacity-50"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-t4">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 num">{ym}</td>
                        <td className="px-3 py-3 text-right num">
                          {index === 0 ? formatCurrency(summary?.charged ?? null) : ""}
                        </td>
                        <td className="px-3 py-3 text-right text-red num">
                          {index === 0 ? formatCurrency(unpaid) : ""}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold num">{formatCurrency(payment.amount)}</td>
                        <td className="px-3 py-3 text-right num">{formatCurrency(payment.fee)}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(payment.paidAt)}</td>
                        <td className="px-3 py-3">{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</td>
                        <td className="px-3 py-3">{PAYMENT_KIND_LABEL[payment.kind] ?? payment.kind}</td>
                        <td className="px-3 py-3 text-t2">{payment.memo ?? "-"}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {index === 0 ? formatDate(summary?.dueDate ?? null) : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-4 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
            <span className="text-t3">
              수납액 합계 <b className="num text-t1">{formatCurrency(paidTotal)}</b>
            </span>
            <span className="text-t3">
              미납 <b className="num text-red">{formatCurrency(unpaid)}</b>
            </span>
            <span className="text-t3">
              미납합계 <b className="num text-red">{formatCurrency(unpaid)}</b>
            </span>
            <button
              type="button"
              onClick={sendUnpaidSms}
              disabled={!summary || (unpaid ?? 0) <= 0}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-blue hover:bg-blue-t2 disabled:cursor-not-allowed disabled:text-t4"
            >
              미납 문자 전송
            </button>
          </div>
        </>
      )}

      {formOpen && (
        <Modal
          open
          onClose={() => setFormOpen(false)}
          title={editingId !== null ? "수납 내역 수정" : "수납 내역 추가"}
          className="max-w-md"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-t3">
              수납액
              <Input
                type="number"
                className="mt-1"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>
            <label className="text-xs font-bold text-t3">
              수수료(수료)
              <Input
                type="number"
                className="mt-1"
                value={form.fee}
                onChange={(e) => setForm((p) => ({ ...p, fee: e.target.value }))}
              />
            </label>
            <label className="text-xs font-bold text-t3">
              은행/방법
              <Select
                className="mt-1"
                value={form.method}
                onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                options={METHOD_OPTIONS}
              />
            </label>
            <label className="text-xs font-bold text-t3">
              구분
              <Select
                className="mt-1"
                value={form.kind}
                onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as PaymentKind }))}
                options={KIND_OPTIONS}
              />
            </label>
            <label className="text-xs font-bold text-t3">
              수납일자
              <Input
                type="date"
                className="mt-1"
                value={form.paidAt}
                onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))}
              />
            </label>
            <label className="text-xs font-bold text-t3">
              비고
              <Input
                className="mt-1"
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              />
            </label>
          </div>
          {editingId !== null && (
            <p className="mt-3 text-xs text-t4">수정은 기존 수납을 취소하고 새로 기록합니다.</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={submit} disabled={record.isPending || cancel.isPending}>
              저장
            </Button>
          </div>
        </Modal>
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
