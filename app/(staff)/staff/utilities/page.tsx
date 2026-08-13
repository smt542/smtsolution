"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Select, Spinner, Tabs } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useUtilityRows,
  useSaveMeterReadings,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { UtilityHistoryModal } from "./components/UtilityHistoryModal";
import { WaterDiscountModal } from "./components/WaterDiscountModal";
import { UtilitySummaryCards } from "./components/UtilitySummaryCards";
import { UtilityTable, type UtilityDraft } from "./components/UtilityTable";
import { UnitPriceModal } from "./components/UnitPriceModal";

const TYPE_TABS: { id: UtilityType; label: string }[] = [
  { id: "water", label: "수도" },
  { id: "electricity", label: "전기" },
  { id: "gas", label: "가스" },
];

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

function localDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value);
}

function initialDraft(row: UtilityUnitRow): UtilityDraft {
  return {
    currentReading: numberText(row.currentReading),
    manualCharge: numberText(row.manualCharge),
    note: row.note ?? "",
  };
}

export default function UtilitiesPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [utilityType, setUtilityType] = useState<UtilityType>("water");
  const [referenceDate, setReferenceDate] = useState(localDateString);
  const [drafts, setDrafts] = useState<Record<string, UtilityDraft>>({});
  const [historyRow, setHistoryRow] = useState<UtilityUnitRow | null>(null);
  const [discountRow, setDiscountRow] = useState<UtilityUnitRow | null>(null);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const period = `${referenceDate.slice(0, 7)}-01`;
  const rowsQuery = useUtilityRows(buildingId, utilityType, period);
  const saveMeter = useSaveMeterReadings();

  if (me === undefined) return null;
  if (!hasModule(me, "utilities")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" />
      </div>
    );
  }

  const buildings = buildingsQuery.data ?? [];
  const rows = rowsQuery.data ?? [];
  const scopeKey = `${buildingId ?? "none"}:${utilityType}`;
  const scopedDrafts: Record<number, UtilityDraft> = Object.fromEntries(
    rows.map((row) => [row.unitId, drafts[`${scopeKey}:${row.unitId}`] ?? initialDraft(row)]),
  );
  const activeRows = rows.filter((row) => !isVacant(row));
  const completed = activeRows.filter(
    (row) => scopedDrafts[row.unitId].currentReading.trim() !== "",
  ).length;
  const expectedCharge = activeRows.reduce((sum, row) => {
    const manual = scopedDrafts[row.unitId].manualCharge.trim();
    if (manual !== "") {
      const parsed = Number(manual);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }
    return sum + (row.automaticCharge ?? 0);
  }, 0);

  const updateDraft = (unitId: number, patch: Partial<UtilityDraft>) => {
    const row = rows.find((candidate) => candidate.unitId === unitId);
    if (!row) return;
    const key = `${scopeKey}:${unitId}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? initialDraft(row)), ...patch },
    }));
  };

  const selectBuilding = (value: string) => {
    setBuildingId(value ? Number(value) : null);
    setHistoryRow(null);
    setDiscountRow(null);
    setPriceModalOpen(false);
  };

  const selectUtilityType = (id: string) => {
    setUtilityType(id as UtilityType);
    setHistoryRow(null);
    setDiscountRow(null);
    setPriceModalOpen(false);
  };

  const openHistory = () => {
    const row = historyRow ?? activeRows[0] ?? rows[0];
    if (!row) {
      toast.error("이력을 조회할 세대가 없습니다.");
      return;
    }
    setHistoryRow(row);
  };

  const calculateCharges = () => {
    const payloadRows = activeRows
      .map((row) => ({ row, draft: scopedDrafts[row.unitId] }))
      .filter(({ draft }) => draft.currentReading.trim() !== "")
      .map(({ row, draft }) => ({
        unit_id: row.unitId,
        current_reading: draft.currentReading.trim(),
        manual_charge: draft.manualCharge.trim(),
        note: draft.note.trim(),
      }));
    if (payloadRows.length === 0) {
      toast.error("입력된 당월 지침이 없습니다.");
      return;
    }
    saveMeter.mutate(
      { buildingId: buildingId as number, utilityType, period, rows: payloadRows },
      {
        onSuccess: (res) => toast.success(`${res.saved}개 세대 검침을 저장했습니다.`),
        onError: () => toast.error("검침 저장에 실패했습니다."),
      },
    );
  };

  const exportLedger = () => {
    // TODO(export): [건물명]_[유형]_검침대장_YYYYMM.xlsx 서버 생성 API를 연결한다.
    toast.info("검침대장 엑셀 내보내기는 서버 생성 기능 연동 후 제공됩니다.");
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold text-t3">관리업무 · 지침·부과</p>
        <h1 className="mt-1 text-2xl font-extrabold text-t1">
          전기·수도·가스 지침·부과
        </h1>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-64">
            <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
            <Select
              aria-label="건물 선택"
              value={buildingId?.toString() ?? ""}
              onChange={(event) => selectBuilding(event.target.value)}
              disabled={buildingsQuery.isLoading}
              options={[
                { value: "", label: buildingsQuery.isLoading ? "건물 불러오는 중" : "건물을 선택해 주세요" },
                ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
              ]}
            />
          </label>

          <div className="min-w-72 flex-1">
            <span className="mb-1.5 block text-xs font-bold text-t2">유형</span>
            <Tabs tabs={TYPE_TABS} active={utilityType} onChange={selectUtilityType} />
          </div>

          <div className="flex w-full flex-wrap justify-end gap-2 xl:w-auto">
            <Button
              variant="ghost"
              onClick={() => setPriceModalOpen(true)}
              disabled={!buildingId}
            >
              단가 설정
            </Button>
            <Button variant="ghost" onClick={openHistory} disabled={!buildingId}>
              6개월 이력
            </Button>
            <Button variant="ghost" onClick={exportLedger} disabled={!buildingId}>
              검침대장 다운
            </Button>
            <Button
              onClick={calculateCharges}
              disabled={!buildingId || rows.length === 0 || saveMeter.isPending}
            >
              부과 계산
            </Button>
          </div>
        </div>

        {buildingId && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line2 pt-4">
            <label className="flex items-center gap-2 text-xs font-bold text-t2">
              신규 입주 강조 기준일
              <input
                aria-label="신규 입주 강조 기준일"
                type="date"
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-t1 focus:border-blue focus:outline-none"
              />
            </label>
            <span className="text-xs text-t3">기준일 전후 1개월 입주 세대를 강조합니다.</span>
          </div>
        )}
      </section>

      {buildingsQuery.error && (
        <section className="rounded-2xl border border-red/20 bg-red-t p-6 text-center">
          <p className="text-sm font-semibold text-red">건물 목록을 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="ghost" onClick={() => buildingsQuery.refetch()}>
            다시 시도
          </Button>
        </section>
      )}

      {!buildingId && !buildingsQuery.error && (
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState message="건물을 선택해 주세요" />
        </section>
      )}

      {buildingId && rowsQuery.isLoading && (
        <section className="rounded-2xl border border-line bg-surface py-16 shadow-card">
          <Spinner />
          <p className="text-center text-sm text-t3">세대 목록을 불러오는 중입니다.</p>
        </section>
      )}

      {buildingId && rowsQuery.error && (
        <section className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">
            오류가 발생했습니다. 다시 시도해 주세요.
          </p>
          <Button className="mt-3" variant="ghost" onClick={() => rowsQuery.refetch()}>
            다시 시도
          </Button>
        </section>
      )}

      {buildingId && !rowsQuery.isLoading && !rowsQuery.error && rows.length === 0 && (
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState message="등록된 세대가 없습니다" />
        </section>
      )}

      {buildingId && !rowsQuery.isLoading && !rowsQuery.error && rows.length > 0 && (
        <>
          <UtilitySummaryCards
            total={rows.length}
            completed={completed}
            missing={Math.max(0, activeRows.length - completed)}
            expectedCharge={expectedCharge}
          />

          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line2 px-5 py-4">
              <h2 className="text-base font-extrabold text-t1">
                세대별 {TYPE_LABELS[utilityType]} 지침
              </h2>
              <span className="rounded-lg bg-blue-t px-2.5 py-1 text-xs font-bold text-blue-d">
                {referenceDate.slice(0, 4)}년 {Number(referenceDate.slice(5, 7))}월
              </span>
              <span className="ml-auto text-xs text-t3">
                행을 클릭하면 6개월 이력을 확인할 수 있습니다.
              </span>
            </div>
            <div className="border-b border-line2 bg-amber-t px-5 py-3 text-xs font-semibold text-t2">
              단가가 설정된 세대는 부과 계산 시 자동요금이 저장됩니다. 단가를 해석할 수 없는 세대는 수동 입력 요금을 사용해 주세요.
            </div>
            <UtilityTable
              rows={rows}
              drafts={scopedDrafts}
              referenceDate={referenceDate}
              onDraftChange={updateDraft}
              onRowClick={setHistoryRow}
              onDiscountClick={utilityType === "water" ? setDiscountRow : undefined}
            />
          </section>
        </>
      )}

      <UtilityHistoryModal
        open={historyRow !== null}
        row={historyRow}
        utilityType={utilityType}
        referenceDate={referenceDate}
        onClose={() => setHistoryRow(null)}
      />

      {discountRow && (
        <WaterDiscountModal
          open
          row={discountRow}
          onClose={() => setDiscountRow(null)}
        />
      )}

      <UnitPriceModal
        open={priceModalOpen}
        buildingId={buildingId}
        utilityType={utilityType}
        onClose={() => setPriceModalOpen(false)}
      />
    </div>
  );
}
