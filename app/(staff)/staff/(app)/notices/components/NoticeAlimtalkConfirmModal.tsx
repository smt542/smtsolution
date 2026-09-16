"use client";

import { useEffect, useId } from "react";

/**
 * 공지 알림톡 발송/재전송 확인 다이얼로그 (Figma 45:31983).
 * 제목 + (공지제목 · 건물·템플릿 · 수신자 수) 요약 + 취소/재전송 2버튼.
 * 확인 시 작성기 없이 곧바로 발송한다(useNoticeAlimtalkSend).
 */
export function NoticeAlimtalkConfirmModal({
  open,
  confirmLabel,
  noticeTitle,
  buildingLabel,
  templateLabel,
  recipientCount,
  loading = false,
  sending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  confirmLabel: string;
  noticeTitle: string;
  buildingLabel: string;
  templateLabel: string;
  recipientCount: number;
  loading?: boolean;
  sending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sending, onCancel]);

  if (!open) return null;

  const confirmDisabled = sending || loading || recipientCount === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4"
      onClick={() => { if (!sending) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="flex w-[400px] max-w-[calc(100vw-32px)] flex-col rounded-[20px] bg-white p-[24px] drop-shadow-[0px_30px_35px_rgba(0,0,0,0.4)]"
      >
        {/* 제목 */}
        <div className="flex w-full flex-col items-center">
          <h2 id={titleId} className="text-center text-[17px] font-extrabold leading-[normal] text-[#191f28]">
            알림톡을 전송할까요?
          </h2>
        </div>

        {/* 요약 */}
        <div className="flex w-full flex-col items-center pt-[10px] text-center">
          <p className="text-[13px] font-black leading-[22.1px] text-[#191f28]">{noticeTitle}</p>
          <p className="text-[13px] font-semibold leading-[22.1px] text-[#8b95a1]">
            {buildingLabel} · {templateLabel}
          </p>
          <p className="text-[13px] font-semibold leading-[22.1px] text-[#8b95a1]">
            {loading ? "수신 세대를 확인하는 중이에요." : `연결된 세대 ${recipientCount}명에게 발송됩니다.`}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex w-full items-start justify-center gap-[8px] pt-[20px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="flex h-[40px] flex-1 items-center justify-center rounded-[11px] bg-[#f2f4f6] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-[#4e5968] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex h-[40px] flex-1 items-center justify-center rounded-[11px] bg-[#14a497] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-white disabled:opacity-60"
          >
            {sending ? "발송 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
