"use client";

import { useMemo, useState } from "react";
import { EmptyState, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBilling } from "@/hooks/reactquery/billing";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { hasModule } from "@/lib/auth/permissions";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import { pivotBillingRows } from "@/lib/billing/pivot";
import { BillTargetTable } from "./components/BillTargetTable";

export default function BillPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [labelMode] = useState<"code" | "name">("name");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const billingQuery = useBilling(buildingId, period);

  const buildings = buildingsQuery.data ?? [];
  const { units, columns } = useMemo(
    () => pivotBillingRows(billingQuery.data ?? []),
    [billingQuery.data],
  );
  const confirmedUnits = useMemo(
    () => units.filter((unit) => unit.confirmedAt != null && !unit.isVacant),
    [units],
  );

  const selectBuilding = (value: string) => {
    setBuildingId(value ? Number(value) : null);
    setSelected(new Set());
  };

  const changePeriod = (value: string) => {
    setPeriod(fromMonthInput(value));
    setSelected(new Set());
  };

  const toggle = (unitId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(confirmedUnits.map((unit) => unit.unitId)) : new Set());
  };

  if (me === undefined) return null;
  if (!hasModule(me, "bill_publish")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (고지서 발행 권한 필요)" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-bold text-t1">고지서 발행·출력</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
          <Select
            aria-label="건물 선택"
            value={buildingId?.toString() ?? ""}
            onChange={(event) => selectBuilding(event.target.value)}
            disabled={buildingsQuery.isLoading}
            options={[
              {
                value: "",
                label: buildingsQuery.isLoading ? "건물 불러오는 중" : "건물을 선택해 주세요",
              },
              ...buildings.map((building) => ({
                value: String(building.id),
                label: building.name,
              })),
            ]}
          />
        </label>

        <label className="w-40">
          <span className="mb-1.5 block text-xs font-bold text-t2">부과월</span>
          <input
            type="month"
            aria-label="부과월"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            value={toMonthInput(period)}
            max={toMonthInput(currentPeriod())}
            onChange={(event) => event.target.value && changePeriod(event.target.value)}
          />
        </label>
      </div>

      {buildingId == null && <EmptyState message="건물을 선택해 주세요." />}

      {buildingId != null && billingQuery.isLoading && (
        <div className="py-10 text-center">
          <Spinner />
        </div>
      )}

      {buildingId != null && billingQuery.error != null && (
        <EmptyState message="불러오지 못했습니다. 다시 시도해 주세요." />
      )}

      {buildingId != null &&
        !billingQuery.isLoading &&
        billingQuery.error == null &&
        confirmedUnits.length === 0 && (
          <EmptyState message="부과 확정된 세대가 없습니다. 부과 확정 화면에서 먼저 확정해 주세요." />
        )}

      {buildingId != null &&
        !billingQuery.isLoading &&
        billingQuery.error == null &&
        confirmedUnits.length > 0 && (
          <div className="overflow-x-auto">
            <BillTargetTable
              units={confirmedUnits}
              columns={columns}
              period={period}
              labelMode={labelMode}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          </div>
        )}
    </div>
  );
}
