"use client";

import { useEffect, useId, type ReactNode } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import type { MessageRecipient, SendMode } from "@/lib/messaging/preset";

export interface MessageDetailRow {
  label: string;
  value: ReactNode;
}

interface MessageDetailModalProps {
  onClose: () => void;
  title: string;
  channel: SendMode;
  /** 채널·발신번호 다음에 오는 요약 행(수신자·발송시점·유형·상태 등). */
  rows: MessageDetailRow[];
  recipients: MessageRecipient[];
  recipientCount: number;
  body: string;
}

const SECTION_LABEL =
  "text-[11px] font-extrabold tracking-[0.22px] text-[#b0b8c1]";

/**
 * 예약 발송·발송 내역 그리드 행 클릭 시 열리는 공용 상세 모달(Figma 28-21557 / 28-21713).
 * 마운트 시점 = 열림. 표시할 행이 선택됐을 때만 렌더한다.
 */
export function MessageDetailModal({
  onClose,
  title,
  channel,
  rows,
  recipients,
  recipientCount,
  body,
}: MessageDetailModalProps) {
  const titleId = useId();
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const channelText = channel === "alimtalk" ? "알림톡" : "문자";
  const senderNumber =
    channel === "alimtalk"
      ? "관리비서 채널"
      : config?.smsSender ?? "발신번호 미등록";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-[430px] max-w-full flex-col overflow-y-auto rounded-[20px] bg-white p-[24px] drop-shadow-[0px_30px_35px_rgba(0,0,0,0.4)]"
      >
        {/* 제목 */}
        <p
          id={titleId}
          className="text-center text-[17px] font-extrabold text-[#191f28]"
        >
          {title}
        </p>

        {/* 요약 */}
        <div className="mt-[16px] flex w-full flex-col overflow-hidden rounded-[12px] border border-[#e8ebee]">
          <SummaryRow label="채널">
            <span className="inline-flex items-center rounded-[6px] bg-[#e2f5f1] px-[8px] py-[2px] text-[11px] font-extrabold text-[#0e8677]">
              {channelText}
            </span>
          </SummaryRow>
          <SummaryRow label="발신번호">
            <span className="text-[13px] font-bold text-[#191f28]">
              {senderNumber}
            </span>
          </SummaryRow>
          {rows.map((row) => (
            <SummaryRow key={row.label} label={row.label}>
              <span className="text-[13px] font-bold text-[#191f28]">
                {row.value}
              </span>
            </SummaryRow>
          ))}
        </div>

        {/* 수신자 목록 */}
        <div className="mt-[12px] flex w-full items-center justify-between">
          <span className={SECTION_LABEL}>수신자 목록</span>
          <span className="text-[11px] font-bold text-[#8b95a1]">
            {recipientCount}명
          </span>
        </div>
        <div className="mt-[6px] flex max-h-[180px] w-full flex-col overflow-y-auto rounded-[12px] border border-[#e8ebee] bg-white">
          {recipients.length === 0 ? (
            <p className="px-[13px] py-[14px] text-[13px] text-[#8b95a1]">
              수신자 정보가 없습니다.
            </p>
          ) : (
            recipients.map((recipient, index) => (
              <div
                key={`${recipient.phone ?? ""}:${index}`}
                className="flex h-[34px] items-center justify-between border-b border-[#f1f3f5] px-[13px] last:border-b-0"
              >
                <span className="text-[13px] font-semibold text-[#191f28]">
                  {recipient.name ?? "이름 없음"}
                </span>
                <span className="text-right text-[13px] font-medium text-[#8b95a1]">
                  {recipient.phone ?? "-"}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 전송 내용 */}
        <div className="mt-[12px] w-full">
          <span className={SECTION_LABEL}>전송 내용</span>
        </div>
        <div className="mt-[6px] max-h-[130px] w-full overflow-y-auto rounded-[12px] border border-[#e8ebee] bg-[#f7f8fa] px-[14px] py-[13px]">
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-[21.45px] text-[#191f28]">
            {body}
          </p>
        </div>

        {/* 닫기 */}
        <button
          type="button"
          onClick={onClose}
          className="mt-[20px] flex h-[40px] w-full shrink-0 items-center justify-center rounded-[11px] bg-[#14a497] text-[13.5px] font-bold tracking-[-0.135px] text-white transition hover:bg-teal-d"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[34px] w-full items-center gap-[10px] border-b border-[#f1f3f5] px-[13px] last:border-b-0">
      <span className="w-[64px] shrink-0 text-[13px] font-semibold text-[#8b95a1]">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
