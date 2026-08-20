"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSaveBuildingNotes } from "@/hooks/reactquery/receipts";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import type { Unit } from "@/hooks/reactquery/units";
import { unitLabel } from "../receiptFormat";

type BuildingLite = Pick<Building, "id" | "name" | "code" | "address" | "memo" | "billingNote">;

export function BuildingUnitRail({
  buildings,
  units,
  receiptRows,
  isUnitsLoading,
  canEdit,
  selectedBuildingId,
  selectedUnitId,
  onSelectBuilding,
  onSelectUnit,
  onBack,
}: {
  buildings: BuildingLite[];
  units: Unit[];
  receiptRows: ReceiptPaymentRow[];
  isUnitsLoading: boolean;
  canEdit: boolean;
  selectedBuildingId: number | null;
  selectedUnitId: number | null;
  onSelectBuilding: (id: number) => void;
  onSelectUnit: (id: number) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

  const filteredBuildings = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ko-KR");
    if (!q) return buildings;
    return buildings.filter((b) =>
      [b.name, b.address, b.code]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(q),
    );
  }, [buildings, search]);

  const tenantByUnit = useMemo(() => {
    const map = new Map<number, string>();
    receiptRows.forEach((row) => {
      if (row.tenantName) map.set(row.unitId, row.tenantName);
    });
    return map;
  }, [receiptRows]);

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-[320px] lg:shrink-0">
      <div className="rounded-2xl border border-line bg-surface p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="건물명·주소 검색"
          aria-label="건물명·주소 검색"
          className="h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm text-t1 placeholder:text-t4"
        />

        {selectedBuilding === null ? (
          <div className="mt-3 max-h-[420px] overflow-y-auto">
            {filteredBuildings.length === 0 ? (
              <EmptyState message="건물이 없습니다" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-bold text-t3">
                    <th className="px-2 py-2">코드</th>
                    <th className="px-2 py-2">건물명</th>
                    <th className="px-2 py-2">주소</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBuilding(b.id)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-bg"
                    >
                      <td className="px-2 py-2.5 text-t3 num">{b.code}</td>
                      <td className="px-2 py-2.5 font-bold text-t1">{b.name}</td>
                      <td className="px-2 py-2.5 text-t3">{b.address ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-t2 hover:bg-bg"
              >
                ← 건물 목록
              </button>
              <span className="text-sm font-extrabold text-t1">{selectedBuilding.name}</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {isUnitsLoading ? (
                <Spinner />
              ) : units.length === 0 ? (
                <EmptyState message="호실이 없습니다" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-bold text-t3">
                      <th className="px-2 py-2">호수</th>
                      <th className="px-2 py-2">세대주</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => {
                      const active = u.id === selectedUnitId;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => onSelectUnit(u.id)}
                          className={`cursor-pointer border-b border-line last:border-0 ${
                            active ? "bg-blue-t2" : "hover:bg-bg"
                          }`}
                        >
                          <td className={`px-2 py-2.5 font-bold ${active ? "text-blue" : "text-t1"}`}>
                            {unitLabel(u)}
                          </td>
                          <td className="px-2 py-2.5 text-t2">{tenantByUnit.get(u.id) ?? "공실"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <BuildingNoteBlock
        key={selectedBuilding?.id ?? "none"}
        building={selectedBuilding}
        canEdit={canEdit}
      />
    </aside>
  );
}

/** 수납 건물메모(building.memo) / 부과시 참조사항(building.billingNote) — 수정→저장. */
function BuildingNoteBlock({
  building,
  canEdit,
}: {
  building: BuildingLite | null;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"memo" | "billing">("memo");
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState("");
  const [billingNote, setBillingNote] = useState("");
  const save = useSaveBuildingNotes();

  const startEdit = () => {
    setMemo(building?.memo ?? "");
    setBillingNote(building?.billingNote ?? "");
    setEditing(true);
  };

  const submit = async () => {
    if (!building) return;
    try {
      await save.mutateAsync({ buildingId: building.id, memo, billingNote });
      toast.success("건물 메모를 저장했습니다.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const activeValue = editing
    ? tab === "memo"
      ? memo
      : billingNote
    : tab === "memo"
      ? building?.memo ?? ""
      : building?.billingNote ?? "";

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("memo")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              tab === "memo" ? "bg-blue-t2 text-blue" : "text-t3 hover:bg-bg"
            }`}
          >
            수납 건물 메모
          </button>
          <button
            type="button"
            onClick={() => setTab("billing")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              tab === "billing" ? "bg-blue-t2 text-blue" : "text-t3 hover:bg-bg"
            }`}
          >
            부과시 참조사항
          </button>
        </div>
        {building !== null && canEdit && (
          editing ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={submit}
                disabled={save.isPending}
                className="rounded-lg bg-blue px-2 py-1 text-xs font-bold text-white disabled:opacity-60"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-t2 hover:bg-bg"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-t2 hover:bg-bg"
            >
              수정
            </button>
          )
        )}
      </div>
      {building === null ? (
        <p className="px-1 py-4 text-center text-xs text-t4">건물을 선택하세요</p>
      ) : (
        <textarea
          readOnly={!editing}
          value={activeValue}
          onChange={(e) => (tab === "memo" ? setMemo(e.target.value) : setBillingNote(e.target.value))}
          placeholder={
            editing
              ? tab === "memo"
                ? "수납 건물 메모 입력"
                : "부과시 참조사항 입력"
              : "등록된 내용이 없습니다"
          }
          className={`h-20 w-full resize-none rounded-xl border px-3 py-2 text-sm ${
            editing ? "border-blue bg-surface text-t1" : "border-line bg-bg text-t2"
          }`}
        />
      )}
    </div>
  );
}
