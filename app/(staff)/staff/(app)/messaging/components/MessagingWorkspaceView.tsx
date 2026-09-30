"use client";

import Image from "next/image";
import { useState } from "react";
import { CustomDropdown } from "@/components/common/CustomDropdown";
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

const disabledDropdownClass = [
  "[&_.uc-dd]:min-w-0 [&_.uc-dd]:w-full",
  "[&_.uc-dd-btn]:h-[40px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between",
  "[&_.uc-dd-btn]:rounded-[11px] [&_.uc-dd-btn]:px-[13px]",
  "[&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-semibold",
  "[&_.uc-dd-btn]:disabled:bg-bg [&_.uc-dd-btn]:disabled:text-t4 [&_.uc-dd-btn]:disabled:opacity-100",
  "[&_.uc-dd-btn_svg]:h-[14px] [&_.uc-dd-btn_svg]:w-[14px]",
].join(" ");
const templateDropdownClass = [
  "[&_.uc-dd-btn]:h-[24px] [&_.uc-dd-btn]:rounded-[8px] [&_.uc-dd-btn]:border-transparent",
  "[&_.uc-dd-btn]:bg-transparent [&_.uc-dd-btn]:px-0 [&_.uc-dd-btn]:text-[12px]",
  "[&_.uc-dd-btn]:font-bold [&_.uc-dd-btn]:text-t2 [&_.uc-dd-btn]:shadow-none",
  "[&_.uc-dd-btn]:hover:border-transparent [&_.uc-dd-btn]:hover:shadow-none",
  "[&_.uc-dd.open_.uc-dd-btn]:border-transparent [&_.uc-dd.open_.uc-dd-btn]:shadow-none",
  "[&_.uc-dd-btn_svg]:h-[13px] [&_.uc-dd-btn_svg]:w-[13px]",
].join(" ");
const templateDropdownMenuClass = [
  "[&.uc-dd-menu]:rounded-[12px] [&.uc-dd-menu]:p-[6px]",
  "[&.uc-dd-menu]:shadow-[0_16px_40px_-12px_rgba(23,31,40,0.3)]",
  "[&.uc-dd-menu]:w-[300px] [&.uc-dd-menu]:max-h-[320px]",
  "[&_.uc-opt]:gap-[8px] [&_.uc-opt]:rounded-[9px] [&_.uc-opt]:px-[10px] [&_.uc-opt]:py-[9px]",
  "[&_.uc-opt]:text-[13px] [&_.uc-opt]:font-bold [&_.uc-opt]:text-t1",
  "[&_.uc-opt:not(.on):hover]:bg-bg",
  "[&_.uc-opt.on]:bg-blue-t2 [&_.uc-opt.on]:text-blue-d",
].join(" ");
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
              <div className={`min-w-0 flex-1 ${disabledDropdownClass}`}>
                <CustomDropdown
                  ariaLabel="수신자 유형"
                  value=""
                  options={[{ value: "", label: "유형 선택" }]}
                  disabled
                  variant="field"
                  onChange={() => undefined}
                />
              </div>
              <div className={`min-w-0 flex-1 ${disabledDropdownClass}`}>
                <CustomDropdown
                  ariaLabel="수신자 세부 유형"
                  value=""
                  options={[{ value: "", label: "유형을 먼저 선택" }]}
                  disabled
                  variant="field"
                  onChange={() => undefined}
                />
              </div>
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
                <div className={templateDropdownClass}>
                  <CustomDropdown
                    ariaLabel="메시지 템플릿"
                    value={effectiveTemplateId?.toString() ?? ""}
                    options={[
                      { value: "", label: "선택" },
                      ...templates.map((template) => ({ value: String(template.id), label: template.title })),
                    ]}
                    disabled={isTemplatesLoading}
                    position="fixed"
                    menuAlign="end"
                    menuClassName={templateDropdownMenuClass}
                    triggerLabel="템플릿"
                    check="never"
                    onChange={onTemplateChange}
                  />
                </div>
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
