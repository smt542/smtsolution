"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBilling } from "@/hooks/reactquery/billing";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { hasModule } from "@/lib/auth/permissions";
import { buildBillDocument } from "@/lib/billing/billDoc";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import { pivotBillingRows } from "@/lib/billing/pivot";
import { BillPreview } from "./components/BillPreview";
import { BillTargetTable } from "./components/BillTargetTable";

export default function BillPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [issueType, setIssueType] = useState<"giro" | "a4">("a4");
  const [labelMode, setLabelMode] = useState<"code" | "name">("name");
  const [dueDate, setDueDate] = useState("");
  const [cutoff, setCutoff] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const billingQuery = useBilling(buildingId, period);
  const { data: setup } = useSetupConfig(me?.orgId);

  const buildings = buildingsQuery.data ?? [];
  const { units, columns } = useMemo(
    () => pivotBillingRows(billingQuery.data ?? []),
    [billingQuery.data],
  );
  const confirmedUnits = useMemo(
    () => units.filter((unit) => unit.confirmedAt != null && !unit.isVacant),
    [units],
  );
  const docs = useMemo(
    () =>
      confirmedUnits
        .filter((unit) => selected.has(unit.unitId))
        .map((unit) =>
          buildBillDocument(unit, columns, setup ?? null, period, {
            labelMode,
            dueDate: dueDate || undefined,
            showCutoff: cutoff.has(unit.unitId),
          }),
        ),
    [columns, confirmedUnits, cutoff, dueDate, labelMode, period, selected, setup],
  );

  const selectBuilding = (value: string) => {
    setBuildingId(value ? Number(value) : null);
    setSelected(new Set());
    setCutoff(new Set());
  };

  const changePeriod = (value: string) => {
    setPeriod(fromMonthInput(value));
    setSelected(new Set());
    setCutoff(new Set());
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

  const toggleCutoff = (checked: boolean) => {
    setCutoff((current) => {
      const next = new Set(current);
      for (const unit of confirmedUnits) {
        if (!selected.has(unit.unitId)) continue;
        if (checked) next.add(unit.unitId);
        else next.delete(unit.unitId);
      }
      return next;
    });
  };

  const allSelectedShowCutoff = docs.length > 0 && docs.every((doc) => doc.showCutoff);

  if (me === undefined) return null;
  if (!hasModule(me, "bill_publish")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (고지서 발행 권한 필요)" />
      </div>
    );
  }

  return (
    <div className="bill-workspace space-y-4 p-6">
      <div className="no-print space-y-4">
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

          <label className="w-40">
            <span className="mb-1.5 block text-xs font-bold text-t2">부과월</span>
            <input
              type="month"
              aria-label="부과월"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
              value={toMonthInput(period)}
              max={toMonthInput(currentPeriod())}
              onChange={(event) => event.target.value && changePeriod(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="w-36">
            <span className="mb-1.5 block text-xs font-bold text-t2">발행유형</span>
            <Select
              aria-label="발행유형"
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as "giro" | "a4")}
              options={[
                { value: "a4", label: "A4" },
                { value: "giro", label: "지로" },
              ]}
            />
          </label>

          <label className="w-36">
            <span className="mb-1.5 block text-xs font-bold text-t2">세대 표기</span>
            <Select
              aria-label="세대 표기"
              value={labelMode}
              onChange={(event) => setLabelMode(event.target.value as "code" | "name")}
              options={[
                { value: "name", label: "이름 출력" },
                { value: "code", label: "코드 출력" },
              ]}
            />
          </label>

          <label className="w-44">
            <span className="mb-1.5 block text-xs font-bold text-t2">납기일</span>
            <input
              type="date"
              aria-label="납기일"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-t2">
            <input
              type="checkbox"
              aria-label="단전·단수 예고 표시"
              checked={allSelectedShowCutoff}
              disabled={docs.length === 0}
              onChange={(event) => toggleCutoff(event.target.checked)}
            />
            단전·단수 예고 표시
          </label>

          <Button onClick={() => window.print()} disabled={docs.length === 0}>
            인쇄
          </Button>
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

      {docs.length > 0 && <BillPreview docs={docs} issueType={issueType} />}
    </div>
  );
}
