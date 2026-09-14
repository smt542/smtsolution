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

const DUMMY_NOTICES: NoticeSummary[] = [
  {
    id: -1,
    orgId: 0,
    buildingId: null,
    title: "9월 관리비 청구 안내 — 납기일 9월 25일",
    noticeType: "normal",
    publishedAt: "2026-09-14T00:00:00Z",
    expiresAt: null,
    createdBy: "관리자",
    createdAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
  },
  {
    id: -2,
    orgId: 0,
    buildingId: null,
    title: "엘리베이터 정기점검 안내 (9/15 오전 9시~12시)",
    noticeType: "important",
    publishedAt: "2026-09-13T00:00:00Z",
    expiresAt: "2026-09-15T12:00:00Z",
    createdBy: "관리자",
    createdAt: "2026-09-13T00:00:00Z",
    updatedAt: "2026-09-13T00:00:00Z",
  },
  {
    id: -3,
    orgId: 0,
    buildingId: null,
    title: "긴급 단수 안내 — 9/14(일) 오후 2시~6시",
    noticeType: "urgent",
    publishedAt: "2026-09-14T08:00:00Z",
    expiresAt: "2026-09-14T18:00:00Z",
    createdBy: "관리자",
    createdAt: "2026-09-14T08:00:00Z",
    updatedAt: "2026-09-14T08:00:00Z",
  },
];

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
  const rawNotices = useMemo(() => noticesQuery.data?.items ?? [], [noticesQuery.data?.items]);
  const rawTotal = noticesQuery.data?.total ?? 0;

  const displayNotices = useMemo(() => {
    if (rawNotices.length > 0) return rawNotices;
    if (noticeType === "all") return DUMMY_NOTICES;
    return DUMMY_NOTICES.filter((n) => n.noticeType === noticeType);
  }, [rawNotices, noticeType]);
  const displayTotal = rawTotal > 0 ? rawTotal : displayNotices.length;

  const selectedListId = useMemo(
    () =>
      selectedId !== null && displayNotices.some((n) => n.id === selectedId)
        ? selectedId
        : null,
    [displayNotices, selectedId],
  );
  // 더미(음수 id)는 API 조회 안 함
  const selectedNoticeQuery = useNotice(
    selectedListId !== null && selectedListId > 0 ? selectedListId : 0,
  );
  const selectedNotice = selectedNoticeQuery.data ?? null;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = () => {
    if (!selectedNotice) return;
    setEditing(selectedNotice);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleTypeChange = (type: NoticeType | "all") => {
    setNoticeType(type);
    setPage(0);
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
              onClick={() => { void buildingsQuery.refetch(); void noticesQuery.refetch(); }}
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

      {/* 콘텐츠 */}
      <div className="flex-1 pt-[22px] pb-[30px] px-[24px]">
        {buildingsQuery.isLoading || noticesQuery.isLoading ? (
          <div className="bg-white rounded-[16px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)] flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <NoticeList
            notices={displayNotices}
            buildings={buildings}
            selectedId={selectedListId}
            total={displayTotal}
            page={page}
            pageSize={NOTICE_PAGE_SIZE}
            noticeType={noticeType}
            onNoticeTypeChange={handleTypeChange}
            onSelect={(notice) => setSelectedId(notice.id)}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* 상세 오버레이 (더미 항목은 열지 않음) */}
      {selectedListId !== null && selectedListId > 0 && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedId(null)} />
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
        onSaved={(notice) => { setPage(0); setSelectedId(notice.id); }}
      />
    </div>
  );
}
