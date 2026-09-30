"use client";

import { useEffect, useId, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Modal } from "@/components/common";
import { SendIcon } from "@/components/icons";
import { plainTextToNoticeDoc } from "@/lib/notice/richText";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useDeleteNotice,
  useNoticeSendSummary,
  useUpdateNotice,
  type Notice,
  type NoticeInput,
  type NoticeType,
} from "@/hooks/reactquery/notices";
import { useNoticeAlimtalkSend } from "../useNoticeAlimtalkSend";
import {
  NOTICE_TYPE_LABELS,
  toNoticeBuildingIds,
  toNoticeTargetSelection,
  type NoticeTargetSelection,
} from "../utils";
import { NoticeAlimtalkConfirmModal } from "./NoticeAlimtalkConfirmModal";
import { NoticeTargetBuildings } from "./NoticeTargetBuildings";

const TYPE_ORDER: NoticeType[] = ["normal", "important", "urgent"];

/** 헤더 배지 색상(공지 목록과 동일 팔레트). */
const TYPE_BADGE: Record<NoticeType, string> = {
  urgent: "bg-[#fff1f1] text-[#f04452]",
  important: "bg-[#fff4e5] text-[#b26a00]",
  normal: "bg-[#f2f4f6] text-[#8b95a1]",
};

function formatDotDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/**
 * 공지 상세/편집 모달 (Figma 27:21368).
 *
 * 공지 목록에서 항목을 클릭하면 뜨는 중앙 모달. 유형·제목·내용·대상 건물을 한 화면에서
 * 편집하고 알림톡 발송 상태와 재전송을 함께 노출한다. (기존 우측 슬라이드 상세를 대체)
 */
export function NoticeDetailModal({
  notice,
  buildings,
  canSendMessages,
  onClose,
  onSaved,
  onDeleted,
}: {
  notice: Notice;
  buildings: Building[];
  canSendMessages: boolean;
  onClose: () => void;
  onSaved?: (notice: Notice) => void;
  onDeleted: () => void;
}) {
  const titleId = useId();
  const [type, setType] = useState<NoticeType>(notice.noticeType);
  const [title, setTitle] = useState(notice.title);
  const [content, setContent] = useState(notice.content);
  // 대상 건물: 저장값 빈 배열 = 전체 공지 → 전체 건물로 연다.
  const [targets, setTargets] = useState<NoticeTargetSelection>(() =>
    toNoticeTargetSelection(notice.buildingIds),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateNotice = useUpdateNotice();
  const deleteNotice = useDeleteNotice();
  const alimtalk = useNoticeAlimtalkSend(notice, buildings, canSendMessages);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const sendSummaryQuery = useNoticeSendSummary(notice.id);
  const sendSummary = sendSummaryQuery.data ?? null;
  const isSaving = updateNotice.isPending;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmOpen && !confirmSendOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [confirmOpen, confirmSendOpen, onClose]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("제목을 입력해 주세요.");
      return;
    }
    const buildingIds = toNoticeBuildingIds(targets, buildings);
    if (!buildingIds) {
      toast.warning("대상 건물을 선택해 주세요");
      return;
    }
    const input: Partial<NoticeInput> = {
      title: trimmed,
      noticeType: type,
      buildingIds,
    };
    // 본문을 실제로 편집한 경우에만 평문→doc 로 치환한다.
    // (편집하지 않으면 기존 본문/이미지를 그대로 보존한다.)
    if (content !== notice.content) {
      input.content = content;
      input.contentJson = plainTextToNoticeDoc(content);
    }
    try {
      const saved = await updateNotice.mutateAsync({ id: notice.id, input });
      toast.success("공지가 수정되었습니다.");
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error, "공지를 저장하지 못했습니다.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNotice.mutateAsync(notice.id);
      toast.success("공지가 삭제되었습니다.");
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      toast.error(error, "공지를 삭제하지 못했습니다.");
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[90vh] w-[660px] max-w-full flex-col overflow-y-auto rounded-[20px] bg-white p-[24px] drop-shadow-[0px_30px_35px_rgba(0,0,0,0.4)]"
        >
          {/* 헤더: 유형 배지 + 제목 + 게시일·작성자 */}
          <div className="flex w-full items-center gap-[10px]">
            <span className={`inline-flex shrink-0 items-center rounded-[7px] px-[9px] py-[3px] text-[11.5px] font-extrabold leading-[normal] ${TYPE_BADGE[type]}`}>
              {NOTICE_TYPE_LABELS[type]}
            </span>
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-[17px] font-extrabold leading-[normal] text-[#191f28]">
              {notice.title}
            </h2>
            <span className="shrink-0 text-[12.5px] font-semibold leading-[normal] text-[#8b95a1]">
              {formatDotDate(notice.publishedAt)}
              {notice.createdBy ? ` · ${notice.createdBy}` : ""}
            </span>
          </div>

          {/* 본문 폼 */}
          <div className="flex flex-col gap-[20px] pt-[14px]">
            {/* 유형 */}
            <div className="flex flex-col gap-[9px]">
              <span className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">유형</span>
              <div className="inline-flex gap-[2px] self-start rounded-[9px] bg-[#edf0f3] p-[3px]">
                {TYPE_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={
                      type === value
                        ? "rounded-[7px] bg-white px-[11px] py-[5px] text-[12px] font-bold leading-[normal] text-[#191f28] drop-shadow-[0px_1px_1.5px_rgba(23,31,40,0.1)]"
                        : "rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[normal] text-[#8b95a1]"
                    }
                  >
                    {NOTICE_TYPE_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="flex flex-col gap-[9px]">
              <label htmlFor="notice-detail-title" className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">제목</label>
              <input
                id="notice-detail-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="공지 제목"
                className="h-[42px] w-full rounded-[11px] border border-[#e8ebee] bg-white px-[14px] text-[14px] font-medium text-[#191f28] outline-none placeholder:text-[#b0b8c1] focus:border-[#14a497]"
              />
            </div>

            {/* 내용 */}
            <div className="flex flex-col gap-[9px]">
              <label htmlFor="notice-detail-content" className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">내용</label>
              <textarea
                id="notice-detail-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="공지 내용"
                className="h-[130px] w-full resize-none rounded-[11px] border border-[#e8ebee] bg-white p-[14px] text-[14px] font-medium leading-[22px] text-[#191f28] outline-none placeholder:text-[#b0b8c1] focus:border-[#14a497]"
              />
            </div>

            {/* 대상 건물 */}
            <NoticeTargetBuildings buildings={buildings} value={targets} onChange={setTargets} />

            {/* 알림톡 발송 상태 + 재전송/발송 (실 발송 이력 기반) */}
            <div className="flex w-full items-center gap-[12px] rounded-[12px] bg-[#f2f4f6] px-[14px] py-[12px]">
              <div className="min-w-0 flex-1">
                {sendSummary ? (
                  <>
                    <p className="text-[13.5px] font-extrabold leading-[normal] text-[#191f28]">
                      알림톡 {sendSummary.count}명 발송{sendSummary.result === "failed" ? " 실패" : " 완료"}
                    </p>
                    <p className="pt-[3px] text-[12px] font-semibold leading-[normal] text-[#8b95a1]">
                      {formatDotDate(sendSummary.sentAt)} 전송됨
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13.5px] font-extrabold leading-[normal] text-[#191f28]">알림톡 발송 이력이 없습니다</p>
                    <p className="pt-[3px] text-[12px] font-semibold leading-[normal] text-[#8b95a1]">입주자에게 공지 알림을 발송할 수 있어요</p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmSendOpen(true)}
                disabled={alimtalk.disabled}
                title={!canSendMessages ? "문자 발송 권한이 필요합니다." : undefined}
                className="flex h-[36px] shrink-0 items-center gap-[7px] rounded-[10px] border border-[#14a497] bg-white px-[14px] text-[13px] font-bold leading-[normal] text-[#14a497] disabled:opacity-50"
              >
                <SendIcon className="size-[15px]" />
                {sendSummary ? "재전송" : "발송"}
              </button>
            </div>
          </div>

          {/* 푸터 */}
          <div className="flex w-full items-center gap-[8px] pt-[20px]">
            <button
              type="button"
              onClick={onClose}
              className="flex h-[40px] items-center justify-center rounded-[11px] bg-[#f2f4f6] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-[#4e5968]"
            >
              닫기
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isSaving || deleteNotice.isPending}
              className="flex h-[40px] w-[132px] items-center justify-center rounded-[11px] bg-[#f04452] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-white disabled:opacity-60"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex h-[40px] w-[132px] items-center justify-center rounded-[11px] bg-[#14a497] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-white disabled:opacity-60"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="공지 삭제">
        <p className="text-sm leading-6 text-t1">
          “{notice.title}” 공지를 삭제할까요? 삭제 후 목록에서 보이지 않습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>취소</Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteNotice.isPending}>
            {deleteNotice.isPending ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </Modal>

      {confirmSendOpen && (
        <NoticeAlimtalkConfirmModal
          open
          confirmLabel={sendSummary ? "재전송" : "발송"}
          noticeTitle={notice.title}
          buildingLabel={alimtalk.buildingLabel}
          templateLabel={alimtalk.templateLabel}
          recipientCount={alimtalk.recipientCount}
          loading={alimtalk.recipientsLoading}
          sending={alimtalk.isSending}
          onCancel={() => { if (!alimtalk.isSending) setConfirmSendOpen(false); }}
          onConfirm={() => {
            void (async () => {
              const ok = await alimtalk.sendNow();
              if (ok) {
                setConfirmSendOpen(false);
                void sendSummaryQuery.refetch();
              }
            })();
          }}
        />
      )}
    </>
  );
}
