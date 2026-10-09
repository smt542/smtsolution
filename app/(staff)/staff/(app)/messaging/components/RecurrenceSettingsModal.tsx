"use client";

import { useState } from "react";
import { Button, Input, Modal, SegmentedControl, Switch } from "@/components/common";
import {
  DEFAULT_RECURRENCE_END_COUNT,
  parseRecurrenceEndCount,
} from "@/components/messenger/SchedulePicker";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  useSetMessageScheduleRecurrence,
  type RecurrenceMode,
  type ScheduledMessage,
} from "@/hooks/reactquery/messaging";

const LABEL = "mb-[6px] text-[12.5px] font-bold text-t3";

/** 이 회차부터 남은 발송 횟수(종료 회차 − 현재 회차 + 1). */
function remainingCount(message: ScheduledMessage): number | null {
  if (message.recurrenceEndCount == null) return null;
  return Math.max(1, message.recurrenceEndCount - (message.recurrenceSeq ?? 1) + 1);
}

/**
 * 정본 repScrim(반복 발송 설정): 대기 중 예약을 정기 발송으로 전환·해제한다.
 * 정책: 주기(매월/매주) · 종료(계속 반복/횟수 지정). 발송일·시각은 이 예약의 예약 일시를 따른다.
 */
export function RecurrenceSettingsModal({
  message,
  onClose,
}: {
  message: ScheduledMessage;
  onClose: () => void;
}) {
  const { mutate, isPending } = useSetMessageScheduleRecurrence();
  const [enabled, setEnabled] = useState(message.recurrenceMode !== null);
  const [mode, setMode] = useState<RecurrenceMode>(message.recurrenceMode ?? "monthly");
  const [endCount, setEndCount] = useState<number | null>(remainingCount(message));

  const apply = () => {
    mutate(
      { scheduleId: message.id, mode: enabled ? mode : null, endCount: enabled ? endCount : null },
      {
        onSuccess: () => {
          toast.success(enabled ? "반복 발송으로 전환했어요" : "반복을 해제했어요");
          onClose();
        },
        onError: (error) => toast.error(error, "반복 설정을 저장하지 못했어요"),
      },
    );
  };

  return (
    <Modal open onClose={onClose} title="반복 발송 설정" className="max-w-[460px]">
      <p className="-mt-2 mb-[18px] text-[13px] font-medium leading-[1.6] text-t3">
        이 예약을 정기 발송으로 전환해요. 대상 규칙과 내용은 그대로 유지됩니다.
      </p>
      <div className="flex flex-col gap-[12px]">
        <div className="flex items-center justify-between gap-[14px]">
          <span className="text-[14px] font-bold">반복 사용</span>
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="반복 사용" />
        </div>
        {enabled && (
          <>
            <div>
              <div className={LABEL}>주기</div>
              <SegmentedControl
                options={[
                  { value: "monthly", label: "매월" },
                  { value: "weekly", label: "매주" },
                ]}
                value={mode}
                onChange={(value) => setMode(value as RecurrenceMode)}
              />
            </div>
            <div>
              <div className={LABEL}>종료</div>
              <SegmentedControl
                options={[
                  { value: "never", label: "계속 반복" },
                  { value: "count", label: "횟수 지정" },
                ]}
                value={endCount === null ? "never" : "count"}
                onChange={(value) =>
                  setEndCount(value === "never" ? null : (endCount ?? DEFAULT_RECURRENCE_END_COUNT))
                }
              />
            </div>
            {endCount !== null && (
              <div className="flex items-center gap-[8px]">
                <Input
                  unstyled
                  inputMode="numeric"
                  aria-label="반복 횟수"
                  value={String(endCount)}
                  onChange={(event) => setEndCount(parseRecurrenceEndCount(event.target.value))}
                  className="h-[40px] w-[90px] rounded-[11px] border border-line bg-white px-[12px] text-right text-[13.5px] font-bold text-t1 outline-none focus:border-blue"
                />
                <span className="text-[13.5px] font-semibold text-t2">회 후 종료</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-[22px] flex justify-end gap-[8px]">
        <Button size="modal" variant="ghost" onClick={onClose} disabled={isPending}>
          취소
        </Button>
        <Button size="modal" onClick={apply} disabled={isPending}>
          {isPending ? "저장 중…" : "적용"}
        </Button>
      </div>
    </Modal>
  );
}
