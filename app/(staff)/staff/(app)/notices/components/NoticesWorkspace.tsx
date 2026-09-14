"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  NOTICE_PAGE_SIZE,
  useNotice,
  useNotices,
  type Notice,
  type NoticeFilters as NoticeFilterValues,
  type NoticeType,
  type NoticeSummary,
} from "@/hooks/reactquery/notices";
import { NoticeDetail } from "./NoticeDetail";
import { NoticeFormModal } from "./NoticeFormModal";
import { NoticeList } from "./NoticeList";

function AnnouncementIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h9l5-3v14l-5-3H4z" />
      <path d="M8 15v4" />
    </svg>
  );
}

export function NoticesWorkspace({
  orgId,
  canSendMessages,
}: {
  orgId: number;
  canSendMessages: boolean;
}) {
  const [noticeType, setNoticeType] = useState<NoticeType | "all">("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const filters = useMemo<NoticeFilterValues>(
    () => ({ noticeType: noticeType === "all" ? undefined : noticeType }),
    [noticeType],
  );

  const buildingsQuery = useBuildings();
  const noticesQuery = useNotices(filters, page, NOTICE_PAGE_SIZE);
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const notices = useMemo(() => noticesQuery.data?.items ?? [], [noticesQuery.data?.items]);
  const total = noticesQuery.data?.total ?? 0;

  const selectedListId = useMemo(
    () =>
      selectedId !== null && notices.some((n) => n.id === selectedId)
        ? selectedId
        : null,
    [notices, selectedId],
  );
  const selectedNoticeQuery = useNotice(selectedListId ?? 0);
  const selectedNotice = selectedNoticeQuery.data ?? null;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selectedNotice) return;
    setEditing(selectedNotice);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleTypeChange = (type: NoticeType | "all") => {
    setNoticeType(type);
    setPage(0);
  };

  const handleSelect = (notice: NoticeSummary) => {
    setSelectedId(notice.id);
  };

  if (buildingsQuery.isError || noticesQuery.isError) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f2f4f6]">
        <div className="bg-white border-b border-[#e8ebee] flex h-[62px] items-center gap-[12px] px-[24px] shrink-0">
          <div className="flex items-center justify-center size-[36px] rounded-[10px]">
            <AnnouncementIcon />
          </div>
          <h1 className="text-[19px] font-extrabold text-[#191f28] tracking-[-0.38px] whitespace-nowrap">
            공지 관리
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-bold text-[#191f28] text-[15px]">데이터를 불러오지 못했습니다.</p>
            <p className="mt-1 text-[13px] text-[#8b95a1]">잠시 후 다시 시도해 주세요.</p>
            <button
              type="button"
              className="mt-4 text-[13px] text-[#14a497] underline"
              onClick={() => {
                void buildingsQuery.refetch();
                void noticesQuery.refetch();
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f4f6]">
      {/* 62px 페이지 헤더 */}
      <div className="bg-white border-b border-[#e8ebee] flex h-[62px] items-center gap-[12px] px-[24px] shrink-0">
        <div className="flex items-center justify-center size-[36px] rounded-[10px] text-[#191f28]">
          <AnnouncementIcon />
        </div>
        <h1 className="text-[19px] font-extrabold text-[#191f28] tracking-[-0.38px] whitespace-nowrap">
          공지 관리
        </h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openCreate}
          className="bg-[#14a497] h-[34px] px-[14px] rounded-[11px] drop-shadow-[0px_6px_7px_rgba(20,164,151,0.5)] text-white text-[13px] font-bold whitespace-nowrap border border-transparent"
        >
          ＋ 공지 등록
        </button>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 pt-[22px] pb-[30px] px-[24px]">
        {buildingsQuery.isLoading || noticesQuery.isLoading ? (
          <div className="bg-white rounded-[16px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)] flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <NoticeList
            notices={notices}
            buildings={buildings}
            selectedId={selectedListId}
            total={total}
            page={page}
            pageSize={NOTICE_PAGE_SIZE}
            noticeType={noticeType}
            onNoticeTypeChange={handleTypeChange}
            onSelect={handleSelect}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* 공지 상세 오버레이 */}
      {selectedListId !== null && (
        <>
          {/* 배경 딤 */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedId(null)}
          />
          {/* 우측 슬라이드 패널 */}
          <div className="fixed inset-y-0 right-0 z-50 w-[520px] bg-white shadow-xl overflow-y-auto">
            {selectedNoticeQuery.isLoading ? (
              <div className="flex items-center justify-center h-full py-16">
                <Spinner />
              </div>
            ) : selectedNotice ? (
              <NoticeDetail
                notice={selectedNotice}
                buildings={buildings}
                canSendMessages={canSendMessages}
                onEdit={openEdit}
                onDeleted={() => setSelectedId(null)}
              />
            ) : null}
          </div>
        </>
      )}

      <NoticeFormModal
        open={formOpen}
        onClose={closeForm}
        editing={editing}
        buildings={buildings}
        orgId={orgId}
        onSaved={(notice) => {
          setPage(0);
          setSelectedId(notice.id);
        }}
      />
    </div>
  );
}
