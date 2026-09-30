"use client";

import { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, IconButton, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSaveBuildingNotes } from "@/hooks/reactquery/receipts";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import type { Unit } from "@/hooks/reactquery/units";
import { unitLabel } from "../receiptFormat";
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

// 정본 `.hf-tbl th` — 배경·굵기는 th 자신에 준다(<thead>/<tr> 클래스는 th 의 UA bold 를 못 이긴다).
const TH_CLASS =
  "whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[16px] py-[11px] text-left text-[12px] font-bold text-t3";
// 정본 `#rcBldBody td,#rcUnitBody td{nowrap;overflow:hidden;ellipsis}` + 첫 칸은 overflow visible·clip.
const TD_CLASS = "overflow-hidden text-ellipsis whitespace-nowrap px-[16px] py-[12px] text-[13.5px]";
const TD_FIRST_CLASS = "overflow-visible whitespace-nowrap px-[16px] py-[12px] text-[13.5px] [text-overflow:clip]";
// 정본 빈 행 `<td class="dsh" style="text-align:center;padding:26px 0">` (#rcUnitBody td.dsh = t4·400).
const EMPTY_TD_CLASS = "py-[26px] text-center text-[13.5px] font-normal text-t4";
// 정본 `#rcUnitTbl.slide`(rcInR)·`#rcBldTbl.slide`(rcInL): 들어오는 표만 옆에서 밀려 들어오고, 나가는 표는 바로 사라진다.
const SLIDE_IN_UNITS_CLASS = "animate-[rc-in-r_0.22s_cubic-bezier(0.22,0.8,0.3,1)_both] motion-reduce:animate-none";
const SLIDE_IN_BUILDINGS_CLASS = "animate-[rc-in-l_0.22s_cubic-bezier(0.22,0.8,0.3,1)_both] motion-reduce:animate-none";

export function BuildingUnitRail({
  buildings,
  units,
  receiptRows,
  isBuildingsLoading,
  isUnitsLoading,
  canEdit,
  view,
  viewSeq,
  selectedBuildingId,
  selectedUnitId,
  onSelectBuilding,
  onSelectUnit,
  onBack,
}: {
  buildings: BuildingLite[];
  units: Unit[];
  receiptRows: ReceiptPaymentRow[];
  isBuildingsLoading: boolean;
  isUnitsLoading: boolean;
  canEdit: boolean;
  view: "building" | "unit";
  /** 목록 전환 횟수(정본 `setView` 호출 수). 바뀔 때마다 목록을 맨 위로 올리고 들어오는 표의 슬라이드를 처음부터 재생한다. */
  viewSeq: number;
  selectedBuildingId: number | null;
  selectedUnitId: number | null;
  onSelectBuilding: (id: number) => void;
  onSelectUnit: (id: number) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  // 정본은 건물을 바꿔도 메모 패널의 탭(수납 건물 메모/부과시 참조사항)을 유지한다.
  const [noteTab, setNoteTab] = useState<NoteTab>("memo");
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;
  const showUnits = view === "unit" && selectedBuilding !== null;
  const searchLabel = showUnits ? "호수·세대주 검색" : "건물명·주소 검색";
  // 첫 화면은 전환이 아니므로 재생하지 않는다.
  const slideClass = viewSeq === 0 ? "" : showUnits ? SLIDE_IN_UNITS_CLASS : SLIDE_IN_BUILDINGS_CLASS;

  const selectBuilding = (building: BuildingLite) => {
    setSearch("");
    onSelectBuilding(building.id);
  };

  const showBuildingList = () => {
    setSearch("");
    onBack();
  };

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
        {/* 정본 `.rc-bld > .hf-panel-h`: 머리는 전환 때 움직이지 않고 뒤로가기·제목(#rcPanelT)·검색 문구만 바뀐다. */}
        <div className="flex flex-wrap items-center gap-[8px] px-[18px] py-[15px] border-b border-line2">
          {showUnits && (
            <IconButton
              onClick={showBuildingList}
              aria-label="건물 목록으로"
              title="건물 목록으로"
              className="size-[24px] flex-none rounded-[7px] text-t2 transition-transform duration-[120ms] ease-[ease] hover:bg-bg hover:text-t1 active:-translate-x-0.5"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-[16px]">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          )}
          <h2 className="min-w-0 truncate whitespace-nowrap text-[15px] font-extrabold leading-[normal] text-t1">
            {showUnits ? selectedBuilding.name : "전체 건물"}
          </h2>
          <div className="relative basis-full w-full">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              className="h-[32px] w-full rounded-[9px] border border-line bg-surface pl-[31px] pr-[11px] text-[13px] font-semibold leading-[normal] text-t1 placeholder:text-[#757575] outline-none focus:border-teal"
            />
          </div>
        </div>
        {/* 정본 #rcListWrap: 슬라이드 중 가로 스크롤을 막고 전환마다 scrollTop=0. 전환 횟수를 key 로 다시 그려
            스크롤 위치와 들어오는 표의 애니메이션을 함께 처음으로 돌린다. */}
        <div key={viewSeq} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {!showUnits && (isBuildingsLoading ? (
            <div className="flex min-h-[128px] items-center justify-center"><Spinner /></div>
          ) : (
            <table
              aria-label="건물 목록"
              className={`w-full table-fixed leading-[normal] ${slideClass}`}
            >
              <colgroup>
                <col className="w-[64px]" />
                <col className="w-[96px]" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className={TH_CLASS}>코드</th>
                  <th className={TH_CLASS}>건물명</th>
                  <th className={TH_CLASS}>주소</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuildings.map((b) => {
                  const active = b.id === selectedBuildingId;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => selectBuilding(b)}
                      className={`cursor-pointer border-b border-line2 last:border-0 ${active ? "bg-teal-t" : "hover:bg-row-hover-accent"}`}
                    >
                      <td className={`${TD_FIRST_CLASS} text-t1 num`}>{b.code}</td>
                      <td className={`${TD_CLASS} font-bold text-t1`} title={b.name}>{b.name}</td>
                      <td className={`${TD_CLASS} text-t1`} title={b.address ?? "-"}>{b.address ?? "-"}</td>
                    </tr>
                  );
                })}
                {/* 정본 drawBld 는 검색 결과가 없으면 빈 tbody 다. 건물이 아예 없는 조직은 정본에 없는 상태라 안내만 한 줄 둔다. */}
                {buildings.length === 0 && (
                  <tr>
                    <td colSpan={3} className={EMPTY_TD_CLASS}>등록된 건물이 없어요</td>
                  </tr>
                )}
              </tbody>
            </table>
          ))}
          {showUnits && (isUnitsLoading ? (
            <div className="flex min-h-[128px] items-center justify-center"><Spinner /></div>
          ) : (
            <table aria-label="호실 목록" className={`w-full table-fixed leading-[normal] ${slideClass}`}>
              <colgroup>
                {/* 정본 호수 칸은 64px(`101호`). 동이 붙는 건물(`A동 101호`)은 64px 을 넘쳐 세대주와 붙으므로 넓힌다. */}
                <col className={units.some((unit) => unit.dong) ? "w-[96px]" : "w-[64px]"} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className={TH_CLASS}>호수</th>
                  <th className={TH_CLASS}>세대주</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((u) => {
                  const active = u.id === selectedUnitId;
                  const tenantName = tenantByUnit.get(u.id);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => onSelectUnit(u.id)}
                      className={`cursor-pointer border-b border-line2 last:border-0 ${
                        active ? "bg-teal-t" : "hover:bg-row-hover-accent"
                      }`}
                    >
                      <td className={`${TD_FIRST_CLASS} font-bold text-t1`}>
                        {unitLabel(u)}
                      </td>
                      <td className={`${TD_CLASS} ${tenantName ? "text-t1" : "font-normal text-t4"}`} title={tenantName}>
                        {tenantName ?? "공실"}
                      </td>
                    </tr>
                  );
                })}
                {/* 정본 drawUnits: 목록이 비면 `검색 결과가 없어요` 한 줄. */}
                {filteredUnits.length === 0 && (
                  <tr>
                    <td colSpan={2} className={EMPTY_TD_CLASS}>검색 결과가 없어요</td>
                  </tr>
                )}
              </tbody>
            </table>
          ))}
        </div>
      </div>

      <BuildingNoteBlock
        key={selectedBuilding?.id ?? "none"}
        building={selectedBuilding}
        canEdit={canEdit}
        tab={noteTab}
        onTabChange={setNoteTab}
      />
    </aside>
  );
}

type NoteTab = "memo" | "ref";

// 정본 `textarea.rc-memo` — 읽기: 투명 1px 테두리 + 13/16/15 패딩, 편집: 청록 테두리·radius 10·margin 0 12 12·padding 11/12.
const NOTE_TEXTAREA_BASE =
  "block min-h-0 flex-1 resize-none overflow-auto border text-[13.5px] font-normal leading-[1.62] text-t1 outline-none placeholder:text-[#757575] [text-wrap:pretty]";
const NOTE_TEXTAREA_READ = `${NOTE_TEXTAREA_BASE} w-full border-transparent bg-transparent px-[16px] pb-[15px] pt-[13px]`;
const NOTE_TEXTAREA_EDIT = `${NOTE_TEXTAREA_BASE} mx-[12px] mb-[12px] rounded-[10px] border-teal bg-surface px-[12px] py-[11px]`;

/** canon `.rc-note`: 수납 건물 메모 / 부과시 참조사항 2탭 메모 패널. */
function BuildingNoteBlock({
  building,
  canEdit,
  tab,
  onTabChange,
}: {
  building: BuildingLite | null;
  canEdit: boolean;
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = useSaveBuildingNotes();

  const storedMemo = building?.memo ?? "";
  const storedBillingNote = building?.billingNote ?? "";
  const storedActive = tab === "memo" ? storedMemo : storedBillingNote;

  const persist = () => {
    if (!building) return Promise.resolve();
    return save.mutateAsync({
      buildingId: building.id,
      memo: tab === "memo" ? draft : storedMemo,
      billingNote: tab === "ref" ? draft : storedBillingNote,
    });
  };

  // 정본 noteSetEdit(false): 편집 중에 탭을 바꾸면 적던 내용을 저장하고 편집을 끝낸 뒤 탭을 바꾼다(토스트 없음).
  const selectTab = async (next: NoteTab) => {
    if (next === tab) return;
    if (editing) {
      try {
        await persist();
        setEditing(false);
      } catch (error) {
        toast.error(error, "저장하지 못했어요");
        return;
      }
    }
    onTabChange(next);
  };

  const startEdit = () => {
    if (!building) {
      toast.warning("건물을 선택해 주세요");
      return;
    }
    setDraft(storedActive);
    setEditing(true);
  };

  const submit = async () => {
    if (!building) return;
    try {
      await persist();
      toast.success("메모를 저장했어요");
      setEditing(false);
    } catch (error) {
      toast.error(error, "저장하지 못했어요");
    }
  };

  // 정본 syncMemo/syncNote 의 placeholder. 읽기·편집이 같은 textarea 라 문구도 같다.
  const placeholder = building === null
    ? "건물을 선택하면 표시돼요"
    : tab === "memo"
      ? "건물 단위 메모를 입력해 주세요"
      : "등록된 참조사항이 없어요";

  const tabClass = (active: boolean) =>
    `relative whitespace-nowrap pb-[10px] pt-[12px] text-[13.5px] transition-colors duration-[120ms] ${
      active
        ? "font-bold text-teal after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-[2px] after:bg-teal"
        : "font-semibold text-t4 hover:text-t2"
    }`;

  return (
    <div className="h-[168px] min-h-[90px] shrink-0 flex flex-col overflow-hidden rounded-2xl bg-surface leading-[normal] shadow-[0_1px_3px_rgba(23,31,40,0.05)]">
      <div className="flex flex-none items-center gap-[16px] px-[16px] border-b border-line">
        <button
          type="button"
          onClick={() => void selectTab("memo")}
          className={tabClass(tab === "memo")}
        >
          수납 건물 메모
        </button>
        <button
          type="button"
          onClick={() => void selectTab("ref")}
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
              className="h-[26px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold leading-[normal] text-white hover:bg-teal-d disabled:opacity-60"
            >
              {save.isPending ? "저장 중…" : "저장"}
            </button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={startEdit}
              className="leading-[normal]"
            >
              수정
            </Button>
          )
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={tab === "memo" ? "수납 건물 메모" : "부과시 참조사항"}
          className={NOTE_TEXTAREA_EDIT}
        />
      ) : (
        <textarea
          readOnly
          value={storedActive}
          placeholder={placeholder}
          aria-label={tab === "memo" ? "수납 건물 메모" : "부과시 참조사항"}
          className={NOTE_TEXTAREA_READ}
        />
      )}
    </div>
  );
}
