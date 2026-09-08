"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  customerNumberKeys,
  listCustomerNumbersByBuilding,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useFixedUsages,
  useSaveMeterReadings,
  useUtilityRows,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { CarryOverDialog } from "./components/gas/CarryOverDialog";
import { GasAccountSummary } from "./components/gas/GasAccountSummary";
import { GasBillingToolbar } from "./components/gas/GasBillingToolbar";
import { GasBuildingPanel } from "./components/gas/GasBuildingPanel";
import { GasReadingsTable } from "./components/gas/GasReadingsTable";
import { GasWorkspaceHeader } from "./components/gas/GasWorkspaceHeader";
import type { GasTableRow, GasUtilityDraft } from "./components/gas/types";
import { FixedUsageModal } from "./components/FixedUsageModal";
import { GasLedgerModal } from "./components/GasLedgerModal";

function billingMonth(): { year: number; month: number } {
  const value = new Date();
  value.setDate(1);
  value.setMonth(value.getMonth() - 1);
  return { year: value.getFullYear(), month: value.getMonth() + 1 };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthEnd(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
}

function initialDraft(row: UtilityUnitRow): GasUtilityDraft {
  return {
    currentReading: row.currentReading === null ? "" : String(row.currentReading),
    manualCharge: row.manualCharge === null ? "" : String(row.manualCharge),
    note: row.note ?? "",
  };
}

function SelectionPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-center ${compact ? "h-[150px]" : "min-h-0 flex-1"}`}>
      <div>
        <p className="text-[13px] font-extrabold text-t2">건물을 선택해 주세요</p>
        <p className="mt-1.5 text-[11.5px] font-medium text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
      </div>
    </div>
  );
}

export default function GasUtilitiesWorkspace() {
  const initialMonth = useMemo(() => billingMonth(), []);
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, GasUtilityDraft>>({});
  const [fixedUsageRow, setFixedUsageRow] = useState<GasTableRow | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);

  const period = `${year}-${pad(month)}-01`;
  const referenceDate = monthEnd(year, month);
  const rowsQuery = useUtilityRows(buildingId, "gas", period);
  const fixedUsagesQuery = useFixedUsages(buildingId, "gas");
  const saveMeter = useSaveMeterReadings();
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const customerNumberQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: customerNumberKeys.byBuilding(building.id),
      queryFn: () => listCustomerNumbersByBuilding(building.id),
    })),
  });
  const gasCustomerNumberCounts = Object.fromEntries(buildings.map((building, index) => [
    building.id,
    (customerNumberQueries[index]?.data ?? []).filter((item) => item.kind === "gas").length,
  ]));
  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const scopeKey = `${buildingId ?? "none"}:gas:${period}`;

  const rows = useMemo<GasTableRow[]>(() => {
    const fixedByUnit = new Map((fixedUsagesQuery.data ?? []).map((item) => [item.unitId, item]));
    return (rowsQuery.data ?? []).map((row) => ({
      ...row,
      fixedUsage: fixedByUnit.get(row.unitId)?.fixedUsage ?? null,
      fixedUsageFrom: fixedByUnit.get(row.unitId)?.fromMonth ?? null,
    }));
  }, [fixedUsagesQuery.data, rowsQuery.data]);

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.unitId, row])), [rows]);
  const scopedDrafts = useMemo<Record<number, GasUtilityDraft>>(
    () => Object.fromEntries(rows.map((row) => [
      row.unitId,
      drafts[`${scopeKey}:${row.unitId}`] ?? initialDraft(row),
    ])),
    [drafts, rows, scopeKey],
  );
  const rowsLoading = rowsQuery.isLoading || fixedUsagesQuery.isLoading;
  const rowsError = rowsQuery.error ?? fixedUsagesQuery.error;

  const updateDraft = useCallback((unitId: number, patch: Partial<GasUtilityDraft>) => {
    const row = rowsById.get(unitId);
    if (!row) return;
    const key = `${scopeKey}:${unitId}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? initialDraft(row)), ...patch },
    }));
  }, [rowsById, scopeKey]);

  if (me === undefined) return null;

  const selectBuilding = (id: number) => {
    if (editing) return;
    setBuildingId(id);
    setFixedUsageRow(null);
  };

  const resetScopeDrafts = () => {
    setDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${scopeKey}:`)),
    ));
  };

  const calculate = () => {
    if (rows.every((row) => row.fixedUsage === null && scopedDrafts[row.unitId].currentReading.trim() === "")) {
      toast.error("입력된 당월 지침이 없습니다.");
      return;
    }
    toast.success("가스 요금을 계산했습니다.");
  };

  const save = () => {
    if (buildingId === null) return;
    const payloadRows = rows
      .filter((row) => row.fixedUsage !== null || scopedDrafts[row.unitId].currentReading.trim() !== "")
      .map((row) => ({
        unit_id: row.unitId,
        ...(row.fixedUsage === null ? { current_reading: scopedDrafts[row.unitId].currentReading.trim() } : {}),
        manual_charge: scopedDrafts[row.unitId].manualCharge.trim(),
        note: scopedDrafts[row.unitId].note.trim(),
      }));

    if (payloadRows.length === 0) {
      toast.error("저장할 가스 지침이 없습니다.");
      return;
    }

    saveMeter.mutate(
      { buildingId, utilityType: "gas", period, rows: payloadRows },
      {
        onSuccess: (result) => {
          toast.success(`${result.saved}개 호실의 가스 지침을 저장했습니다.`);
          setEditing(false);
        },
        onError: () => toast.error("가스 지침 저장에 실패했습니다."),
      },
    );
  };

  const confirmCarryOver = () => {
    if (buildingId === null) {
      toast.info("이월할 건물을 먼저 선택해 주세요.");
      setCarryOverOpen(false);
      return;
    }
    const carryRows = rows.filter((row) => (
      row.fixedUsage === null
      && row.previousReading !== null
      && scopedDrafts[row.unitId].currentReading.trim() === ""
    ));
    setDrafts((current) => {
      const next = { ...current };
      carryRows.forEach((row) => {
        const key = `${scopeKey}:${row.unitId}`;
        next[key] = { ...(current[key] ?? initialDraft(row)), currentReading: String(row.previousReading) };
      });
      return next;
    });
    setEditing(true);
    setCarryOverOpen(false);
    toast.success(`${carryRows.length}개 호실을 이월했습니다.`);
  };

  return (
    <div className="flex h-screen min-h-[700px] flex-col overflow-hidden bg-[#e7eaee]">
      <GasWorkspaceHeader
        onOpenLedger={() => {
          if (buildings.length === 0) toast.info("출력할 건물이 없습니다.");
          else setLedgerOpen(true);
        }}
        onOpenCarryOver={() => setCarryOverOpen(true)}
      />

      {!hasModule(me, "utilities") ? (
        <div className="p-6">
          <EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" />
        </div>
      ) : (
        <main className="flex min-h-0 flex-1 gap-4 p-6 pt-[22px]">
          <GasBuildingPanel
            buildings={buildings}
            selectedBuildingId={buildingId}
            gasCustomerNumberCounts={gasCustomerNumberCounts}
            year={year}
            month={month}
            disabled={editing}
            search={search}
            onSearchChange={setSearch}
            onYearChange={(value) => !editing && setYear(value)}
            onMonthChange={(value) => !editing && setMonth(value)}
            onSelect={selectBuilding}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {selectedBuilding ? (
              <GasBillingToolbar
                buildingName={selectedBuilding.name}
                periodLabel={`${year}년 ${month}월분`}
                chargeStartDate={`${year}-${pad(month)}-01`}
                chargeEndDate={monthEnd(year, month)}
                editing={editing}
                pending={saveMeter.isPending}
                onEdit={() => setEditing(true)}
                onCalculate={calculate}
                onSave={save}
                onCancel={() => {
                  resetScopeDrafts();
                  setEditing(false);
                }}
              />
            ) : (
              <div className="h-[52px] shrink-0 rounded-xl border border-line bg-white shadow-card" />
            )}

            {!selectedBuilding ? (
              <>
                <section className="h-[150px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-card">
                  <SelectionPlaceholder compact />
                </section>
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
                  <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
                    <h2 className="text-[15px] font-extrabold text-t1">호실별 가스 지침</h2>
                    <div className="ml-auto flex items-center gap-4 text-[11.5px] font-medium text-t3">
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-blue" />퇴실 예정</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-red" />공실 사용량</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-green" />최근 입주</span>
                    </div>
                  </div>
                  <SelectionPlaceholder />
                </section>
              </>
            ) : rowsLoading ? (
              <section className="flex min-h-0 flex-1 flex-col justify-center rounded-2xl bg-white shadow-card">
                <Spinner />
                <p className="mt-2 text-center text-[12px] text-t3">가스 지침을 불러오는 중입니다.</p>
              </section>
            ) : rowsError ? (
              <section className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-red/20 bg-red-t text-[13px] font-bold text-red">
                가스 지침을 불러오지 못했습니다.
              </section>
            ) : (
              <>
                <GasAccountSummary rows={rows} drafts={scopedDrafts} editing={editing} />
                <GasReadingsTable
                  rows={rows}
                  drafts={scopedDrafts}
                  editing={editing}
                  referenceDate={referenceDate}
                  chargeStartDate={`${year}-${pad(month)}-01`}
                  chargeEndDate={monthEnd(year, month)}
                  onDraftChange={updateDraft}
                  onOpenFixedUsage={setFixedUsageRow}
                />
              </>
            )}
          </div>
        </main>
      )}

      <CarryOverDialog
        open={carryOverOpen}
        year={year}
        month={month}
        onClose={() => setCarryOverOpen(false)}
        onConfirm={confirmCarryOver}
      />

      {ledgerOpen && buildings.length > 0 && (
        <GasLedgerModal
          open
          buildings={buildings.map((building) => ({
            id: building.id,
            code: building.code,
            name: building.name,
            address: building.address,
            entrancePassword: building.entrancePassword,
            contactPhone: building.ownerPhone,
            cleaningMemo: building.facilities?.cleaning?.memo,
            gasCustomerNumberCount: gasCustomerNumberCounts[building.id] ?? 0,
          }))}
          currentBuildingId={buildingId ?? buildings[0].id}
          period={period}
          onClose={() => setLedgerOpen(false)}
        />
      )}

      {fixedUsageRow && buildingId !== null && (
        <FixedUsageModal
          key={`${fixedUsageRow.unitId}:${fixedUsageRow.fixedUsage ?? "none"}`}
          open
          buildingId={buildingId}
          unitId={fixedUsageRow.unitId}
          unitNo={fixedUsageRow.unitNo}
          utility="gas"
          currentFixedUsage={fixedUsageRow.fixedUsage}
          currentFixedUsageFrom={fixedUsageRow.fixedUsageFrom}
          onSaved={() => {
            setFixedUsageRow(null);
            fixedUsagesQuery.refetch();
          }}
          onClose={() => setFixedUsageRow(null)}
        />
      )}
    </div>
  );
}
