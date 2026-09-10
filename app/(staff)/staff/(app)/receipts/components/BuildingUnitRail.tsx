"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSaveBuildingNotes } from "@/hooks/reactquery/receipts";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import type { Unit } from "@/hooks/reactquery/units";
import { unitLabel } from "../receiptFormat";
import styles from "./BuildingUnitRail.module.css";

type BuildingLite = Pick<Building, "id" | "name" | "code" | "address" | "memo" | "billingNote">;

/** 15px 돋보기 아이콘 (canon #rcSearch). */
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

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
    <aside className="flex h-full w-full min-h-0 flex-col gap-[16px]">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(23,31,40,0.05)]">
        {selectedBuilding === null ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-[8px] px-[18px] py-[15px] border-b border-line2">
              <h2 className="text-[15px] font-extrabold leading-[normal] text-t1">전체 건물</h2>
              <div className="relative basis-full w-full">
                <SearchIcon />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="건물명·주소 검색"
                  aria-label="건물명·주소 검색"
                  className="h-[32px] w-full rounded-[9px] border border-line bg-surface pl-[31px] pr-[11px] text-[13px] font-semibold leading-[normal] text-t1 placeholder:text-t4 outline-none focus:border-teal"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {filteredBuildings.length === 0 ? (
              <EmptyState message="건물이 없습니다" />
            ) : (
              <table
                aria-label="건물 목록"
                className={`w-full table-fixed leading-[normal] ${styles.buildingTableEnter}`}
              >
                <colgroup>
                  <col className="w-[64px]" />
                  <col className="w-[96px]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-[#FBFCFD] text-left text-[12px] font-bold text-t3">
                    <th className="px-[16px] py-[11px]">코드</th>
                    <th className="px-[16px] py-[11px]">건물명</th>
                    <th className="px-[16px] py-[11px]">주소</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBuilding(b.id)}
                      className="cursor-pointer border-b border-line2 last:border-0 hover:bg-blue-t2"
                    >
                      <td className="truncate px-[16px] py-[12px] text-[13.5px] text-t2 num">{b.code}</td>
                      <td className="truncate px-[16px] py-[12px] text-[13.5px] font-bold text-t1">{b.name}</td>
                      <td className="truncate px-[16px] py-[12px] text-[13.5px] text-t2" title={b.address ?? "-"}>{b.address ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-[8px] px-[18px] py-[15px] border-b border-line2">
              <button
                type="button"
                onClick={onBack}
                aria-label="건물 목록으로"
                className="flex size-[24px] items-center justify-center rounded-[7px] text-t2 transition-transform duration-[120ms] ease-[ease] hover:bg-bg active:-translate-x-0.5"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-[18px]">
                  <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="text-[15px] font-extrabold leading-[normal] text-t1">{selectedBuilding.name}</span>
              <div className="relative basis-full w-full">
                <SearchIcon />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="호수·세대주 검색"
                  aria-label="호수·세대주 검색"
                  className="h-[32px] w-full rounded-[9px] border border-line bg-surface pl-[31px] pr-[11px] text-[13px] font-semibold leading-[normal] text-t1 placeholder:text-t4 outline-none focus:border-teal"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {isUnitsLoading ? (
                <Spinner />
              ) : filteredUnits.length === 0 ? (
                <EmptyState message="호실이 없습니다" />
              ) : (
                <table
                  aria-label="호실 목록"
                  className={`w-full table-fixed leading-[normal] ${styles.unitTableEnter}`}
                >
                  <colgroup>
                    <col className="w-[64px]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line bg-[#FBFCFD] text-left text-[12px] font-bold text-t3">
                      <th className="px-[16px] py-[11px]">호수</th>
                      <th className="px-[16px] py-[11px]">세대주</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((u) => {
                      const active = u.id === selectedUnitId;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => onSelectUnit(u.id)}
                          className={`cursor-pointer border-b border-line2 last:border-0 ${
                            active ? "bg-teal-t" : "hover:bg-blue-t2"
                          }`}
                        >
                          <td className="px-[16px] py-[12px] text-[13.5px] font-bold text-t1">
                            {unitLabel(u)}
                          </td>
                          <td className={`px-[16px] py-[12px] text-[13.5px] ${tenantByUnit.has(u.id) ? "text-t2" : "text-t4"}`}>
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

type NoteTab = "memo" | "ref";

/** canon `.rc-note`: 수납 건물 메모 / 부과시 참조사항 2탭 메모 패널. */
function BuildingNoteBlock({
  building,
  canEdit,
}: {
  building: BuildingLite | null;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<NoteTab>("memo");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = useSaveBuildingNotes();

  const storedMemo = building?.memo ?? "";
  const storedBillingNote = building?.billingNote ?? "";
  const storedActive = tab === "memo" ? storedMemo : storedBillingNote;

  const selectTab = (next: NoteTab) => {
    if (editing) return;
    setTab(next);
  };

  const startEdit = () => {
    if (!building) {
      toast.info("건물을 먼저 선택해 주세요.");
      return;
    }
    setDraft(storedActive);
    setEditing(true);
  };

  const submit = async () => {
    if (!building) return;
    try {
      await save.mutateAsync({
        buildingId: building.id,
        memo: tab === "memo" ? draft : storedMemo,
        billingNote: tab === "ref" ? draft : storedBillingNote,
      });
      toast.success(tab === "memo" ? "수납 건물 메모를 저장했습니다." : "부과시 참조사항을 저장했습니다.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const value = editing ? draft : storedActive;
  const editPlaceholder = tab === "memo" ? "건물 단위 메모를 입력해 주세요" : "부과시 참조사항 입력";
  const readPlaceholder = "등록된 내용이 없습니다";

  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 pb-[10px] pt-[12px] text-[13.5px] font-semibold leading-[normal] ${
      active ? "text-teal border-teal font-bold" : "text-t4 border-transparent"
    }`;

  return (
    <div className="h-[168px] min-h-[90px] shrink-0 flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(23,31,40,0.05)]">
      <div className="flex items-center gap-[16px] px-[16px] border-b border-line">
        <button
          type="button"
          onClick={() => selectTab("memo")}
          className={tabClass(tab === "memo")}
        >
          수납 건물 메모
        </button>
        <button
          type="button"
          onClick={() => selectTab("ref")}
          className={tabClass(tab === "ref")}
        >
          부과시 참조사항
        </button>
        <span className="flex-1" />
        {canEdit && (
          editing ? (
            <button
              type="button"
              onClick={submit}
              disabled={save.isPending}
              className="h-[26px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold leading-[normal] text-white disabled:opacity-60"
            >
              저장
            </button>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="h-[26px] rounded-[8px] border border-line bg-surface px-[10px] text-[11.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
            >
              수정
            </button>
          )
        )}
      </div>
      {building === null ? (
        <p className="flex-1 px-[16px] pb-[15px] pt-[13px] text-[13.5px] leading-[1.62] text-t4">건물을 선택하면 표시돼요</p>
      ) : (
        <textarea
          readOnly={!editing}
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={editing ? editPlaceholder : readPlaceholder}
          className={`flex-1 w-full resize-none text-[13.5px] leading-[1.62] outline-none bg-surface ${
            editing
              ? "mx-[12px] mb-[12px] rounded-[10px] border border-teal px-[14px] py-[11px] text-t1"
              : "border-0 px-[16px] pt-[13px] pb-[15px] text-t1"
          }`}
        />
      )}
    </div>
  );
}
