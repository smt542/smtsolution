"use client";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal } from "@/components/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import type { MessagePointChannel, SetMessagePointRatesInput } from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 현재 활성 단가(채널 → 건당 P). 미설정 채널은 빈 칸으로 시작한다. */
  currentRates: Map<MessagePointChannel, number>;
  onSubmit: (input: SetMessagePointRatesInput) => Promise<void>;
  isPending: boolean;
}

// PointChargeModal과 같은 정본 모달·입력 스타일
const MODAL_CLASS =
  "max-w-[min(420px,90%)] rounded-[20px] shadow-hf-modal leading-[normal] [&>h2]:text-[17px] [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1";
const INPUT_CLASS =
  "h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] pr-[34px] text-right text-[13.5px] font-semibold text-t1 outline-none tabular-nums placeholder:text-[#757575] focus:border-blue focus:ring-[3px] focus:ring-blue-t";

const CHANNELS: Array<{ channel: MessagePointChannel; label: string; hint: string }> = [
  { channel: "sms", label: "SMS", hint: "90byte 이하 단문" },
  { channel: "lms", label: "LMS", hint: "91byte 이상 장문·제목 포함" },
  { channel: "alimtalk", label: "알림톡", hint: "카카오 알림톡" },
  { channel: "fax", label: "팩스", hint: "성공 페이지당 차감" },
];

const digitsOf = (text: string) => text.replace(/[^0-9]/g, "");

/** 메시지 채널별 건당 차감 포인트(1P = 1원)를 설정한다. 변경 시 새 단가 버전이 생기고 이전 단가는 이력으로 남는다. */
export function PointRateModal({ open, onClose, currentRates, onSubmit, isPending }: Props) {
  const [values, setValues] = useState<Record<MessagePointChannel, string>>(() => ({
    sms: currentRates.has("sms") ? formatNumber(currentRates.get("sms") ?? 0) : "",
    lms: currentRates.has("lms") ? formatNumber(currentRates.get("lms") ?? 0) : "",
    alimtalk: currentRates.has("alimtalk") ? formatNumber(currentRates.get("alimtalk") ?? 0) : "",
    fax: currentRates.has("fax") ? formatNumber(currentRates.get("fax") ?? 0) : "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const busy = isPending || submitting;

  const closeSafely = () => {
    if (!busy) onClose();
  };
  const changeValue = (channel: MessagePointChannel, text: string) => {
    const digits = digitsOf(text);
    setValues((prev) => ({ ...prev, [channel]: digits ? formatNumber(Number(digits)) : "" }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = Object.fromEntries(
      CHANNELS.map(({ channel }) => [channel, Number(digitsOf(values[channel]))]),
    ) as Record<MessagePointChannel, number>;
    const invalid = CHANNELS.find(({ channel }) => !Number.isInteger(parsed[channel]) || parsed[channel] <= 0);
    if (invalid) {
      toast.warning(`${invalid.label} 단가를 1P 이상으로 입력해 주세요`);
      return;
    }
    const unchanged = CHANNELS.every(({ channel }) => currentRates.get(channel) === parsed[channel]);
    if (unchanged) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ smsPoints: parsed.sms, lmsPoints: parsed.lms, alimtalkPoints: parsed.alimtalk, faxPoints: parsed.fax });
      onClose();
    } catch {
      // 실패 토스트는 호출부가 띄운다 — 입력값을 남긴 채 모달을 둔다
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={closeSafely} title="메시지 단가 설정" className={MODAL_CLASS} bodyClassName="">
      <form onSubmit={submit} noValidate>
        <p className="mt-[7px] text-[13px] font-semibold leading-[1.55] text-t3">
          발송 1건(팩스는 1장)당 차감할 포인트예요. 1P = 1원이며, 팝빌 원가에 맞춰 설정해 주세요.
          변경한 단가는 이후 발송부터 적용됩니다.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {CHANNELS.map(({ channel, label, hint }) => (
            <div key={channel}>
              <label htmlFor={`pr-${channel}`} className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-bold text-t2">
                {label}
                <span className="text-[11.5px] font-semibold text-t3">{hint}</span>
              </label>
              <div className="relative">
                <Input
                  unstyled
                  id={`pr-${channel}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={values[channel]}
                  onChange={(event) => changeValue(channel, event.target.value)}
                  placeholder={currentRates.has(channel) ? undefined : "미설정"}
                  className={INPUT_CLASS}
                />
                <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[13px] font-bold text-t3">
                  P
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={busy}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy} className="border border-transparent">
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
