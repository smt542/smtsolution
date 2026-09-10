"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { MenuIcon, PrinterIcon } from "@/components/icons";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  customerNumberKeys,
  listCustomerNumbersByBuilding,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useBillingPeriod,
  useFixedUsages,
  useSaveMeterReadings,
  useUtilityRows,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingSelectionRail } from "./components/BuildingSelectionRail";
import {
  BillingBasisRequiredState,
  hasBillingBasis,
  isPrototypeFuturePeriod,
} from "./components/BillingBasisRequiredState";
import { CarryOverConfirmModal } from "./components/CarryOverConfirmModal";
import { FixedUsageModal } from "./components/FixedUsageModal";
import { MeterLedgerModal } from "./components/MeterLedgerModal";
import { UnitPriceModal } from "./components/UnitPriceModal";
import { UtilityAccountSummary } from "./components/UtilityAccountSummary";
import { UtilityPeriodBarPlaceholder } from "./components/UtilityPeriodBarPlaceholder";
import { UtilityTable, type UtilityDraft, type UtilityTableRow } from "./components/UtilityTable";
import { UtilityWorkspaceBar } from "./components/UtilityWorkspaceBar";
import { WaterDiscountModal } from "./components/WaterDiscountModal";

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

function utilityTypeFromLocation(): UtilityType {
  const type = new URLSearchParams(window.location.search).get("type");
  return type === "electricity" || type === "gas" ? type : "water";
}

function localDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function periodDate(year: number, month: number): string {
  return localDateString(new Date(year, month - 1, 1));
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

function initialDraft(row: UtilityUnitRow): UtilityDraft {
  return {
    previousReading: row.previousReading === null ? "" : String(row.previousReading),
    currentReading: row.currentReading === null ? "" : String(row.currentReading),
    usage: row.usage === null ? "" : String(row.usage),
    manualCharge: row.manualCharge === null ? "" : String(row.manualCharge),
    note: row.note ?? "",
  };
}

function UnselectedWorkspace({ period }: { period: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <UtilityPeriodBarPlaceholder period={period} />
      <section className="grid h-[150px] place-items-center rounded-[16px] bg-white shadow-card">
        <div className="text-center"><p className="text-[15px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p><p className="mt-[5px] text-[13px] leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p></div>
      </section>
      <section className="grid min-h-[360px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
        <div className="text-center"><p className="text-[16px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p><p className="mt-1.5 text-[13px] leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p></div>
      </section>
    </div>
  );
}

export function WaterUtilitiesScreen({ initialType = "water" }: { initialType?: UtilityType }) {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [utilityType, setUtilityType] = useState<UtilityType>(initialType);
  const [referenceDate, setReferenceDate] = useState("2026-07-01");
  const [drafts, setDrafts] = useState<Record<string, UtilityDraft>>({});
  const [selectedRow, setSelectedRow] = useState<UtilityUnitRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [discountRow, setDiscountRow] = useState<UtilityUnitRow | null>(null);
  const [fixedUsageRow, setFixedUsageRow] = useState<UtilityTableRow | null>(null);

  const year = Number(referenceDate.slice(0, 4));
  const month = Number(referenceDate.slice(5, 7));
  const period = `${referenceDate.slice(0, 7)}-01`;
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const rowsQuery = useUtilityRows(buildingId, utilityType, period);
  const fixedUsagesQuery = useFixedUsages(buildingId, utilityType);
  const billingPeriodQuery = useBillingPeriod(buildingId, period);
  const saveMeter = useSaveMeterReadings();
  const customerNumberQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: customerNumberKeys.byBuilding(building.id),
      queryFn: () => listCustomerNumbersByBuilding(building.id),
    })),
  });
  const waterCustomerNumberCounts = Object.fromEntries(buildings.map((building, index) => [
    building.id,
    (customerNumberQueries[index]?.data ?? []).filter((item) => item.kind === "water").length,
  ]));

  const rows = useMemo<UtilityTableRow[]>(() => {
    const fixed = new Map((fixedUsagesQuery.data ?? []).map((row) => [row.unitId, row]));
    return (rowsQuery.data ?? []).map((row) => ({
      ...row,
      fixedUsage: fixed.get(row.unitId)?.fixedUsage ?? null,
      ...(utilityType === "gas" ? { fixedUsageFrom: fixed.get(row.unitId)?.fromMonth ?? null } : {}),
    }));
  }, [fixedUsagesQuery.data, rowsQuery.data, utilityType]);
  const scopeKey = `${buildingId ?? "none"}:${utilityType}:${period}`;
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.unitId, row])), [rows]);
  const scopedDrafts = useMemo<Record<number, UtilityDraft>>(
    () => Object.fromEntries(rows.map((row) => [row.unitId, drafts[`${scopeKey}:${row.unitId}`] ?? initialDraft(row)])),
    [drafts, rows, scopeKey],
  );
  const activeRows = useMemo(() => rows.filter((row) => !isVacant(row)), [rows]);
  const effectiveSelectedRow = rows.find((row) => row.unitId === selectedRow?.unitId) ?? rows[0] ?? null;
  const loadingRows = rowsQuery.isLoading || fixedUsagesQuery.isLoading;
  const rowsError = rowsQuery.error ?? fixedUsagesQuery.error;
  const needsBasis = buildingId !== null
    && !billingPeriodQuery.isLoading
    && isPrototypeFuturePeriod(period)
    && !hasBillingBasis(
      billingPeriodQuery.data?.chargeStartDate,
      billingPeriodQuery.data?.chargeEndDate,
    );

  useEffect(() => {
    const handleTypeChange = (event: Event) => {
      const next = (event as CustomEvent<UtilityType>).detail;
      if (!TYPE_LABELS[next]) return;
      setUtilityType(next);
      setSelectedRow(null);
      setEditing(false);
    };
    window.addEventListener("utilities:type-change", handleTypeChange);
    const initialSync = window.setTimeout(() => {
      handleTypeChange(new CustomEvent("utilities:type-change", { detail: utilityTypeFromLocation() }));
    }, 0);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("utilities:type-change", handleTypeChange);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("utilities:type-change", { detail: utilityType }));
  }, [utilityType]);

  const updateDraft = useCallback((unitId: number, patch: Partial<UtilityDraft>) => {
    const row = rowsById.get(unitId);
    if (!row) return;
    const key = `${scopeKey}:${unitId}`;
    setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft(row)), ...patch } }));
  }, [rowsById, scopeKey]);

  if (me === undefined) return null;
  if (!hasModule(me, "utilities")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" /></div>;
  }

  const selectBuilding = (id: number) => {
    setBuildingId(id);
    setSelectedRow(null);
    setEditing(false);
    setPriceModalOpen(false);
    setDiscountRow(null);
    setFixedUsageRow(null);
  };

  const saveReadings = (finishEditing: boolean) => {
    if (buildingId === null) return;
    const payloadRows = activeRows
      .map((row) => ({ row, draft: scopedDrafts[row.unitId] }))
      .filter(({ row, draft }) => (
        row.fixedUsage !== null
        || draft.previousReading.trim() !== initialDraft(row).previousReading
        || draft.currentReading.trim() !== ""
        || draft.usage.trim() !== ""
        || draft.manualCharge.trim() !== ""
        || draft.note.trim() !== ""
      ))
      .map(({ row, draft }) => ({
        unit_id: row.unitId,
        ...(draft.previousReading.trim() === "" ? {} : { previous_reading: draft.previousReading.trim() }),
        ...(draft.currentReading.trim() === "" ? {} : { current_reading: draft.currentReading.trim() }),
        ...(draft.usage.trim() === "" ? {} : { usage: draft.usage.trim() }),
        manual_charge: draft.manualCharge.trim(),
        note: draft.note.trim(),
      }));
    if (payloadRows.length === 0) {
      if (finishEditing) {
        setEditing(false);
        return;
      }
      toast.error("입력된 검침 정보가 없습니다.");
      return;
    }
    saveMeter.mutate(
      { buildingId, utilityType, period, rows: payloadRows },
      {
        onSuccess: (result) => {
          toast.success(`${result.saved}개 호실의 검침을 저장했습니다.`);
          if (finishEditing) setEditing(false);
        },
        onError: () => toast.error("검침 저장에 실패했습니다."),
      },
    );
  };

  const carryOver = () => {
    if (buildingId !== null) {
      const target = new Date(year, month, 1);
      const nextPeriod = periodDate(target.getFullYear(), target.getMonth() + 1);
      const nextScope = `${buildingId}:${utilityType}:${nextPeriod}`;
      setDrafts((current) => {
        const next = { ...current };
        activeRows.forEach((row) => {
          const source = scopedDrafts[row.unitId];
          const carried = source.currentReading.trim() || (row.previousReading === null ? "" : String(row.previousReading));
          next[`${nextScope}:${row.unitId}`] = {
            previousReading: carried,
            currentReading: carried,
            usage: "0",
            manualCharge: "",
            note: "",
          };
        });
        return next;
      });
      setReferenceDate(nextPeriod);
    }
    setCarryOpen(false);
    setEditing(false);
    toast.success(`${year}년 ${month}월분을 다음 달로 이월했습니다.`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-[62px] shrink-0 items-center border-b border-line bg-white px-5 md:px-6">
        <button type="button" aria-label="메뉴 열기" onClick={() => window.dispatchEvent(new Event("app-shell:open-menu"))} className="mr-3 grid size-8 place-items-center rounded-lg text-t2 hover:bg-bg"><MenuIcon className="size-5" /></button>
        <div><p className="text-[10px] font-semibold text-t3">공과금 관리</p><h1 className="mt-0.5 text-[18px] font-extrabold leading-5 text-t1">{TYPE_LABELS[utilityType]}</h1></div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setLedgerOpen(true)} className="flex h-10 items-center gap-1.5 rounded-[11px] border border-line bg-white px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"><PrinterIcon /> 검침대장 출력</button>
          <button type="button" onClick={() => setCarryOpen(true)} className="h-10 rounded-[11px] bg-blue px-[15px] text-[13.5px] font-bold text-white hover:bg-blue-d">전체 이월</button>
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-62px)] grid-cols-1 items-stretch gap-4 p-4 min-[1101px]:grid-cols-[minmax(0,322px)_minmax(0,1fr)] min-[1101px]:overflow-hidden min-[1101px]:p-[22px_24px_24px]">
        <BuildingSelectionRail
          buildings={buildings}
          buildingId={buildingId}
          selectedRow={effectiveSelectedRow}
          utilityType={utilityType}
          period={period}
          year={year}
          month={month}
          customerNumberCounts={waterCustomerNumberCounts}
          disabled={editing}
          loading={buildingsQuery.isLoading}
          onBuildingChange={selectBuilding}
          onPeriodChange={(nextYear, nextMonth) => {
            setReferenceDate(periodDate(nextYear, nextMonth));
            setSelectedRow(null);
            setEditing(false);
          }}
        />

        {!buildingId ? <UnselectedWorkspace period={period} /> : (
          <div className="flex min-h-[650px] min-w-0 flex-1 flex-col gap-4 min-[1101px]:min-h-0">
            {selectedBuilding && (
              <UtilityWorkspaceBar
                key={`${buildingId}:${period}`}
                buildingId={buildingId}
                buildingName={selectedBuilding.name}
                period={period}
                editing={editing}
                canEdit
                saving={saveMeter.isPending}
                onEditingChange={setEditing}
                onCalculate={() => saveReadings(false)}
                onSave={() => saveReadings(true)}
              />
            )}

            {loadingRows || billingPeriodQuery.isLoading ? (
              <section className="grid flex-1 place-items-center rounded-xl border border-line bg-white"><div><Spinner /><p className="mt-2 text-[12px] text-t3">호실 정보를 불러오는 중입니다.</p></div></section>
            ) : rowsError || billingPeriodQuery.error ? (
              <section className="grid flex-1 place-items-center rounded-xl border border-red/20 bg-red-t text-center"><div><p className="text-[13px] font-bold text-red">호실 정보를 불러오지 못했습니다.</p><button type="button" onClick={() => { rowsQuery.refetch(); fixedUsagesQuery.refetch(); }} className="mt-3 h-8 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-t2">다시 시도</button></div></section>
            ) : (
              <>
                <UtilityAccountSummary rows={rows} selectedRow={effectiveSelectedRow} editing={editing} onSelect={setSelectedRow} />
                <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
                  <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
                    <h2 className="text-[15px] font-extrabold text-t1">호실별 {TYPE_LABELS[utilityType]} 지침</h2>
                    <div className="ml-auto flex items-center gap-3 text-[11.5px] font-medium text-t3">
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
                      {editing && <button type="button" onClick={() => setPriceModalOpen(true)} className="ml-1 rounded-md border border-line px-2 py-1 text-t2 hover:bg-bg">단가 설정</button>}
                    </div>
                  </div>
                  {needsBasis ? (
                    <BillingBasisRequiredState onEdit={() => setEditing(true)} />
                  ) : rows.length === 0 ? <div className="grid flex-1 place-items-center text-[13px] text-t3">등록된 호실이 없어요.</div> : (
                    <UtilityTable rows={rows} drafts={scopedDrafts} referenceDate={referenceDate} editing={editing} selectedRowId={effectiveSelectedRow?.unitId} onDraftChange={updateDraft} onRowClick={setSelectedRow} onDiscountClick={utilityType === "water" ? setDiscountRow : undefined} onFixedUsageClick={setFixedUsageRow} />
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {ledgerOpen && (
        <MeterLedgerModal
          open
          buildings={buildings}
          currentBuildingId={buildingId}
          period={period}
          utilityType="water"
          onClose={() => setLedgerOpen(false)}
          onPrinted={() => {
            setLedgerOpen(false);
            toast.success("검침대장 출력 처리되었습니다.");
          }}
        />
      )}
      <CarryOverConfirmModal open={carryOpen} year={year} month={month} onCancel={() => setCarryOpen(false)} onConfirm={carryOver} />
      <UnitPriceModal open={priceModalOpen} buildingId={buildingId} utilityType={utilityType} onClose={() => setPriceModalOpen(false)} />
      {discountRow && <WaterDiscountModal open buildingId={buildingId as number} period={period} row={discountRow} onClose={() => setDiscountRow(null)} />}
      {fixedUsageRow && buildingId !== null && <FixedUsageModal open buildingId={buildingId} unitId={fixedUsageRow.unitId} unitNo={fixedUsageRow.unitNo} utility={utilityType} currentFixedUsage={fixedUsageRow.fixedUsage} currentFixedUsageFrom={utilityType === "gas" ? fixedUsageRow.fixedUsageFrom ?? null : undefined} onSaved={() => setFixedUsageRow(null)} onClose={() => setFixedUsageRow(null)} />}
    </div>
  );
}
