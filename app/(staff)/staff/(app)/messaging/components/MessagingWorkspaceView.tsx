"use client";

import Image from "next/image";
import { useState } from "react";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { DpTimePicker } from "@/components/common/DpTimePicker";
import { joinDateTimeLocal, splitDateTimeLocal } from "@/components/common/DateInput";
import { CalendarIcon, ClockIcon } from "@/components/icons";
import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates";
import type { MessageRecipient, SendMode } from "@/lib/messaging/preset";
import { MessagingWorkspacePreview } from "./MessagingWorkspacePreview";

interface MessagingWorkspaceViewProps {
  mode: SendMode;
  onModeChange: (mode: SendMode) => void;
  senderPhone: string;
  recipients: MessageRecipient[];
  onClearRecipients: () => void;
  recipientLabel: string;
  itemCount: number;
  templates: MessageTemplate[];
  effectiveTemplateId: number | null;
  isTemplatesLoading: boolean;
  onTemplateChange: (value: string) => void;
  body: string;
  previewBody: string;
  onBodyChange: (value: string) => void;
  sendTiming: "now" | "scheduled";
  onSendTimingChange: (value: "now" | "scheduled") => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  canSend: boolean;
}

const selectClass = "h-[40px] min-w-0 flex-1 appearance-none rounded-[11px] border border-line bg-white px-[13px] text-[13.5px] font-semibold text-t1 outline-none disabled:bg-bg disabled:text-t4";
const SCHEDULED_PICKER_TRIGGER_CLASS_NAME =
  "h-[36px] rounded-[9px] border border-line bg-white px-[11px] text-[12px] text-t1 outline-none focus:border-teal flex items-center gap-[6px] text-left cursor-pointer";

export function MessagingWorkspaceView({
  mode,
  onModeChange,
  senderPhone,
  recipients,
  onClearRecipients,
  recipientLabel,
  itemCount,
  templates,
  effectiveTemplateId,
  isTemplatesLoading,
  onTemplateChange,
  body,
  previewBody,
  onBodyChange,
  sendTiming,
  onSendTimingChange,
  scheduledAt,
  onScheduledAtChange,
  onSend,
  sending,
  canSend,
}: MessagingWorkspaceViewProps) {
  const [showRecipients, setShowRecipients] = useState(false);
  const byteLength = new TextEncoder().encode(body).length;
  const messageType = byteLength > 90 ? "LMS" : "SMS";
  const { date: scheduledDate, time: scheduledTime } = splitDateTimeLocal(scheduledAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[18px]">
        <div className="flex w-full gap-[2px] rounded-[10px] bg-[#edf0f3] p-[3px]">
          <button
            type="button"
            onClick={() => onModeChange("sms")}
            className={`flex-1 rounded-[7px] px-[14px] py-[8px] text-[13px] font-bold ${
              mode !== "alimtalk" ? "bg-white text-t1 shadow-[0_2px_2.5px_rgba(23,31,40,0.1)]" : "text-t3"
            }`}
          >
            문자(SMS)
          </button>
          <button
            type="button"
            onClick={() => onModeChange("alimtalk")}
            className={`flex-1 rounded-[7px] px-[14px] py-[8px] text-[13px] font-bold ${
              mode === "alimtalk" ? "bg-white text-t1 shadow-[0_2px_2.5px_rgba(23,31,40,0.1)]" : "text-t3"
            }`}
          >
            알림톡
          </button>
        </div>

        <div className="flex flex-col gap-[16px]">
          <label>
            <span className="block text-[12.5px] font-bold text-t2">발신 번호</span>
            <span className="mt-[8px] flex h-[41px] items-center gap-[9px] rounded-[11px] border border-line bg-white px-[13px]">
              <strong className="text-[13.5px] font-bold text-t1">{senderPhone}</strong>
              <span className="rounded-[6px] bg-[#e2f5f1] px-[7px] py-[2px] text-[10.5px] font-bold text-[#0e8677]">
                회사 대표번호
              </span>
              <Image src="/icons/overdue/drawer-chevron.svg" alt="" width={15} height={15} className="ml-auto size-[15px]" />
            </span>
          </label>

          <div>
            <span className="block text-[12.5px] font-bold text-t2">수신자</span>
            <div className="mt-[8px] flex min-h-[27px] flex-wrap gap-[6px]">
              <span className="flex items-center gap-[6px] rounded-[8px] border border-teal bg-[#e2f5f1] py-[5px] pl-[11px] pr-[7px] text-[12px] font-bold text-[#0e8677]">
                {recipientLabel} {recipients.length}명 · {itemCount}건 발송
                <button
                  type="button"
                  aria-label="수신자 전체 해제"
                  onClick={onClearRecipients}
                  className="flex size-[14px] items-center justify-center rounded text-[14px] font-medium leading-none text-[#0e8677] hover:bg-white/70"
                >
                  ×
                </button>
              </span>
              <button
                type="button"
                onClick={() => setShowRecipients((current) => !current)}
                className="rounded-[8px] bg-bg px-[11px] py-[5px] text-[12px] font-bold text-t3"
              >
                목록 보기
              </button>
            </div>
            {showRecipients && (
              <div className="mt-[8px] max-h-[90px] overflow-y-auto rounded-[10px] border border-line bg-bg px-[12px] py-[8px] text-[11.5px] text-t2">
                {recipients.map((recipient, index) => (
                  <p key={`${recipient.ref?.occupancyId ?? index}:${recipient.phone ?? ""}`}>
                    {recipient.unitNo ?? "세대 미지정"} · {recipient.name ?? "이름 없음"} · {recipient.phone ?? "연락처 없음"}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-[8px] flex gap-[8px] opacity-45">
              <select aria-label="수신자 유형" disabled className={selectClass}>
                <option>유형 선택</option>
              </select>
              <select aria-label="수신자 세부 유형" disabled className={selectClass}>
                <option>유형을 먼저 선택</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="inline-flex min-h-[24px] items-center gap-[8px] text-[13px] font-bold text-t2">
            <input
              type="checkbox"
              checked={sendTiming === "scheduled"}
              onChange={(event) => onSendTimingChange(event.target.checked ? "scheduled" : "now")}
              className="size-[19px] appearance-none rounded-[6px] border-2 border-line bg-white checked:border-teal checked:bg-teal"
            />
            예약 전송
          </label>
          {sendTiming === "scheduled" && (
            <div className="ml-[14px] flex items-center gap-[6px]">
              <DpDatePicker
                ariaLabel="예약 발송 날짜"
                value={scheduledDate}
                onChange={(value) => onScheduledAtChange(joinDateTimeLocal(value, scheduledTime))}
                placeholder="날짜 선택"
                triggerClassName={`${SCHEDULED_PICKER_TRIGGER_CLASS_NAME} w-[118px]`}
                triggerOpenClassName="border-teal"
                endAdornment={<CalendarIcon className="ml-auto size-[14px] shrink-0 text-t3" aria-hidden="true" />}
              />
              <DpTimePicker
                ariaLabel="예약 발송 시간"
                value={scheduledTime}
                onChange={(value) => onScheduledAtChange(joinDateTimeLocal(scheduledDate, value))}
                placeholder="시간 선택"
                triggerClassName={`${SCHEDULED_PICKER_TRIGGER_CLASS_NAME} w-[104px]`}
                triggerOpenClassName="border-teal"
                endAdornment={<ClockIcon className="ml-auto size-[14px] shrink-0 text-t3" aria-hidden="true" />}
              />
            </div>
          )}
        </div>

        <div className="flex gap-[14px]">
          <section className="min-w-0 flex-1">
            <div className="flex h-[32px] items-start justify-between pb-[8px]">
              <label htmlFor="message-workspace-body" className="pt-[4.5px] text-[12.5px] font-bold text-t2">
                메시지 내용
              </label>
              <label className="relative flex items-center gap-[5px] rounded-[8px] px-[9px] py-[5px] text-[12px] font-bold text-t2">
                <Image src="/icons/overdue/template.svg" alt="" width={13} height={13} className="size-[13px]" />
                <span>템플릿</span>
                <select
                  aria-label="메시지 템플릿"
                  value={effectiveTemplateId ?? ""}
                  disabled={isTemplatesLoading}
                  onChange={(event) => onTemplateChange(event.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="">선택</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.title}</option>
                  ))}
                </select>
                <Image src="/icons/overdue/template-chevron.svg" alt="" width={13} height={13} className="size-[13px]" />
              </label>
            </div>
            <textarea
              id="message-workspace-body"
              aria-label="본문"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              placeholder="메시지 내용을 입력해 주세요 · 아래 변수를 눌러 넣을 수 있어요"
              className="h-[260px] min-h-[260px] w-full resize-none rounded-[11px] border border-line bg-white px-[14px] py-[13px] text-[14px] font-medium leading-[22.4px] text-t1 outline-none placeholder:text-[#757575] focus:border-teal"
            />
            <p className="pt-[8px] text-[11px] font-bold text-t3">
              {body.length}자 · {byteLength}byte · <strong className={messageType === "LMS" ? "text-amber" : "text-teal"}>{messageType}</strong>
            </p>
          </section>
          <MessagingWorkspacePreview senderPhone={senderPhone} body={previewBody} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-white px-[20px] py-[14px]">
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          aria-disabled={!canSend || sending}
          className="flex h-[48px] w-full items-center justify-center gap-[7px] rounded-[13px] bg-teal text-[15px] font-extrabold text-white shadow-[0_8px_8px_rgba(20,164,151,0.5)] transition hover:bg-teal-d disabled:cursor-wait disabled:opacity-60"
        >
          <Image src="/icons/overdue/send.svg" alt="" width={18} height={18} className="size-[18px]" />
          {sending ? "발송 중…" : `${itemCount}건 발송`}
        </button>
      </footer>
    </div>
  );
}
