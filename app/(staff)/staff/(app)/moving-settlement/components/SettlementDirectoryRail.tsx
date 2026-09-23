"use client";

import { useMemo, useState } from "react";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { ChevronLeftIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { useUnitSettlements } from "@/hooks/reactquery/movingSettlement/unitSettlements";
import type { Unit } from "@/hooks/reactquery/units";
import {
  BUILDING_GROUP_FILTER_OPTIONS,
  matchesBuildingGroup,
} from "@/lib/buildings/groupType";

// 정본 `.ms-hd .uc-dd-btn{height:28px;padding:0 8px 0 9px;font-size:12px}` 와 공통 `.uc-dd` 규칙
// (호버 테두리 #C9D0D8·메뉴 padding 5px·옵션 gap 10px·옵션 호버 #F5F7F9)을 호출부에서 맞춘다.
// 줄높이 15px 는 기존 정합 버튼 값을 그대로 둔다.
const dropdownCallSiteClass = [
  "[&_.uc-dd-btn]:h-[28px]",
  "[&_.uc-dd-btn]:pl-[9px]",
  "[&_.uc-dd-btn]:pr-[8px]",
  "[&_.uc-dd-btn]:text-[12px]",
  "[&_.uc-dd-btn]:leading-[15px]",
  "[&_.uc-dd-btn_svg]:h-[14px]",
  "[&_.uc-dd-btn_svg]:w-[14px]",
  "[&_.uc-dd-btn_svg]:text-t3",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:border-[#C9D0D8]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:shadow-none",
  "[&_.uc-dd-menu]:min-w-[104px]",
  "[&_.uc-dd-menu]:p-[5px]",
  "[&_.uc-opt]:gap-[10px]",
  "[&_.uc-opt:not(.on):hover]:bg-[#F5F7F9]",
].join(" ");

function displayDate(value: string | null): string {
  return value ? value.replaceAll("-", ".") : "";
}

function SettlementNoteCard({
  note,
  emptyMessage,
}: {
  note: string | null;
  emptyMessage: string;
}) {
  const hasNote = Boolean(note);

  return (
    <section className="h-[132px] max-h-[168px] min-h-[132px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex items-center border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[14px] font-semibold leading-[17px] text-t1">이사정산시 적요</h2>
      </div>
      <p
        className={`px-[16px] pb-[15px] pt-[13px] text-[13.5px] leading-[21.87px] ${hasNote ? "text-t1" : "text-t4"}`}
      >
        {hasNote ? note : emptyMessage}
      </p>
    </section>
  );
}

export function SettlementDirectoryRail({
  buildings,
  units,
  buildingId,
  unitId,
  buildingsLoading,
  unitsLoading,
  selectedSettlementId,
  settlementNote,
  onSelectBuilding,
  onSelectUnit,
  onStartNew,
  onSelectSettlement,
}: {
  buildings: Building[];
  units: Unit[];
  buildingId: number | null;
  unitId: number | null;
  buildingsLoading: boolean;
  unitsLoading: boolean;
  selectedSettlementId: number | null;
  settlementNote: string | null;
  onSelectBuilding: (id: number | null) => void;
  onSelectUnit: (id: number | null) => void;
  onStartNew: () => void;
  onSelectSettlement: (settlementId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [groupType, setGroupType] = useState("");
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;
  const unitSettlementsQuery = useUnitSettlements(unitId);
  const visibleBuildings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    return buildings.filter((building) =>
      matchesBuildingGroup(building, groupType) &&
      (!query ||
        [building.code, building.name, building.address ?? ""]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(query)),
    );
  }, [buildings, groupType, search]);

  // 건물을 바꾸거나 목록으로 돌아갈 때 호실 검색어가 남아 다음 건물 목록을 잘못 거르지 않도록 초기화한다.
  const selectBuilding = (id: number | null) => {
    setTenantSearch("");
    onSelectBuilding(id);
  };

  const tenantQuery = useTenantList(buildingId ?? 0);
  const tenants = useMemo(() => tenantQuery.data ?? [], [tenantQuery.data]);
  const visibleTenants = useMemo(() => {
    const query = tenantSearch.trim().toLocaleLowerCase("ko-KR");
    if (!query) return tenants;
    return tenants.filter((tenant) =>
      [tenant.unitNo, tenant.tenantName ?? ""]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(query),
    );
  }, [tenantSearch, tenants]);

  if (selectedBuilding && selectedUnit) {
    return (
      <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="flex shrink-0 flex-col gap-[9px] border-b border-line2 px-[18px] py-[15px]">
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                aria-label="호실 목록으로 돌아가기"
                onClick={() => onSelectUnit(null)}
                className="grid size-[24px] place-items-center rounded-[7px] text-t2 hover:bg-bg"
              >
                <ChevronLeftIcon className="size-[16px]" />
              </button>
              <h2 className="truncate text-[15px] font-extrabold leading-[18px] text-t1">
                {selectedBuilding.name} {selectedUnit.unitNo}
              </h2>
            </div>
            <button
              type="button"
              onClick={onStartNew}
              className="h-[32px] w-full rounded-[9px] border border-teal bg-teal text-[13px] font-bold text-white hover:bg-teal-d"
            >
              새 이사정산 입력
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid h-[37px] grid-cols-[52px_1fr] border-b border-line bg-[#fbfcfd] text-[12px] font-bold leading-[15px] text-t3">
              <span className="px-[16px] py-[11px]">No</span>
              <span className="px-[16px] py-[11px]">이사정산 입력 날짜</span>
            </div>
            {unitSettlementsQuery.isLoading && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                정산 이력을 불러오고 있어요
              </p>
            )}
            {!unitSettlementsQuery.isLoading &&
              (unitSettlementsQuery.data ?? []).length === 0 && (
              <p role="status" aria-label="호실 목록 불러오는 중" className="px-[16px] py-[14px] text-[12.5px] text-t4">
                정산된 이사 항목이 없어요
              </p>
            )}
            {!unitSettlementsQuery.isLoading &&
              (unitSettlementsQuery.data ?? []).map((row, index) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectSettlement(row.id)}
                  className={`grid h-[41px] w-full grid-cols-[52px_1fr] border-b border-line2 text-left text-[13.5px] leading-[16px] text-t1 ${row.id === selectedSettlementId ? "bg-teal-t" : "bg-white hover:bg-[#fbfcfd]"}`}
                >
                  <span className="px-[16px] py-[12px]">{index + 1}</span>
                  <span className="px-[16px] py-[12px]">
                    {displayDate(row.moveOutDate ?? row.createdAt.slice(0, 10))}
                  </span>
                </button>
              ))}
          </div>
        </section>

        <SettlementNoteCard
          note={settlementNote}
          emptyMessage="등록된 이사정산시 적요가 없어요"
        />
      </aside>
    );
  }

  if (selectedBuilding) {
    return (
      <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
          <div className="flex shrink-0 flex-col gap-[9px] border-b border-line2 px-[18px] py-[15px]">
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                aria-label="전체 건물로 돌아가기"
                onClick={() => selectBuilding(null)}
                className="grid size-[24px] place-items-center rounded-[7px] text-t2 hover:bg-bg"
              >
                <ChevronLeftIcon className="size-[16px]" />
              </button>
              <h2 className="truncate text-[15px] font-extrabold leading-[18px] text-t1">
                {selectedBuilding.name}
              </h2>
            </div>
            <label className="relative block">
              <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
              <input
                aria-label="호수·세대주 검색"
                value={tenantSearch}
                onChange={(event) => setTenantSearch(event.target.value)}
                placeholder="호수·세대주 검색"
                className="h-[32px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-teal"
              />
            </label>
          </div>
          <div className="grid h-[37px] shrink-0 grid-cols-[64px_1fr] border-b border-line bg-[#fbfcfd] text-[12px] font-bold leading-[15px] text-t3">
            <span className="px-[16px] py-[11px]">호수</span>
            <span className="px-[16px] py-[11px]">세대주</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {(unitsLoading || tenantQuery.isLoading) && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                호실을 불러오고 있어요
              </p>
            )}
            {!unitsLoading && !tenantQuery.isLoading && tenantSearch.trim() !== "" && visibleTenants.length === 0 && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                검색 결과가 없어요
              </p>
            )}
            {!unitsLoading && !tenantQuery.isLoading && tenantSearch.trim() === "" && tenants.length === 0 && (
              <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
                등록된 호실이 없어요
              </p>
            )}
            {visibleTenants.map((tenant) => {
              const vacant = tenant.isVacant || !tenant.tenantName;
              return (
                <button
                  key={tenant.unitId}
                  type="button"
                  onClick={() => onSelectUnit(tenant.unitId)}
                  className="grid min-h-[41px] w-full grid-cols-[64px_1fr] border-b border-line2 text-left text-[13.5px] leading-[16px] text-t1 hover:bg-[#fbfcfd]"
                >
                  {/* 정본 셀(64px)은 pl 16 + 텍스트 자동폭이라 "101호"가 패딩 영역으로
                      넘치며 한 줄을 유지한다. nowrap 이 없으면 2줄로 접혀 행이 41→65px 로 커진다. */}
                  <span className="whitespace-nowrap px-[16px] py-[12px] font-bold">{tenant.unitNo}</span>
                  <span className={`truncate px-[16px] py-[12px] ${vacant ? "text-t4" : ""}`}>
                    {vacant ? "공실" : tenant.tenantName}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <SettlementNoteCard
          note={null}
          emptyMessage="건물과 호실을 선택하면 표시돼요"
        />
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="flex shrink-0 flex-col gap-[9px] border-b border-line2 px-[18px] py-[15px]">
          <h2 className="text-[15px] font-extrabold leading-[18px] text-t1">전체 건물</h2>
          <div className="flex items-center gap-[8px]">
            <label className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
              <input
                aria-label="건물·주소 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명·주소 검색"
                className="h-[32px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-teal"
              />
            </label>
            <div className={`flex-none ${dropdownCallSiteClass}`}>
              <CustomDropdown
                ariaLabel="건물 그룹"
                value={groupType}
                options={BUILDING_GROUP_FILTER_OPTIONS}
                compact
                onChange={setGroupType}
              />
            </div>
          </div>
        </div>
        <div className="grid h-[37px] shrink-0 grid-cols-[64px_96px_1fr] border-b border-line bg-[#fbfcfd] text-[12px] font-bold leading-[15px] text-t3">
          <span className="px-[16px] py-[11px]">코드</span>
          <span className="px-[16px] py-[11px]">건물명</span>
          <span className="px-[16px] py-[11px]">주소</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {buildingsLoading && (
            <p role="status" aria-label="건물 목록 불러오는 중" className="px-[16px] py-[14px] text-[12.5px] text-t4">
              건물을 불러오고 있어요
            </p>
          )}
          {!buildingsLoading && visibleBuildings.length === 0 && (
            <p className="px-[16px] py-[14px] text-[12.5px] text-t4">
              검색 결과가 없어요
            </p>
          )}
          {/* 원본 `.hf-tbl td{padding:12px 16px;font-size:13.5px}` → 행 높이 41px */}
          {visibleBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => selectBuilding(building.id)}
              className="grid min-h-[41px] w-full grid-cols-[64px_96px_1fr] border-b border-line2 text-left text-[13.5px] leading-[normal] text-t1 hover:bg-[#fbfcfd]"
            >
              <span className="px-[16px] py-[12px]">{building.code}</span>
              <span className="truncate px-[16px] py-[12px] font-bold">
                {building.name}
              </span>
              <span className="truncate px-[16px] py-[12px]">
                {building.address ?? "-"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <SettlementNoteCard
        note={null}
        emptyMessage="건물과 호실을 선택하면 표시돼요"
      />
    </aside>
  );
}
