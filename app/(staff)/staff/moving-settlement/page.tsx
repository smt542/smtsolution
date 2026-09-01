"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  calculateSettlementAmount,
  useSettlementContext,
  type SaveSettlementInput,
  type SettlementContext,
} from "@/hooks/reactquery/movingSettlement";
import { useUnits } from "@/hooks/reactquery/units";
import { hasModule } from "@/lib/auth/permissions";
import { MeterInfoPanel } from "./components/MeterInfoPanel";
import { SettlementActions } from "./components/SettlementActions";
import { SettlementDirectoryRail } from "./components/SettlementDirectoryRail";
import { SettlementEmptyPanel } from "./components/SettlementEmptyPanel";
import { SettlementForm } from "./components/SettlementForm";
import { SettlementHistory } from "./components/SettlementHistory";

function draftFromContext(
  context: SettlementContext,
  forceNew = false,
): MovingSettlementValues {
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
  building: { id: number; name: string };
  context: SettlementContext;
  occupancy: NonNullable<SettlementContext["occupancy"]>;
  forceNew: boolean;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(() => draftFromContext(context, forceNew));
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      context.checklist.map((item) => [item.id, item.checked]),
    ),
  );
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [finalPaidDate, setFinalPaidDate] = useState("");
  const [activeSettlementId, setActiveSettlementId] = useState<number | null>(
    forceNew ? null : (context.latestSettlement?.id ?? null),
  );
  const paymentInputRef = useRef<HTMLInputElement>(null);

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
    checklist: context.checklist.map((item) => ({
      checkItemId: item.id,
      checked: checked[item.id] ?? false,
    })),
  };

  const amount = calculateSettlementAmount(draft);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <SettlementForm
        buildingName={building.name}
        unitNo={context.unit.unitNo}
        contactPhone={occupancy.phone ?? ""}
        value={draft}
        onChange={setDraft}
        meters={context.meterSummary}
        checklist={context.checklist}
        checked={checked}
        onChecklistChange={(id, next) =>
          setChecked((current) => ({ ...current, [id]: next }))
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
        createdAt={context.latestSettlement?.createdAt ?? null}
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

export default function MovingSettlementPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const unitsQuery = useUnits(buildingId ?? 0);
  const contextQuery = useSettlementContext(unitId);

  const buildings = useMemo(
    () => buildingsQuery.data ?? [],
    [buildingsQuery.data],
  );
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const context = unitId === null ? undefined : contextQuery.data;
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  const selectBuilding = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    setBuildingId(next);
    setUnitId(null);
    setForceNew(false);
  };

  const selectUnit = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    setUnitId(next);
    setForceNew(false);
  };

  const startNewSettlement = () => {
    if (unitId === null) return;
    setForceNew(true);
    setEditorVersion((current) => current + 1);
  };

  const emptyAction = () =>
    toast.info("건물과 호실을 먼저 선택해 주세요.");

  return (
    <div className="relative min-h-[calc(100dvh-62px)] overflow-x-auto bg-bg px-[24px] pb-[22px] pt-[18px]">
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

      <div className="mx-auto grid h-[calc(100dvh-102px)] min-h-[720px] min-w-[1340px] max-w-[1632px] grid-cols-[322px_322px_minmax(664px,1fr)] gap-[16px]">
        <SettlementDirectoryRail
          buildings={buildings}
          units={units}
          buildingId={buildingId}
          unitId={unitId}
          buildingsLoading={buildingsQuery.isLoading}
          unitsLoading={unitsQuery.isLoading}
          settlementDate={context?.latestSettlement?.moveOutDate ?? null}
          settlementNote={context?.occupancy?.settlementNote ?? null}
          onSelectBuilding={(id) => selectBuilding(id)}
          onSelectUnit={(id) => selectUnit(id)}
          onStartNew={startNewSettlement}
        />

        <div className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
          <SettlementHistory
            buildingId={buildingId}
            selectedUnitId={unitId}
            onSelectUnit={(id) => selectUnit(id)}
          />
          <MeterInfoPanel
            meters={context?.meterSummary ?? []}
            selected={Boolean(context?.occupancy)}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {unitId === null && <SettlementEmptyPanel onAction={emptyAction} />}
          {unitId !== null && contextQuery.isLoading && (
            <div className="grid min-h-0 flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <Spinner />
            </div>
          )}
          {unitId !== null && contextQuery.error && (
            <div className="grid min-h-0 flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="정산 정보를 불러오지 못했습니다." />
            </div>
          )}
          {context && context.occupancy === null && (
            <div className="grid min-h-0 flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="선택한 호실에 입주 정보가 없습니다." />
            </div>
          )}
          {context && context.occupancy && selectedBuilding && selectedUnit && (
            <SettlementEditor
              key={`${context.unit.id}:${forceNew ? `new-${editorVersion}` : (context.latestSettlement?.id ?? "new")}`}
              building={selectedBuilding}
              context={context}
              occupancy={context.occupancy}
              forceNew={forceNew}
              onDeleted={() => {
                setForceNew(true);
                setEditorVersion((current) => current + 1);
              }}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="화면 도우미 열기"
        className="fixed right-0 top-1/2 hidden h-[70px] w-[30px] -translate-y-1/2 items-center justify-center rounded-l-[12px] border border-line bg-white text-t3 shadow-[-6px_0_8px_rgba(23,31,40,0.25)] 2xl:flex"
      >
        <span aria-hidden="true">▧</span>
      </button>
      <button
        type="button"
        aria-label="도움말"
        className="fixed bottom-[22px] right-[22px] hidden size-[52px] items-center justify-center rounded-full bg-teal text-[20px] text-white shadow-[0_12px_14px_rgba(20,164,151,0.6)] 2xl:flex"
      >
        <span aria-hidden="true">◯</span>
      </button>
    </div>
  );
}
