"use client";

import React, { useState } from "react";
import { Button } from "@/components/common";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  useCancelMoveOutSchedule,
  useExecuteMoveOut,
  useScheduleMoveOut,
} from "@/hooks/reactquery/occupancies";
import { formatDate } from "@/lib/format";
import { DateField } from "../tenant-form/ui/Fields";

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return String(now.getFullYear()) + "-" + month + "-" + day;
}
export function MoveOutControl({
  occupancyId,
  scheduledDate,
  isVacant,
  onImmediateMoveOutComplete,
}: {
  occupancyId: number;
  scheduledDate: string | null;
  isVacant: boolean;
  onImmediateMoveOutComplete?: () => void;
}) {
  const confirm = useConfirm();
  const execute = useExecuteMoveOut();
  const schedule = useScheduleMoveOut();
  const cancel = useCancelMoveOutSchedule();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "date">("now");
  const [date, setDate] = useState("");

  const minDate = todayLocal();
  const isMoveOutMutationPending = execute.isPending || schedule.isPending || cancel.isPending;

  const openGuidance = () => {
    setMode("now");
    setDate("");
    setOpen(true);
  };

  const handleMoveOut = async () => {
    if (mode === "date" && (!date || date < minDate)) {
      toast.warning("퇴실 날짜를 선택해 주세요.");
      return;
    }

    try {
      if (mode === "now") {
        await execute.mutateAsync({ occupancyId, moveOutDate: minDate });
        setOpen(false);
        const resultConfirmed = await confirm({
          look: "plain",
          hideCancel: true,
          title: "퇴실 완료",
          description: "즉시 퇴실이 완료되었습니다.\n전출자 정보에서 이력을 확인할 수 있습니다.",
          confirmLabel: "확인",
        });
        if (resultConfirmed) onImmediateMoveOutComplete?.();
      } else {
        await schedule.mutateAsync({ occupancyId, moveOutDate: date });
        setOpen(false);
        await confirm({
          look: "plain",
          hideCancel: true,
          title: "퇴실 예약 완료",
          description: "지정된 날짜에 자동 퇴실 처리가 되며,\n퇴실 후 전출자 정보에서 이력을 확인할 수 있습니다.",
          confirmLabel: "확인",
        });
      }
    } catch (error) {
      toast.error(error, mode === "now" ? "퇴실 처리에 실패했습니다." : "퇴실 예약에 실패했습니다.");
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({
      look: "plain",
      title: "퇴실 예약 취소",
      description: "예약된 퇴실을 취소하시겠습니까?\n취소 시 예정된 자동 퇴실 처리가 해제됩니다.",
      cancelLabel: "닫기",
      confirmLabel: "퇴실 취소",
    });
    if (!ok) return;

    try {
      await cancel.mutateAsync(occupancyId);
      toast.success("퇴실 취소");
    } catch (error) {
      toast.error(error, "예약 취소에 실패했습니다.");
    }
  };

  if (isVacant) return null;

  if (scheduledDate) {
    return (
      <div className="mt-[16px] flex items-center gap-[12px] rounded-[12px] border border-amber bg-amber-t px-[16px] py-[14px]">
        <div className="min-w-0 flex-1">
          <div className="mb-[3px] text-[12px] font-bold text-amber">퇴실 예약</div>
          <div className="text-[14px] font-extrabold text-t1">퇴실 예정일 · {formatDate(scheduledDate)}</div>
        </div>
        <button
          type="button"
          className="inline-flex h-[34px] shrink-0 items-center justify-center gap-[6px] whitespace-nowrap rounded-[11px] border border-line bg-white px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg disabled:bg-bg disabled:text-t4"
          onClick={handleCancel}
          disabled={isMoveOutMutationPending}
        >
          퇴실 취소
        </button>
      </div>
    );
  }

  const nowOptionClass = mode === "now"
    ? "border-blue bg-blue-t text-blue"
    : "border-line bg-white text-t2";
  const dateOptionClass = mode === "date"
    ? "border-blue bg-blue-t text-blue"
    : "border-line bg-white text-t2";

  return (
    <>
      <div className="flex justify-end pt-[16px]">
        <Button variant="dangerTint" type="button" onClick={openGuidance}>
          퇴실처리
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        look="plain"
        widthClassName="w-[min(420px,92%)]"
        titleSpacingClassName="mb-[6px]"
        title="퇴실 처리하시겠습니까?"
        cancelLabel="취소"
        confirmLabel="퇴실 처리"
        confirmDisabled={isMoveOutMutationPending}
        onConfirm={handleMoveOut}
        onCancel={() => setOpen(false)}
      >
        <div className="mb-4 text-[13px] font-semibold leading-[1.5] text-t3">퇴실 방식을 선택하세요.</div>
        <div className="flex flex-col gap-[9px]">
          <button
            type="button"
            aria-pressed={mode === "now"}
            onClick={() => setMode("now")}
            className={"rounded-[12px] border-[1.5px] px-[15px] py-[13px] text-left text-[14px] font-bold " + nowOptionClass}
          >
            즉시 퇴실
          </button>
          <button
            type="button"
            aria-pressed={mode === "date"}
            onClick={() => setMode("date")}
            className={"rounded-[12px] border-[1.5px] px-[15px] py-[13px] text-left text-[14px] font-bold " + dateOptionClass}
          >
            퇴실 날짜 지정
          </button>
        </div>
        {mode === "date" && (
          <div className="mt-[11px]">
            <div className="mb-[6px] text-[12.5px] font-bold text-t2">퇴실일</div>
            <DateField value={date} onChange={setDate} minDate={minDate} />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
