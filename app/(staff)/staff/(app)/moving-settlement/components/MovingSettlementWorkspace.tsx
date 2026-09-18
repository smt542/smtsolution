"use client";

import { useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import { useBuildings, type Building } from "@/hooks/reactquery/buildings";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import {
  calculateSettlementAmount,
  useSettlementContext,
  type SaveSettlementInput,
  type SettlementContext,
} from "@/hooks/reactquery/movingSettlement";
import { useManagementFeeRows } from "@/hooks/reactquery/movingSettlement/feeItemCharges";
import { useUnits } from "@/hooks/reactquery/units";
import { MeterInfoPanel } from "./MeterInfoPanel";
import { SettlementActions } from "./SettlementActions";
import { SettlementDirectoryRail } from "./SettlementDirectoryRail";
import { SettlementEmptyPanel } from "./SettlementEmptyPanel";
import { SettlementForm } from "./SettlementForm";
import { SettlementHistory } from "./SettlementHistory";
import type { SettlementStatementPrintModel } from "./movingSettlementPrint";
import { reflectedUtilityCharges } from "./settlement-form/UtilitySettlementSection";

function draftFromContext(
  context: SettlementContext,
  forceNew = false,
): MovingSettlementValues {
  // 마이그 0165 로 get_settlement_context 가 p_settlement_id 를 받는다.
  // 선택 건을 지정해 조회하므로 latestSettlement 가 곧 화면에 열린 그 정산이다.
  const saved = forceNew ? null : context.latestSettlement;

  return {
    moveOutDate: saved?.moveOutDate ?? "",
    mgmtFeeMonthly: saved?.mgmtFeeMonthly ?? null,
    mgmtFeeProrated: saved?.mgmtFeeProrated ?? null,
    waterCharge: saved?.waterCharge ?? null,
    elecCharge: saved?.elecCharge ?? null,
    gasCharge: saved?.gasCharge ?? null,
    elecPaidDate: saved?.elecPaidDate ?? "",
    gasPaidDate: saved?.gasPaidDate ?? "",
    repairAmount: saved?.repairAmount ?? null,
    repairAttribution: saved?.repairAttribution ?? null,
    repairMemo: saved?.repairMemo ?? "",
    settleBank: saved?.settleBank ?? context.settleAccount.settleBank ?? "",
    settleAcct: saved?.settleAcct ?? context.settleAccount.settleAcct ?? "",
    settleHolder:
      saved?.settleHolder ?? context.settleAccount.settleHolder ?? "",
    note: saved?.note ?? "",
    settlementNote:
      saved?.settlementNote ?? context.occupancy?.settlementNote ?? "",
  };
}

function nullableText(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function SettlementEditor({
  building,
  context,
  occupancy,
  forceNew,
  onDeleted,
}: {
  building: Building;
  context: SettlementContext;
  occupancy: NonNullable<SettlementContext["occupancy"]>;
  forceNew: boolean;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(() => draftFromContext(context, forceNew));
  // 정산 체크는 항목별 메모가 본문이고 checked 는 "메모가 비어있지 않음" 으로 파생된다(0172).
  // note 가 없는데 checked 인 행(모바일 체크박스로만 켠 경우)은 기존 표시대로 '확인' 으로 읽는다.
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      context.checklist.map((item) => [
        item.id,
        item.note ?? (item.checked ? "확인" : ""),
      ]),
    ),
  );
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [finalPaidDate, setFinalPaidDate] = useState("");
  const [activeSettlementId, setActiveSettlementId] = useState<number | null>(
    forceNew ? null : (context.latestSettlement?.id ?? null),
  );
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const { data: me } = useMe();
  const { data: organizationName } = useBillOrganizationName(me?.orgId);
  const managementFeeRows = useManagementFeeRows(
    building.typeId,
    context.unit.id,
    draft.moveOutDate,
  );

  const reflectedCharges = reflectedUtilityCharges(
    context.meterSummary,
    context.settlementSettings,
  );
  const meterRows: SettlementStatementPrintModel["meters"] =
    (["water", "elec", "gas"] as const).map((utility) => {
      const meter = context.meterSummary.find((item) => item.utility === utility);
      const chargeKey =
        utility === "water"
          ? "waterCharge"
          : utility === "elec"
            ? "elecCharge"
            : "gasCharge";
      return {
        utility,
        previousReading: meter?.previousReading ?? null,
        currentReading: meter?.currentReading ?? null,
        usage: meter?.usage ?? null,
        unitPrice: meter?.unitPrice ?? null,
        charge: reflectedCharges[chargeKey] ?? draft[chargeKey] ?? null,
      };
    });
  const utilityTotal = meterRows.reduce(
    (sum, meter) => sum + (meter.charge ?? 0),
    0,
  );
  const managementMonthlyTotal = managementFeeRows.rows.reduce(
    (sum, row) => sum + row.charge,
    0,
  );
  const managementSettlementTotal = managementFeeRows.rows.reduce(
    (sum, row) => sum + row.settlement,
    0,
  );
  const repairAmount = draft.repairAmount ?? null;
  const cleaningCost = context.latestSettlement?.cleaningCost ?? null;
  const billingUnpaid = context.billingUnpaid;
  const total =
    utilityTotal +
    managementSettlementTotal +
    (repairAmount ?? 0) +
    billingUnpaid +
    (cleaningCost ?? 0);
  // 정본 표기: `농협 352-1234-5678-91 · (주)스마일종합관리` — 은행·계좌는 공백, 예금주 앞만 구분점.
  const settleAccount = [
    [draft.settleBank, draft.settleAcct]
      .map((value) => value?.trim() ?? "")
      .filter(Boolean)
      .join(" "),
    draft.settleHolder?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  const printModel: SettlementStatementPrintModel = {
    moveOutDate: draft.moveOutDate,
    buildingName: context.unit.buildingName,
    unitNo: context.unit.unitNo,
    ownerPhone: building.ownerPhone,
    address: building.address,
    occupantPhone: occupancy.phone,
    meters: meterRows,
    chargeDays: draft.moveOutDate
      ? Number(draft.moveOutDate.slice(8, 10)) || 0
      : null,
    monthDays: draft.moveOutDate ? 30 : null,
    utilityTotal,
    managementRows: managementFeeRows.rows.map((row) => ({
      name: row.item.name,
      charge: row.charge,
      settlement: row.settlement,
    })),
    managementMonthlyTotal,
    managementSettlementTotal,
    repairMemo: draft.repairMemo || null,
    repairAmount,
    billingUnpaid,
    cleaningCost,
    total,
    settleAccount: settleAccount || null,
    note: draft.note || null,
    checklist: context.checklist.map((item) => ({
      label: item.label,
      note: item.note,
    })),
    organizationName: organizationName ?? null,
  };

  const saveInput: SaveSettlementInput = {
    unitId: context.unit.id,
    occupancyId: occupancy.id,
    settlementId: activeSettlementId,
    data: {
      moveOutDate: draft.moveOutDate,
      mgmtFeeMonthly: draft.mgmtFeeMonthly,
      mgmtFeeProrated: draft.mgmtFeeProrated,
      waterCharge: draft.waterCharge,
      elecCharge: draft.elecCharge,
      gasCharge: draft.gasCharge,
      elecPaidDate: nullableText(draft.elecPaidDate),
      gasPaidDate: nullableText(draft.gasPaidDate),
      repairAmount: draft.repairAmount,
      repairAttribution: draft.repairAttribution,
      repairMemo: nullableText(draft.repairMemo),
      settleBank: nullableText(draft.settleBank),
      settleAcct: nullableText(draft.settleAcct),
      settleHolder: nullableText(draft.settleHolder),
      note: nullableText(draft.note),
      settlementNote: nullableText(draft.settlementNote),
    },
    checklist: context.checklist.map((item) => {
      const note = (notes[item.id] ?? "").trim();
      return { checkItemId: item.id, checked: note !== "", note };
    }),
  };

  const amount = calculateSettlementAmount(draft);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <SettlementForm
        buildingName={building.name}
        buildingTypeId={building.typeId}
        unitId={context.unit.id}
        unitNo={context.unit.unitNo}
        contactPhone={occupancy.phone ?? ""}
        value={draft}
        onChange={setDraft}
        meters={context.meterSummary}
        settings={context.settlementSettings}
        checklist={context.checklist}
        notes={notes}
        onChecklistNoteChange={(id, next) =>
          setNotes((current) => ({ ...current, [id]: next }))
        }
        receivedAmount={receivedAmount}
        onReceivedAmountChange={setReceivedAmount}
        finalPaidDate={finalPaidDate}
        onFinalPaidDateChange={setFinalPaidDate}
        paymentInputRef={paymentInputRef}
      />
      <SettlementActions
        building={building}
        unit={context.unit}
        occupancy={occupancy}
        draft={draft}
        input={saveInput}
        settlementId={activeSettlementId}
        amount={amount}
        receivedAmount={receivedAmount}
        billingUnpaid={context.billingUnpaid}
        vacancyPaymentMode={context.settlementSettings.vacancyPaymentMode}
        createdAt={context.latestSettlement?.createdAt ?? null}
        printModel={printModel}
        paymentInputRef={paymentInputRef}
        onSaved={setActiveSettlementId}
        onDeleted={() => {
          setActiveSettlementId(null);
          onDeleted();
        }}
      />
    </div>
  );
}

export function MovingSettlementWorkspace() {
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(
    null,
  );
  const [editorVersion, setEditorVersion] = useState(0);
  const unitsQuery = useUnits(buildingId ?? 0);
  const contextQuery = useSettlementContext(unitId, selectedSettlementId);

  const buildings = useMemo(
    () => buildingsQuery.data ?? [],
    [buildingsQuery.data],
  );
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const context = unitId === null ? undefined : contextQuery.data;
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;
  const isSettlementWorkspaceRefreshing =
    [buildingsQuery, unitsQuery].some((query) => query.isFetching && !query.isLoading) ||
    (editorOpen && contextQuery.isFetching && !contextQuery.isLoading);

  const selectBuilding = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    setBuildingId(next);
    setUnitId(null);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const selectUnit = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    setUnitId(next);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const selectBuildingUnit = (nextBuildingId: number, nextUnitId: number) => {
    setBuildingId(nextBuildingId);
    setUnitId(nextUnitId);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const startNewSettlement = () => {
    if (unitId === null) return;
    setSelectedSettlementId(null);
    setForceNew(true);
    setEditorOpen(true);
    setEditorVersion((current) => current + 1);
  };

  const emptyAction = () =>
    toast.info("건물과 호실을 먼저 선택해 주세요.");

  return (
    <div className="relative min-h-[calc(100dvh-62px)] overflow-x-auto bg-bg px-[24px] pb-[22px] pt-[18px]">
      {isSettlementWorkspaceRefreshing ? (
        <div className="absolute right-6 top-3 z-10 rounded-lg bg-white/95 shadow-card">
          <Spinner label="이사정산 자료 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
      <label className="sr-only">
        건물 선택
        <select
          aria-label="건물 선택"
          value={buildingId ?? ""}
          onChange={(event) => selectBuilding(event.target.value)}
        >
          <option value="">건물을 선택해 주세요</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
      </label>
      <label className="sr-only">
        호실 선택
        <select
          aria-label="호실 선택"
          value={unitId ?? ""}
          onChange={(event) => selectUnit(event.target.value)}
        >
          <option value="">호실을 선택해 주세요</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {[unit.dong, unit.unitNo].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </label>

      <div className="mx-auto grid h-[calc(100dvh-102px)] min-h-[720px] min-w-[1340px] max-w-[1872px] grid-cols-[322px_322px_minmax(664px,1fr)] gap-[16px]">
        <SettlementDirectoryRail
          buildings={buildings}
          units={units}
          buildingId={buildingId}
          unitId={unitId}
          buildingsLoading={buildingsQuery.isLoading}
          unitsLoading={unitsQuery.isLoading}
          selectedSettlementId={selectedSettlementId}
          settlementNote={context?.occupancy?.settlementNote ?? null}
          onSelectBuilding={(id) => selectBuilding(id)}
          onSelectUnit={(id) => selectUnit(id)}
          onStartNew={startNewSettlement}
          onSelectSettlement={(id) => {
            setSelectedSettlementId(id);
            setForceNew(false);
            setEditorOpen(true);
          }}
        />

        <div className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
          <SettlementHistory
            selectedBuildingId={buildingId}
            selectedUnitId={unitId}
            onSelect={selectBuildingUnit}
          />
          <MeterInfoPanel
            unitId={unitId}
            selected={Boolean(context?.occupancy)}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {unitId === null && <SettlementEmptyPanel onAction={emptyAction} />}
          {unitId !== null && !editorOpen && (
            <SettlementEmptyPanel
              onAction={emptyAction}
              title="정산된 이사 항목을 선택해 주세요"
              description={
                <>
                  좌측 목록에서 항목을 고르거나
                  <br />
                  새 이사정산 입력을 눌러 작성해요
                </>
              }
            />
          )}
          {editorOpen && contextQuery.isLoading && (
            <div className="grid min-h-[420px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <Spinner label="이사정산 정보 불러오는 중" />
            </div>
          )}
          {editorOpen && contextQuery.error && (
            <div role="alert" className="grid min-h-[420px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="정산 정보를 불러오지 못했어요" />
            </div>
          )}
          {editorOpen && context && context.occupancy === null && (
            <div className="grid min-h-0 flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="선택한 호실에 입주 정보가 없어요" />
            </div>
          )}
          {editorOpen && context && context.occupancy && selectedBuilding && selectedUnit && (
            <SettlementEditor
              key={`${context.unit.id}:${forceNew ? `new-${editorVersion}` : (selectedSettlementId ?? "new")}`}
              building={selectedBuilding}
              context={context}
              occupancy={context.occupancy}
              forceNew={forceNew}
              onDeleted={() => {
                setSelectedSettlementId(null);
                setForceNew(true);
                setEditorVersion((current) => current + 1);
              }}
            />
          )}
        </div>
      </div>

    </div>
  );
}
