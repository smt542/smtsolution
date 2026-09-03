"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/common";
import type { PointReservation } from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";

interface ReservationReleaseModalProps {
  reservation: PointReservation;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  isPending: boolean;
}

const MODAL_CLASS =
  "max-w-[440px] rounded-[20px] shadow-pop [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
const INPUT_CLASS =
  "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const BUTTON_CLASS = "h-10 rounded-[11px] px-[15px] text-[13.5px]";

export function ReservationReleaseModal({
  reservation,
  onClose,
  onSubmit,
  isPending,
}: ReservationReleaseModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="메시지 포인트 예약 수동 해제"
      className={MODAL_CLASS}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] border border-red/20 bg-red-t px-4 py-3 text-[13.5px] font-semibold leading-[1.6] text-red">
          공급자 상태를 확인한 뒤에만 해제하세요. 해제 후에는 이 예약이 가용 잔액에 다시 포함됩니다.
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-[15px] bg-bg p-3">
          <div><dt className="text-xs font-bold text-t3">조직</dt><dd className="mt-1 text-[13.5px] font-extrabold text-t1">{reservation.organizationName}</dd></div>
          <div><dt className="text-xs font-bold text-t3">예약 포인트</dt><dd className="mt-1 text-[13.5px] font-extrabold text-t1 num">{formatNumber(reservation.reservedPoints)} P</dd></div>
        </dl>
        <label>
          <span className="mb-1.5 block text-[12.5px] font-bold text-t2">해제 사유</span>
          <Input
            aria-label="예약 해제 사유"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 공급자 미접수 확인"
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex items-start gap-2 text-xs font-semibold text-t2">
          <input
            aria-label="공급자 상태 확인"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-blue"
          />
          공급자에서 실제 발송·과금되지 않았음을 확인했습니다.
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className={BUTTON_CLASS}>취소</Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending || !confirmed || !reason.trim()}
            onClick={() => void onSubmit(reason)}
            className={BUTTON_CLASS}
          >
            {isPending ? "해제 중…" : "예약 해제"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
