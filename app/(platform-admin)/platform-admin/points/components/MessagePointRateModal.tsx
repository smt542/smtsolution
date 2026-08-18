"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Modal } from "@/components/common";
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
  onSubmit: (values: MessagePointRatesFormValues) => Promise<void>;
  isPending: boolean;
}
export function MessagePointRateModal({
  open,
  onClose,
  smsPoints,
  alimtalkPoints,
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
    defaultValues: { smsPoints, alimtalkPoints },
  });

  useEffect(() => {
    if (open) reset({ smsPoints, alimtalkPoints });
  }, [alimtalkPoints, open, reset, smsPoints]);

  const submit = async (values: MessagePointRatesFormValues) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="메시지 포인트 단가 설정">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        <RateField
          id="message-sms-points"
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
        </RateField>

        <RateField
          id="message-alimtalk-points"
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
        </RateField>

        <p className="rounded-xl bg-amber-t px-3 py-2 text-xs font-semibold text-amber">
          두 채널 단가는 동시에 변경되며 기존 단가는 이력으로 보존됩니다.
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

function RateField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-t3">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
