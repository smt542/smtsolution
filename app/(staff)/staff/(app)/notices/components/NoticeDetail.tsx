"use client";

import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Badge, Button, Modal, Panel } from "@/components/common";
import { NoticeContent } from "@/components/notices/NoticeContent";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useDeleteNotice,
  useNoticeImageUrls,
  type Notice,
} from "@/hooks/reactquery/notices";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import { useNoticeMessaging } from "../useNoticeMessaging";
import {
  formatNoticeDate,
  getNoticeStatus,
  NOTICE_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
} from "../utils";

export function NoticeDetail({
  notice,
  buildings,
  canSendMessages,
  onEdit,
  onDeleted,
}: {
  notice: Notice;
  buildings: Building[];
  canSendMessages: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteNotice = useDeleteNotice();
  const noticeImages = useNoticeImageUrls(notice.id, notice.contentJson);
  const messaging = useNoticeMessaging(notice, buildings, canSendMessages);
  const status = getNoticeStatus(notice);
  const buildingName = notice.buildingIds.length === 0
    ? "전체 공지"
    : notice.buildingIds
        .map((id) => buildings.find((building) => building.id === id)?.name ?? "삭제된 건물")
        .join(", ");

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
      <Panel
        title="공지 상세"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void messaging.trigger()}
              disabled={messaging.disabled}
              title={!canSendMessages ? "문자 발송 권한이 필요합니다." : undefined}
            >
              {messaging.isPreparing ? "링크 생성 중…" : "공지 알림 발송"}
            </Button>
            {messaging.recipientsRefreshing ? (
              <span role="status" aria-label="입주자 수신처 갱신 중" className="self-center text-xs text-t3">
                수신처 갱신 중…
              </span>
            ) : null}
            <Button type="button" variant="ghost" onClick={onEdit}>수정</Button>
            <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>삭제</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue" className="px-2.5 py-1">
            {NOTICE_TYPE_LABELS[notice.noticeType]}
          </Badge>
          <Badge className="bg-bg px-2.5 py-1 text-t2">
            {NOTICE_STATUS_LABELS[status]}
          </Badge>
          <span className="text-sm text-t3">{buildingName}</span>
        </div>

        <h2 className="mt-5 text-xl font-extrabold leading-8 text-t1">{notice.title}</h2>
        <NoticeContent
          json={notice.contentJson}
          fallbackText={notice.content}
          imageUrls={noticeImages.urls}
          imageUrlsLoading={noticeImages.isLoading}
          className="mt-4 rounded-xl bg-bg p-4 text-sm leading-7 text-t1"
        />

        <dl className="mt-5 grid gap-x-5 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-[100px_1fr]">
          <dt className="font-semibold text-t3">게시 일시</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.publishedAt)}</dd>
          <dt className="font-semibold text-t3">게시 종료</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.expiresAt)}</dd>
          <dt className="font-semibold text-t3">작성 일시</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.createdAt)}</dd>
        </dl>
      </Panel>

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

      {messaging.open && (
        <MessagingModal
          open
          preset={messaging.preset}
          onClose={messaging.close}
          onSent={messaging.onSent}
        />
      )}
    </>
  );
}
