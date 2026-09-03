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
import { ModalActions } from "../../../_components/ModalActions";
import { InlineAlert } from "../../../_components/InlineAlert";

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

const MODAL_CLASS =
  "max-w-[440px] rounded-[20px] shadow-pop [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";
const INPUT_CLASS =
  "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const BUTTON_CLASS = "h-10 rounded-[11px] px-[15px] text-[13.5px]";

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
    <Modal
      open={open}
      onClose={onClose}
      title="메시지 포인트 단가 설정"
      className={MODAL_CLASS}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        <FormField
          htmlFor="message-sms-points"
          label="SMS 건당 포인트"
          error={errors.smsPoints?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input
            id="message-sms-points"
            aria-label="SMS 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            {...register("smsPoints")}
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField
          htmlFor="message-lms-points"
          label="LMS 건당 포인트 (선택)"
          error={errors.lmsPoints?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input
            id="message-lms-points"
            aria-label="LMS 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="미설정 시 LMS 발송 불가"
            {...register("lmsPoints")}
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField
          htmlFor="message-alimtalk-points"
          label="알림톡 건당 포인트"
          error={errors.alimtalkPoints?.message}
          className={FORM_FIELD_CLASS}
        >
          <Input
            id="message-alimtalk-points"
            aria-label="알림톡 건당 포인트"
            type="number"
            min={1}
            inputMode="numeric"
            {...register("alimtalkPoints")}
            className={INPUT_CLASS}
          />
        </FormField>

        <InlineAlert tone="warning">
          단가는 동시에 변경되며 기존 단가는 이력으로 보존됩니다. LMS 단가를 비우면 LMS 단가는 변경되지
          않고, 미설정 상태에서는 LMS 길이의 문자를 발송할 수 없습니다.
        </InlineAlert>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose} className={BUTTON_CLASS}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending} className={BUTTON_CLASS}>
            {isPending ? "저장 중…" : "단가 저장"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
