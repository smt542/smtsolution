"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/common";
import type { PointReservation } from "@/hooks/reactquery/platform";

interface ReservationReleaseModalProps {
  reservation: PointReservation;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  isPending: boolean;
}

export function ReservationReleaseModal({
  reservation,
  onClose,
  onSubmit,
  isPending,
}: ReservationReleaseModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal open onClose={onClose} title="메시지 포인트 예약 수동 해제">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          공급자 상태를 확인한 뒤에만 해제하세요. 해제 후에는 이 예약이 가용 잔액에 다시 포함됩니다.
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-bg p-3 text-xs">
          <div><dt className="text-t3">조직</dt><dd className="font-bold text-t1">{reservation.organizationName}</dd></div>
          <div><dt className="text-t3">예약 포인트</dt><dd className="font-bold text-t1">{reservation.reservedPoints.toLocaleString("ko-KR")} P</dd></div>
        </dl>
        <label>
          <span className="mb-1 block text-xs font-semibold text-t3">해제 사유</span>
          <Input
            aria-label="예약 해제 사유"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 공급자 미접수 확인"
          />
        </label>
        <label className="flex items-start gap-2 text-xs font-semibold text-t2">
          <input
            aria-label="공급자 상태 확인"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          공급자에서 실제 발송·과금되지 않았음을 확인했습니다.
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending || !confirmed || !reason.trim()}
            onClick={() => void onSubmit(reason)}
          >
            {isPending ? "해제 중…" : "예약 해제"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
