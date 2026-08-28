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

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ko-KR");
    if (!q) return units;
    return units.filter((unit) =>
      [unitLabel(unit), tenantByUnit.get(unit.id)]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(q),
    );
  }, [search, tenantByUnit, units]);

  return (
    <aside className="flex w-full flex-col gap-[15px] lg:h-[calc(100vh-101px)] lg:w-[322px] lg:shrink-0">
      <div className="min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-line bg-surface">
        {selectedBuilding === null ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-[18px] pb-[15px] pt-[9px]">
              <h2 className="text-[14px] font-extrabold text-t1">전체 건물</h2>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명·주소 검색"
                aria-label="건물명·주소 검색"
                className="mt-[10px] h-[32px] w-full rounded-[9px] border border-line bg-surface px-[12px] text-[13px] text-t1 placeholder:text-t4 outline-none focus:border-teal"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
            {filteredBuildings.length === 0 ? (
              <EmptyState message="건물이 없습니다" />
            ) : (
              <table className="w-full table-fixed text-[13px]">
                <colgroup>
                  <col className="w-[64px]" />
                  <col className="w-[96px]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="h-[36px] border-b border-line bg-[#fbfcfd] text-left text-[12px] font-bold text-t3">
                    <th className="px-[16px]">코드</th>
                    <th className="px-[8px]">건물명</th>
                    <th className="px-[8px]">주소</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBuilding(b.id)}
                      className="h-[41px] cursor-pointer border-b border-line2 last:border-0 hover:bg-teal-t"
                    >
                      <td className="truncate px-[16px] text-t2 num">{b.code}</td>
                      <td className="truncate px-[8px] font-bold text-t1">{b.name}</td>
                      <td className="truncate px-[8px] text-t2" title={b.address ?? "-"}>{b.address ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-[18px] pb-[15px] pt-[15px]">
              <div className="flex h-[21px] items-center gap-[10px]">
              <button
                type="button"
                onClick={onBack}
                aria-label="건물 목록으로"
                className="flex size-[22px] items-center justify-center rounded-[7px] text-[18px] text-t3 hover:bg-bg"
              >
                ‹
              </button>
                <span className="text-[14px] font-extrabold text-t1">{selectedBuilding.name}</span>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="호수·세대주 검색"
                aria-label="호수·세대주 검색"
                className="mt-[10px] h-[32px] w-full rounded-[9px] border border-line bg-surface px-[12px] text-[13px] text-t1 placeholder:text-t4 outline-none focus:border-teal"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
              {isUnitsLoading ? (
                <Spinner />
              ) : filteredUnits.length === 0 ? (
                <EmptyState message="호실이 없습니다" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="h-[36px] border-b border-line bg-[#fbfcfd] text-left text-[12px] font-bold text-t3">
                      <th className="px-[16px]">호수</th>
                      <th className="px-[16px]">세대주</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((u) => {
                      const active = u.id === selectedUnitId;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => onSelectUnit(u.id)}
                          className={`h-[41px] cursor-pointer border-b border-line2 last:border-0 ${
                            active ? "bg-teal-t" : "hover:bg-bg"
                          }`}
                        >
                          <td className="px-[16px] font-bold text-t1">
                            {unitLabel(u)}
                          </td>
                          <td className={`px-[16px] ${tenantByUnit.has(u.id) ? "text-t2" : "text-t4"}`}>
                            {tenantByUnit.get(u.id) ?? "공실"}
                          </td>
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

/** Figma 하단 "부과시 참조사항" 카드. */
function BuildingNoteBlock({
  building,
  canEdit,
}: {
  building: BuildingLite | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [billingNote, setBillingNote] = useState("");
  const save = useSaveBuildingNotes();

  const startEdit = () => {
    setBillingNote(building?.billingNote ?? "");
    setEditing(true);
  };

  const submit = async () => {
    if (!building) return;
    try {
      await save.mutateAsync({ buildingId: building.id, memo: building.memo ?? "", billingNote });
      toast.success("부과시 참조사항을 저장했습니다.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const activeValue = editing ? billingNote : building?.billingNote ?? "";

  return (
    <div className="group h-[169px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex h-[49px] items-center justify-between border-b border-line px-[18px]">
        <h3 className="text-[14px] font-extrabold text-t1">부과시 참조사항</h3>
        {building !== null && canEdit && (
          editing ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={submit}
                disabled={save.isPending}
                className="rounded-[8px] bg-teal px-[9px] py-[5px] text-[12px] font-bold text-white disabled:opacity-60"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-[8px] border border-line px-[9px] py-[5px] text-[12px] font-bold text-t2 hover:bg-bg"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-[8px] border border-line px-[9px] py-[5px] text-[12px] font-bold text-t2 opacity-0 transition-opacity hover:bg-bg focus:opacity-100 group-hover:opacity-100"
            >
              수정
            </button>
          )
        )}
      </div>
      {building === null ? (
        <p className="flex h-[120px] items-center px-[18px] text-[13px] text-t4">건물을 선택하면 표시돼요</p>
      ) : (
        <textarea
          readOnly={!editing}
          value={activeValue}
          onChange={(event) => setBillingNote(event.target.value)}
          placeholder={editing ? "부과시 참조사항 입력" : "등록된 내용이 없습니다"}
          className={`h-[120px] w-full resize-none border-0 px-[18px] py-[15px] text-[13px] leading-[21px] outline-none ${
            editing ? "bg-surface text-t1" : "bg-surface text-t2"
          }`}
        />
      )}
    </div>
  );
}
