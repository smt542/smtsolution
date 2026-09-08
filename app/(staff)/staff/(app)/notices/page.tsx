"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  NOTICE_PAGE_SIZE,
  useNotice,
  useNotices,
  type Notice,
  type NoticeFilters as NoticeFilterValues,
  type NoticeStatus,
  type NoticeSummary,
  type NoticeType,
} from "@/hooks/reactquery/notices";
import { hasModule } from "@/lib/auth/permissions";
import { NoticeDetail } from "./components/NoticeDetail";
import { NoticeFilters } from "./components/NoticeFilters";
import { NoticeFormModal } from "./components/NoticeFormModal";
import { NoticeList } from "./components/NoticeList";

export default function NoticesPage() {
  const meQuery = useMe();

  if (meQuery.isLoading) {
    return <div className="p-6"><Spinner /></div>;
  }

  if (meQuery.isError) {
    return (
      <div className="p-6">
        <LoadError onRetry={() => meQuery.refetch()} />
      </div>
    );
  }

  if (!hasModule(meQuery.data, "notices")) {
    return <div className="p-6"><EmptyState message="공지 관리 권한이 없습니다." /></div>;
  }

  return (
    <NoticesWorkspace
      orgId={meQuery.data!.orgId}
      canSendMessages={hasModule(meQuery.data, "messaging")}
    />
  );
}

function NoticesWorkspace({
  orgId,
  canSendMessages,
}: {
  orgId: number;
  canSendMessages: boolean;
}) {
  const [target, setTarget] = useState("all");
  const [noticeType, setNoticeType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const filters = useMemo<NoticeFilterValues>(() => ({
    buildingId: target === "all" ? undefined : target === "organization" ? null : Number(target),
    noticeType: noticeType === "all" ? undefined : noticeType as NoticeType,
    status: status as NoticeStatus,
    search: search.trim() || undefined,
  }), [noticeType, search, status, target]);

  const buildingsQuery = useBuildings();
  const noticesQuery = useNotices(filters, page, NOTICE_PAGE_SIZE);
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const notices = useMemo(() => noticesQuery.data?.items ?? [], [noticesQuery.data?.items]);
  const selectedListId = useMemo(
    () => selectedId !== null && notices.some((notice) => notice.id === selectedId)
      ? selectedId
      : null,
    [notices, selectedId],
  );
  const selectedNoticeQuery = useNotice(selectedListId ?? 0);
  const selectedNotice = selectedNoticeQuery.data ?? null;
  const total = noticesQuery.data?.total ?? 0;

  const selectNotice = useCallback((notice: NoticeSummary) => {
    setSelectedId(notice.id);
  }, []);

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
  const resetFilters = () => {
    setTarget("all");
    setNoticeType("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  if (buildingsQuery.isError || noticesQuery.isError) {
    return (
      <div className="p-6">
        <LoadError onRetry={() => {
          void buildingsQuery.refetch();
          void noticesQuery.refetch();
        }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">공지 관리</h1>
          <p className="mt-1 text-sm text-t3">전체 또는 건물별 공지를 등록하고 게시 상태를 관리합니다.</p>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>+ 공지 등록</Button>
      </header>

      <NoticeFilters
        buildings={buildings}
        target={target}
        noticeType={noticeType}
        status={status}
        search={search}
        onTargetChange={(value) => { setTarget(value); setPage(0); }}
        onNoticeTypeChange={(value) => { setNoticeType(value); setPage(0); }}
        onStatusChange={(value) => { setStatus(value); setPage(0); }}
        onSearchChange={(value) => { setSearch(value); setPage(0); }}
        onReset={resetFilters}
      />

      {buildingsQuery.isLoading || noticesQuery.isLoading ? (
        <div className="rounded-2xl border border-line bg-surface py-16"><Spinner /></div>
      ) : notices.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="조건에 맞는 공지가 없습니다." />
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(440px,1.1fr)]">
          <NoticeList
            notices={notices}
            buildings={buildings}
            selectedId={selectedListId}
            total={total}
            page={page}
            pageSize={NOTICE_PAGE_SIZE}
            onSelect={selectNotice}
            onPageChange={setPage}
          />
          {selectedListId !== null && selectedNoticeQuery.isLoading ? (
            <div className="rounded-2xl border border-line bg-surface py-16"><Spinner /></div>
          ) : selectedListId !== null && selectedNoticeQuery.isError ? (
            <LoadError onRetry={() => selectedNoticeQuery.refetch()} />
          ) : selectedNotice ? (
            <NoticeDetail
              notice={selectedNotice}
              buildings={buildings}
              canSendMessages={canSendMessages}
              onEdit={openEdit}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-surface">
              <EmptyState message="목록에서 공지를 선택하면 상세 내용을 확인할 수 있습니다." />
            </div>
          )}
        </div>
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

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="font-bold text-t1">데이터를 불러오지 못했습니다.</p>
      <p className="mt-1 text-sm text-t3">잠시 후 다시 시도해 주세요.</p>
      <Button type="button" variant="ghost" className="mt-4" onClick={onRetry}>다시 시도</Button>
    </div>
  );
}
