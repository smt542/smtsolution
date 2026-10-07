"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  NOTICE_PAGE_SIZE,
  useNotice,
  useNotices,
  type NoticeFilters as NoticeFilterValues,
  type NoticeType,
  type NoticeSummary,
} from "@/hooks/reactquery/notices";
import { NoticeDetailModal } from "./NoticeDetailModal";
import { NoticeFormModal } from "./NoticeFormModal";
import { NoticeList } from "./NoticeList";

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

  const filters = useMemo<NoticeFilterValues>(
    () => ({ noticeType: noticeType === "all" ? undefined : noticeType }),
    [noticeType],
  );

  const buildingsQuery = useBuildings();
  const noticesQuery = useNotices(filters, page, NOTICE_PAGE_SIZE);
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  // 공지가 없으면 빈 목록 그대로 NoticeList의 빈 상태("공지가 없습니다.")를 보여준다.
  const displayNotices = useMemo<NoticeSummary[]>(
    () => noticesQuery.data?.items ?? [],
    [noticesQuery.data?.items],
  );
  const displayTotal = noticesQuery.data?.total ?? 0;

  const selectedListId = useMemo(
    () =>
      selectedId !== null && displayNotices.some((n) => n.id === selectedId)
        ? selectedId
        : null,
    [displayNotices, selectedId],
  );
  const selectedNoticeQuery = useNotice(
    selectedListId !== null && selectedListId > 0 ? selectedListId : 0,
  );
  const selectedNotice = selectedNoticeQuery.data ?? null;
  const isNoticeListInitialLoading = buildingsQuery.isLoading || noticesQuery.isLoading;
  const isNoticeListRefreshing = [buildingsQuery, noticesQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const openCreate = () => setFormOpen(true);
  const closeForm = () => setFormOpen(false);

  const handleTypeChange = (type: NoticeType | "all") => {
    setNoticeType(type);
    setPage(0);
  };

  if (buildingsQuery.isError || noticesQuery.isError) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f2f4f6]">
        <div className="bg-white border-b border-[#e8ebee] flex h-[62px] items-center gap-[12px] px-[24px] shrink-0">
          <button type="button" aria-label="메뉴 열기" onClick={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))} className="mr-[2px] flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[20px]" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
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
        <button type="button" aria-label="메뉴 열기" onClick={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))} className="mr-[2px] flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[20px]" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="text-[19px] font-extrabold text-[#191f28] tracking-[-0.38px] whitespace-nowrap">
          공지 관리
        </h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openCreate}
          className="bg-[#14a497] h-[34px] px-[14px] rounded-[11px] drop-shadow-[0px_6px_7px_rgba(20,164,151,0.5)] text-white text-[13px] font-bold whitespace-nowrap"
        >
          ＋ 공지 등록
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="relative flex-1 pt-[22px] pb-[30px] px-[24px]">
        {isNoticeListInitialLoading ? (
          <div className="bg-white min-h-[420px] rounded-[16px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)] flex items-center justify-center py-16">
            <Spinner label="공지 목록 불러오는 중" />
          </div>
        ) : buildingsQuery.isError || noticesQuery.isError ? (
          <div role="alert" className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[16px] bg-white text-sm text-red shadow-card">
            <p>데이터를 불러오지 못했습니다.</p>
            <button type="button" className="rounded-xl border border-line px-4 py-2 font-bold text-t2" onClick={() => { void buildingsQuery.refetch(); void noticesQuery.refetch(); }}>다시 시도</button>
          </div>
        ) : (
          <>
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
            {isNoticeListRefreshing ? (
              <div className="pointer-events-none absolute right-8 top-7 rounded-full bg-surface/95 shadow-card">
                <Spinner label="공지 목록 갱신 중" size="small" showLabel className="px-3 py-2" />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* 상세 모달: 조회 상태에 따라 표시 */}
      {selectedListId !== null && selectedListId > 0 ? (
        selectedNoticeQuery.isLoading || selectedNoticeQuery.isError ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={() => setSelectedId(null)}>
            <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-[660px] max-w-full rounded-[20px] bg-white p-[24px] drop-shadow-[0px_30px_35px_rgba(0,0,0,0.4)]">
              {selectedNoticeQuery.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner label="공지 상세 불러오는 중" />
                </div>
              ) : (
                <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-red">
                  <p>공지 상세를 불러오지 못했습니다.</p>
                  <button type="button" className="inline-flex h-10 items-center justify-center rounded-[11px] border border-line px-4 text-[13.5px] font-bold text-t2" onClick={() => void selectedNoticeQuery.refetch()}>다시 시도</button>
                </div>
              )}
            </div>
          </div>
        ) : selectedNotice ? (
          <NoticeDetailModal
            key={selectedNotice.id}
            notice={selectedNotice}
            buildings={buildings}
            canSendMessages={canSendMessages}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        ) : null
      ) : null}

      <NoticeFormModal
        open={formOpen}
        onClose={closeForm}
        editing={null}
        buildings={buildings}
        orgId={orgId}
        onSaved={(notice) => { setPage(0); setSelectedId(notice.id); }}
      />
    </div>
  );
}
