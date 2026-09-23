// 건물 '고지서 부과 그룹 유형'(buildings.basic_extra.groupType, 1~5).
// 건물 등록·수정 폼과 목록 레일의 '그룹 전체' 필터(관리비·이사정산)가 같은 값을 쓴다.
export const BUILDING_GROUP_TYPES = ["1", "2", "3", "4", "5"] as const;
export const DEFAULT_BUILDING_GROUP_TYPE = BUILDING_GROUP_TYPES[0];

export interface BuildingGroupSource {
  basicExtra?: { groupType?: string | null } | null;
}

// 그룹을 저장한 적 없는 건물은 건물 폼이 보여주는 기본값(1)과 같게 본다.
export function effectiveBuildingGroupType(
  building: BuildingGroupSource | null | undefined,
): string {
  const groupType = building?.basicExtra?.groupType;
  return groupType === null || groupType === undefined || groupType === ""
    ? DEFAULT_BUILDING_GROUP_TYPE
    : groupType;
}

export interface BuildingGroupFilterOption {
  value: string;
  label: string;
}

export const BUILDING_GROUP_FILTER_OPTIONS: BuildingGroupFilterOption[] = [
  { value: "", label: "그룹 전체" },
  ...BUILDING_GROUP_TYPES.map((value) => ({ value, label: value })),
];

export function matchesBuildingGroup(
  building: BuildingGroupSource,
  groupType: string,
): boolean {
  return groupType === "" || effectiveBuildingGroupType(building) === groupType;
}
