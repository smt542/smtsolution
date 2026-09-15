"use client";
import React, { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Modal } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  useCancelMoveOutSchedule,
  useExecuteMoveOut,
  useScheduleMoveOut,
} from "@/hooks/reactquery/occupancies";

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function MoveOutControl({ occupancyId, scheduledDate, isVacant }: {
  occupancyId: number;
  scheduledDate: string | null;
  isVacant: boolean;
}) {
  const confirm = useConfirm();
  const execute = useExecuteMoveOut();
  const schedule = useScheduleMoveOut();
  const cancel = useCancelMoveOutSchedule();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ source: scheduledDate, date: scheduledDate ?? todayLocal() });
  if (draft.source !== scheduledDate) {
    setDraft({ source: scheduledDate, date: scheduledDate ?? todayLocal() });
  }

  const isPending = execute.isPending || schedule.isPending || cancel.isPending;

  const handleExecute = async () => {
    const ok = await confirm({
      title: "공실 처리",
      description: "현재 입주자 정보를 전출 이력에 남기고 지금 공실 처리하시겠습니까?",
      confirmLabel: "공실 처리",
    });
    if (!ok) return;
    try {
      await execute.mutateAsync({ occupancyId, moveOutDate: todayLocal() });
      toast.success("퇴실 처리가 완료되었습니다.");
      setOpen(false);
    } catch (error) {
      toast.error(error, "퇴실 처리에 실패했습니다.");
    }
  };

  const handleSchedule = async () => {
    if (!draft.date) {
      toast.error("퇴실 예정일을 선택해 주세요.");
      return;
    }
    try {
      await schedule.mutateAsync({ occupancyId, moveOutDate: draft.date });
      toast.success("퇴실을 예약했습니다.");
      setOpen(false);
    } catch (error) {
      toast.error(error, "퇴실 예약에 실패했습니다.");
    }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(occupancyId);
      toast.success("퇴실 예약을 취소했습니다.");
    } catch (error) {
      toast.error(error, "예약 취소에 실패했습니다.");
    }
  };

  return (
    <div className="flex justify-end pt-[16px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[40px] items-center rounded-[11px] border border-[#fdecee] bg-[#fdecee] px-[15px] text-[13.5px] font-bold text-[#f04452]"
      >
        퇴실처리
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="퇴실 처리">
        <p className="text-[13px] text-t3">
          이사정산은 자동으로 처리되지 않으며 별도 화면에서 진행해야 합니다.
        </p>
        {isVacant ? (
          <div className="mt-4 rounded-xl bg-bg px-4 py-3 text-sm font-bold text-t3">
            현재 공실 상태입니다.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {scheduledDate && (
              <div className="flex items-center justify-between rounded-xl border border-teal bg-teal-t px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-teal-d">퇴실 예약</p>
                  <p className="mt-1 text-sm font-extrabold text-t1">{scheduledDate} 자동 퇴실 예정</p>
                </div>
                <Button variant="ghost" onClick={handleCancel} disabled={isPending}>
                  예약 취소
                </Button>
              </div>
            )}
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-bold text-t1">즉시 퇴실</p>
              <p className="mt-1 text-xs text-t3">오늘 날짜로 전출 이력을 남기고 바로 공실 처리합니다.</p>
              <Button className="mt-4" variant="danger" onClick={handleExecute} disabled={isPending}>
                지금 퇴실 확정
              </Button>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-bold text-t1">퇴실 날짜 지정</p>
              <p className="mt-1 text-xs text-t3">예정일이 되면 목록·상세 진입 시 자동 공실 처리합니다.</p>
              <div className="mt-4 flex gap-2">
                <Input
                  aria-label="퇴실 예정일"
                  type="date"
                  min={todayLocal()}
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
                <Button variant="primary" onClick={handleSchedule} disabled={isPending}>
                  퇴실 예약
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
