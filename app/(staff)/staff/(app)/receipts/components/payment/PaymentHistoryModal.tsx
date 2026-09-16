"use client";

import { Badge, Button, EmptyState, Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  useUnitPayments,
  type UnitPayment,
} from "@/hooks/reactquery/payments";
import { formatWon } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import { KIND_LABEL, METHOD_LABEL } from "./constants";

interface PaymentHistoryModalProps {
  open: boolean;
  unitId: number;
  period: string;
  isPending: boolean;
  onClose: () => void;
  onCancel: (paymentId: number) => void;
  onReceipt: (payment: UnitPayment) => void;
}

export function PaymentHistoryModal({
  open,
  unitId,
  period,
  isPending,
  onClose,
  onCancel,
  onReceipt,
}: PaymentHistoryModalProps) {
  const confirm = useConfirm();
  const { data: payments = [], isLoading } = useUnitPayments(unitId, period);

  const handleCancel = async (payment: UnitPayment) => {
    const ok = await confirm({
      title: "수납 취소",
      description: "이 수납 내역을 취소하시겠습니까?",
      confirmLabel: "수납 취소",
      cancelLabel: "닫기",
      variant: "danger",
    });
    if (ok) onCancel(payment.id);
  };

  return (
    <ComplaintDialog open={open} onClose={onClose} title="수납 이력" size="medium">
      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Spinner />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState message="등록된 수납 이력이 없습니다" />
      ) : (
        <ul className="space-y-3">
          {payments.map((payment: UnitPayment) => {
            const canceled = payment.status === "canceled";

            return (
              <li
                key={payment.id}
                className={`rounded-xl border border-line p-4 ${canceled ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="num text-lg font-extrabold text-t1">
                        {formatWon(payment.amount)}
                      </p>
                      <Badge className="bg-bg px-2.5 py-1 text-t2">
                        {KIND_LABEL[payment.kind]}
                      </Badge>
                      {canceled && (
                        <Badge tone="red" className="px-2.5 py-1">
                          취소됨
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-t2">
                      {METHOD_LABEL[payment.method]} · {payment.paidAt}
                    </p>
                    {payment.memo && (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-t3">
                        {payment.memo}
                      </p>
                    )}
                  </div>
                  {!canceled && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-3 text-xs"
                        onClick={() => onReceipt(payment)}
                      >
                        영수증
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-3 text-xs"
                        disabled={isPending}
                        onClick={() => handleCancel(payment)}
                      >
                        {isPending ? "수납 취소 중…" : "취소"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex justify-end border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </ComplaintDialog>
  );
}
