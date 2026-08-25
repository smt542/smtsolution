"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState, Select, Spinner } from "@/components/common";
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
import { ChecklistSection } from "./components/ChecklistSection";
import { MeterInfoPanel } from "./components/MeterInfoPanel";
import { SettlementActions } from "./components/SettlementActions";
import { SettlementForm } from "./components/SettlementForm";
import { SettlementHistory } from "./components/SettlementHistory";

function draftFromContext(context: SettlementContext): MovingSettlementValues {
  const saved = context.latestSettlement;

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
}: {
  building: { id: number; name: string };
  context: SettlementContext;
  occupancy: NonNullable<SettlementContext["occupancy"]>;
}) {
  const [draft, setDraft] = useState(() => draftFromContext(context));
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      context.checklist.map((item) => [item.id, item.checked]),
    ),
  );
  const [activeSettlementId, setActiveSettlementId] = useState<number | null>(
    context.latestSettlement?.id ?? null,
  );

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

  return (
    <>
      <div className="rounded-xl bg-blue-t px-4 py-3 text-sm font-bold text-blue-d">
        <span>{context.unit.unitNo}</span>
        <span aria-hidden="true"> · </span>
        <span>{occupancy.tenantName ?? "입주자 미등록"}</span>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr]">
        <MeterInfoPanel meters={context.meterSummary} />
        <SettlementForm value={draft} onChange={setDraft} />
      </div>
      <ChecklistSection
        items={context.checklist}
        checked={checked}
        onChange={(id, next) =>
          setChecked((current) => ({ ...current, [id]: next }))
        }
      />
      <SettlementActions
        building={building}
        unit={context.unit}
        occupancy={occupancy}
        draft={draft}
        input={saveInput}
        settlementId={activeSettlementId}
        amount={calculateSettlementAmount(draft)}
        onSaved={setActiveSettlementId}
      />
    </>
  );
}

export default function MovingSettlementPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const unitsQuery = useUnits(buildingId ?? 0);
  const contextQuery = useSettlementContext(unitId);

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  const buildings = buildingsQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const context = unitId === null ? undefined : contextQuery.data;
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;

  const selectBuilding = (value: string) => {
    setBuildingId(value ? Number(value) : null);
    setUnitId(null);
  };

  const selectUnit = (value: string) => {
    setUnitId(value ? Number(value) : null);
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-t3">관리업무 · 이사정산</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">이사정산</h1>
        </div>
        <nav aria-label="이사조회 바로가기" className="flex flex-wrap gap-2">
          {[
            ["water", "수도 조회"],
            ["electric", "전기 조회"],
            ["gas", "가스 조회"],
            ["all", "전체 조회"],
          ].map(([type, label]) => (
            <Link
              key={type}
              href={`/staff/moving-settlement/inquiries/${type}`}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-t2 hover:bg-bg"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
            <Select
              aria-label="건물 선택"
              value={buildingId?.toString() ?? ""}
              disabled={buildingsQuery.isLoading}
              onChange={(event) => selectBuilding(event.target.value)}
              options={[
                {
                  value: "",
                  label: buildingsQuery.isLoading
                    ? "건물 불러오는 중"
                    : "건물을 선택해 주세요",
                },
                ...buildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">호실 선택</span>
            <Select
              aria-label="호실 선택"
              value={unitId?.toString() ?? ""}
              disabled={buildingId === null || unitsQuery.isLoading}
              onChange={(event) => selectUnit(event.target.value)}
              options={[
                { value: "", label: "호실을 선택해 주세요" },
                ...units.map((unit) => ({
                  value: String(unit.id),
                  label: [unit.dong, unit.unitNo].filter(Boolean).join(" "),
                })),
              ]}
            />
          </label>
        </div>
      </section>

      {buildingsQuery.error && (
        <EmptyState message="건물 목록을 불러오지 못했습니다." />
      )}
      {unitId === null && (
        <EmptyState message="정산할 호실을 선택해 주세요" />
      )}
      {unitId !== null && contextQuery.isLoading && <Spinner />}
      {unitId !== null && contextQuery.error && (
        <EmptyState message="정산 정보를 불러오지 못했습니다." />
      )}
      {context && context.occupancy === null && (
        <EmptyState message="선택한 호실에 입주 정보가 없습니다." />
      )}
      {context && context.occupancy && selectedBuilding && (
        <SettlementEditor
          key={`${context.unit.id}:${context.latestSettlement?.id ?? "new"}`}
          building={selectedBuilding}
          context={context}
          occupancy={context.occupancy}
        />
      )}

      <SettlementHistory buildingId={buildingId} />
    </div>
  );
}
