"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Modal } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import {
  messagePointRatesSchema,
  type MessagePointRatesFormValues,
} from "@/components/forms/schema/messagePointRates";

type FormInput = z.input<typeof messagePointRatesSchema>;

interface MessagePointRateModalProps {
  open: boolean;
  onClose: () => void;
  smsPoints: number;
  alimtalkPoints: number;
  lmsPoints?: number;
  onSubmit: (values: MessagePointRatesFormValues) => Promise<void>;
  isPending: boolean;
}
export function MessagePointRateModal({
  open,
  onClose,
  smsPoints,
  alimtalkPoints,
  lmsPoints,
  onSubmit,
  isPending,
}: MessagePointRateModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, MessagePointRatesFormValues>({
    resolver: zodResolver(messagePointRatesSchema),
    defaultValues: { smsPoints, alimtalkPoints, lmsPoints },
  });

  useEffect(() => {
    if (open) reset({ smsPoints, alimtalkPoints, lmsPoints });
  }, [alimtalkPoints, lmsPoints, open, reset, smsPoints]);

  const submit = async (values: MessagePointRatesFormValues) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="메시지 포인트 단가 설정">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        <FormField
          htmlFor="message-sms-points"
          label="SMS 건당 포인트"
          error={errors.smsPoints?.message}
        >
          <Input
            id="message-sms-points"
            aria-label="SMS 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            {...register("smsPoints")}
          />
        </FormField>

        <FormField
          htmlFor="message-lms-points"
          label="LMS 건당 포인트 (선택)"
          error={errors.lmsPoints?.message}
        >
          <Input
            id="message-lms-points"
            aria-label="LMS 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="미설정 시 LMS 발송 불가"
            {...register("lmsPoints")}
          />
        </FormField>

        <FormField
          htmlFor="message-alimtalk-points"
          label="알림톡 건당 포인트"
          error={errors.alimtalkPoints?.message}
        >
          <Input
            id="message-alimtalk-points"
            aria-label="알림톡 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            {...register("alimtalkPoints")}
          />
        </FormField>

        <p className="rounded-xl bg-amber-t px-3 py-2 text-xs font-semibold text-amber">
          단가는 동시에 변경되며 기존 단가는 이력으로 보존됩니다. LMS 단가를 비우면 LMS 단가는 변경되지
          않고, 미설정 상태에서는 LMS 길이의 문자를 발송할 수 없습니다.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중…" : "단가 저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
