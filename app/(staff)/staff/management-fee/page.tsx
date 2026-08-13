"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Button, Select, EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useBilling, useSaveBillingCharges, useConfirmBilling } from "@/hooks/reactquery/billing";
import { hasModule } from "@/lib/auth/permissions";
import { pivotBillingRows, type BillingUnitRow } from "@/lib/billing/pivot";
import { currentPeriod, toMonthInput, fromMonthInput } from "@/lib/billing/period";
import { BillingTable } from "./components/BillingTable";
import { ItemManageModal } from "./components/ItemManageModal";
import { BillingHistoryModal } from "./components/BillingHistoryModal";
import { BillingNoteModal } from "./components/BillingNoteModal";

type ChargeDraft = { charged: boolean; amount: number };

export default function FeeItemPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const { data: buildingTypes = [] } = useBuildingTypes();

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>(() => currentPeriod());
  const [chargeDrafts, setChargeDrafts] = useState<Record<string, ChargeDraft>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, { billingNote: string; unitNotice: string }>>({});
  const [noteUnit, setNoteUnit] = useState<number | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [historyUnit, setHistoryUnit] = useState<{ id: number; no: string } | null>(null);

  const billingQuery = useBilling(buildingId, period);
  const saveCharges = useSaveBillingCharges();
  const confirmBilling = useConfirmBilling();

  if (me === undefined) return null;
  if (!hasModule(me, "billing")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (부과 확정 권한 필요)" />
      </div>
    );
  }

  const buildings = buildingsQuery.data ?? [];
  const selectedBuilding = buildings.find((b) => b.id === buildingId) ?? null;
  const buildingType = buildingTypes.find((t) => t.id === selectedBuilding?.typeId) ?? null;

  const { units: serverUnits, columns } = pivotBillingRows(billingQuery.data ?? []);
  // draft 오버레이 (charge + note)
  const units: BillingUnitRow[] = serverUnits.map((u) => {
    const noteDraft = noteDrafts[u.unitId];
    return {
      ...u,
      billingNote: noteDraft ? noteDraft.billingNote : u.billingNote,
      unitNotice: noteDraft ? noteDraft.unitNotice : u.unitNotice,
      charges: Object.fromEntries(
        columns.map((c) => {
          const key = `${u.unitId}:${c.feeItemId}`;
          return [c.feeItemId, chargeDrafts[key] ?? u.charges[c.feeItemId] ?? { charged: true, amount: 0 }];
        })
      ),
    };
  });

  const onChargeChange = (unitId: number, feeItemId: number, patch: Partial<ChargeDraft>) => {
    const key = `${unitId}:${feeItemId}`;
    const current =
      chargeDrafts[key] ??
      serverUnits.find((u) => u.unitId === unitId)?.charges[feeItemId] ??
      { charged: true, amount: 0 };
    setChargeDrafts((d) => ({ ...d, [key]: { ...current, ...patch } }));
  };

  const handleSave = async () => {
    if (!buildingId) return;
    const charges = Object.entries(chargeDrafts).map(([key, v]) => {
      const [unitId, feeItemId] = key.split(":").map(Number);
      const occ = serverUnits.find((u) => u.unitId === unitId)?.occupancyId ?? null;
      return { unitId, feeItemId, charged: v.charged, amount: v.amount, occupancyId: occ };
    });
    const notes = Object.entries(noteDrafts).map(([unitId, v]) => ({
      unitId: Number(unitId),
      billingNote: v.billingNote || null,
      unitNotice: v.unitNotice || null,
    }));
    if (charges.length === 0 && notes.length === 0) { toast.info("변경된 내용이 없습니다."); return; }
    try {
      await saveCharges.mutateAsync({ buildingId, period, charges, notes });
      setChargeDrafts({});
      setNoteDrafts({});
      toast.success("임시 저장되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfirm = async () => {
    if (!buildingId) return;
    if (Object.keys(chargeDrafts).length > 0) { toast.info("먼저 [저장]으로 임시 저장해 주세요."); return; }
    if (!window.confirm("당월 관리비를 부과 확정하시겠습니까?")) return;
    try {
      const r = await confirmBilling.mutateAsync({ buildingId, period });
      toast.success(`부과가 확정되었습니다. (${r.unitCount}세대 · ${r.total.toLocaleString("ko-KR")}원)`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const selectBuilding = (v: string) => { setBuildingId(v ? Number(v) : null); setChargeDrafts({}); };
  const changeMonth = (v: string) => { setPeriod(fromMonthInput(v)); setChargeDrafts({}); };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold text-t3">관리업무 · 부과 확정</p>
        <h1 className="mt-1 text-2xl font-extrabold text-t1">관리비 부과 셋팅</h1>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-64">
            <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
            <Select
              aria-label="건물 선택"
              value={buildingId?.toString() ?? ""}
              onChange={(e) => selectBuilding(e.target.value)}
              disabled={buildingsQuery.isLoading}
              options={[
                { value: "", label: buildingsQuery.isLoading ? "불러오는 중" : "-- 선택 --" },
                ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">부과 월</span>
            <input
              type="month"
              aria-label="부과 월"
              value={toMonthInput(period)}
              max={toMonthInput(currentPeriod())}
              onChange={(e) => e.target.value && changeMonth(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-t1 focus:border-blue focus:outline-none"
            />
          </label>
          <div className="flex w-full flex-wrap justify-end gap-2 xl:w-auto xl:flex-1">
            <Button variant="ghost" onClick={() => setItemModalOpen(true)} disabled={!selectedBuilding?.typeId}>
              항목관리
            </Button>
            <Button variant="ghost" onClick={handleSave} disabled={!buildingId || saveCharges.isPending}>
              저장
            </Button>
            <Button variant="primary" onClick={handleConfirm}
              disabled={!buildingId || confirmBilling.isPending || units.length === 0}>
              부과 확정
            </Button>
          </div>
        </div>
      </section>

      {!buildingId && (
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState message="건물을 선택해 주세요" />
        </section>
      )}
      {buildingId && billingQuery.isLoading && (
        <section className="rounded-2xl border border-line bg-surface py-16 shadow-card">
          <Spinner />
          <p className="text-center text-sm text-t3">불러오는 중입니다.</p>
        </section>
      )}
      {buildingId && billingQuery.error && (
        <section className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">오류가 발생했습니다. 다시 시도해 주세요.</p>
          <Button className="mt-3" variant="ghost" onClick={() => billingQuery.refetch()}>
            다시 시도
          </Button>
        </section>
      )}
      {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length === 0 && (
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState message="등록된 세대가 없습니다" />
        </section>
      )}
      {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <BillingTable
            units={units}
            columns={columns}
            period={period}
            onChargeChange={onChargeChange}
            onRowClick={(unitId) => { const u = units.find((x) => x.unitId === unitId); if (u) setHistoryUnit({ id: unitId, no: u.unitNo }); }}
            onNoteClick={(unitId) => setNoteUnit(unitId)}
          />
        </section>
      )}

      {selectedBuilding?.typeId && buildingType && me?.orgId && (
        <ItemManageModal
          open={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          orgId={me.orgId}
          typeId={selectedBuilding.typeId}
          typeLabel={buildingType.label}
        />
      )}

      <BillingHistoryModal
        open={!!historyUnit}
        unitId={historyUnit?.id ?? null}
        unitNo={historyUnit?.no ?? ""}
        period={period}
        onClose={() => setHistoryUnit(null)}
      />

      {(() => {
        const u = units.find((x) => x.unitId === noteUnit);
        return (
          <BillingNoteModal
            open={noteUnit != null}
            unitNo={u?.unitNo ?? ""}
            billingNote={u?.billingNote ?? ""}
            unitNotice={u?.unitNotice ?? ""}
            onClose={() => setNoteUnit(null)}
            onSave={(v) => {
              if (noteUnit != null) setNoteDrafts((d) => ({ ...d, [noteUnit]: v }));
              setNoteUnit(null);
            }}
          />
        );
      })()}
    </div>
  );
}
