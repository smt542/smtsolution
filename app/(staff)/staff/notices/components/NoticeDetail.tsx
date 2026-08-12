"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Panel } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useDeleteNotice, type Notice } from "@/hooks/reactquery/notices";
import {
  formatNoticeDate,
  getNoticeStatus,
  NOTICE_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
} from "../utils";

export function NoticeDetail({
  notice,
  buildings,
  onEdit,
  onDeleted,
}: {
  notice: Notice;
  buildings: Building[];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteNotice = useDeleteNotice();
  const status = getNoticeStatus(notice);
  const buildingName = notice.buildingId === null
    ? "전체 공지"
    : (buildings.find((building) => building.id === notice.buildingId)?.name ?? "삭제된 건물");

  const handleDelete = async () => {
    try {
      await deleteNotice.mutateAsync(notice.id);
      toast.success("공지가 삭제되었습니다.");
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "공지를 삭제하지 못했습니다.");
    }
  };

  return (
    <>
      <Panel
        title="공지 상세"
        action={
          <div className="flex flex-wrap gap-2">
            {/* TODO(messaging): 공지 유형별 메시지 템플릿과 입주자 수신 대상을 연동한다. */}
            <Button type="button" variant="ghost" disabled title="메시지 기능 연동 예정">
              알림 발송 준비 중
            </Button>
            <Button type="button" variant="ghost" onClick={onEdit}>수정</Button>
            <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>삭제</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-t px-2.5 py-1 text-xs font-bold text-blue-d">
            {NOTICE_TYPE_LABELS[notice.noticeType]}
          </span>
          <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-t2">
            {NOTICE_STATUS_LABELS[status]}
          </span>
          <span className="text-sm text-t3">{buildingName}</span>
        </div>

        <h2 className="mt-5 text-xl font-extrabold leading-8 text-t1">{notice.title}</h2>
        <div className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-bg p-4 text-sm leading-7 text-t1">
          {notice.content}
        </div>

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
    </>
  );
}
