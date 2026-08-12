"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useOverdueBuildings,
  useOverdueHouseholds,
  usePrepareOverdueMessage,
  type OverdueHousehold,
  type OverdueMessageDraft,
} from "@/hooks/reactquery/overdue";
import { hasModule } from "@/lib/auth/permissions";
import { MessagingPreviewModal } from "./components/MessagingPreviewModal";
import { OverdueDetailModal } from "./components/OverdueDetailModal";
import { OverdueTable } from "./components/OverdueTable";
import { OverdueToolbar } from "./components/OverdueToolbar";
import {
  downloadOverdueLedger,
  isDebtCollectionTarget,
} from "./utils";

export default function OverduePage() {
  const { data: me, isLoading: isMeLoading } = useMe();
  const canAccess = hasModule(me, "overdue");
  const {
    data: buildings = [],
    isLoading: isBuildingsLoading,
  } = useOverdueBuildings(canAccess);

  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [debtFilterEnabled, setDebtFilterEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailHousehold, setDetailHousehold] = useState<OverdueHousehold | null>(null);
  const [messageDraft, setMessageDraft] = useState<OverdueMessageDraft | null>(null);

  const {
    data: households = [],
    isLoading: isHouseholdsLoading,
    error: householdsError,
    refetch,
  } = useOverdueHouseholds(canAccess ? selectedBuildingId : null);
  const prepareMessage = usePrepareOverdueMessage();

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const debtTargetCount = useMemo(
    () => households.filter(isDebtCollectionTarget).length,
    [households],
  );
  const visibleHouseholds = useMemo(
    () => debtFilterEnabled ? households.filter(isDebtCollectionTarget) : households,
    [debtFilterEnabled, households],
  );
  const selectedCount = visibleHouseholds.filter((row) => selectedIds.has(row.occupancyId)).length;

  const changeBuilding = (buildingId: number | null) => {
    setSelectedBuildingId(buildingId);
    setDebtFilterEnabled(false);
    setSelectedIds(new Set());
    setDetailHousehold(null);
  };

  const toggleDebtFilter = () => {
    const nextEnabled = !debtFilterEnabled;
    setDebtFilterEnabled(nextEnabled);
    setSelectedIds(
      nextEnabled
        ? new Set(households.filter(isDebtCollectionTarget).map((row) => row.occupancyId))
        : new Set(),
    );
  };

  const toggleOne = (occupancyId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(occupancyId)) next.delete(occupancyId);
      else next.add(occupancyId);
      return next;
    });
  };

  const toggleAll = () => {
    const allVisibleSelected =
      visibleHouseholds.length > 0 &&
      visibleHouseholds.every((row) => selectedIds.has(row.occupancyId));
    setSelectedIds(
      allVisibleSelected
        ? new Set()
        : new Set(visibleHouseholds.map((row) => row.occupancyId)),
    );
  };

  const exportLedger = () => {
    if (!selectedBuilding || visibleHouseholds.length === 0) {
      toast.info("출력할 미납 세대가 없습니다.");
      return;
    }

    try {
      const filename = downloadOverdueLedger(selectedBuilding.name, visibleHouseholds);
      toast.success(`${filename} 파일을 저장했습니다.`);
    } catch {
      toast.error("미납대장을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const openMessagingPreview = async () => {
    const recipients = visibleHouseholds
      .filter((row) => selectedIds.has(row.occupancyId))
      .map((row) => ({
        occupancyId: row.occupancyId,
        unitNo: [row.dong, row.unitNo].filter(Boolean).join(" "),
        tenantName: row.tenantName,
        phone: row.phone,
      }));

    if (recipients.length === 0) {
      toast.info("문자를 받을 세대를 선택해 주세요.");
      return;
    }

    try {
      const draft = await prepareMessage.mutateAsync(recipients);
      setMessageDraft(draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문자 발송 준비 중 오류가 발생했습니다.");
    }
  };

  if (isMeLoading) {
    return (
      <div className="p-6" aria-label="권한 확인 중">
        <Spinner />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-5 p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold text-t3">관리업무 · 미납관리</p>
          <h1 className="text-2xl font-extrabold text-t1">미납관리</h1>
          <p className="mt-2 text-sm text-t2">
            건물별 세대를 확인하고 채권 관리 대상과 독촉 문자 수신처를 선별합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={exportLedger}
            disabled={!selectedBuilding || isHouseholdsLoading}
          >
            미납대장 출력
          </Button>
          <Button
            variant="primary"
            onClick={openMessagingPreview}
            disabled={!selectedBuilding || isHouseholdsLoading || prepareMessage.isPending}
          >
            독촉 문자 발송{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </div>
      </header>

      <OverdueToolbar
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onBuildingChange={changeBuilding}
        debtFilterEnabled={debtFilterEnabled}
        onToggleDebtFilter={toggleDebtFilter}
        disabled={isBuildingsLoading}
      />

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-t1">미납 세대</h2>
            <p className="mt-1 text-xs text-t3">행을 선택하면 세대 상세 정보를 확인할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-bg px-3 py-1.5 text-t2">
              조회 {visibleHouseholds.length}세대
            </span>
            <span className="rounded-full bg-blue-t px-3 py-1.5 text-blue-d">
              선택 {selectedCount}세대
            </span>
            <span className="rounded-full bg-red-t px-3 py-1.5 text-red">
              채권 대상 {debtTargetCount}세대
            </span>
          </div>
        </div>

        {selectedBuildingId === null ? (
          <EmptyState message="건물을 선택해 주세요" />
        ) : isHouseholdsLoading ? (
          <div aria-label="미납 세대 조회 중" className="py-12">
            <Spinner />
          </div>
        ) : householdsError ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-sm text-t3">오류가 발생했습니다. 다시 시도해 주세요.</p>
            <Button variant="ghost" onClick={() => refetch()}>재시도</Button>
          </div>
        ) : visibleHouseholds.length === 0 ? (
          <EmptyState
            message={debtFilterEnabled ? "채권 관리 대상 세대가 없습니다" : "미납 세대가 없습니다"}
          />
        ) : (
          <OverdueTable
            rows={visibleHouseholds}
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onRowClick={setDetailHousehold}
          />
        )}

        {selectedBuildingId !== null && !householdsError && (
          <div className="border-t border-line2 bg-bg/60 px-5 py-4">
            <p className="text-xs font-semibold leading-5 text-t3">
              연체 2개월 이상 세대는 3개월째 고지서에 “단전·단수 예고”가 자동 인쇄됩니다.
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber">
              현재 청구·수납 원장이 없어 연체 개월수, 미납금액, 최근 납부일은 0 또는 빈 값으로 표시됩니다.
            </p>
          </div>
        )}
      </section>

      <OverdueDetailModal household={detailHousehold} onClose={() => setDetailHousehold(null)} />
      <MessagingPreviewModal draft={messageDraft} onClose={() => setMessageDraft(null)} />
    </div>
  );
}

