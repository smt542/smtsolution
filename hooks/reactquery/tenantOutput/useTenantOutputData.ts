import { useQueries } from "@tanstack/react-query";
import { billKeys, getBillDocuments, listBillTargets, type BillDocument } from "@/hooks/reactquery/bill";
import { buildingKeys, getBuildingFull, type Building, type BuildingFull } from "@/hooks/reactquery/buildings";
import { feeItemKeys, listFeeItems, type FeeItem } from "@/hooks/reactquery/feeItems";
import { listUtilityRows, utilityKeys, type UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { getTenantCardSheetRows, type TenantCardSheetRow } from "./apis";
import { tenantOutputKeys } from "./keys";

/** 출력 모달 패널 하나의 조회 상태. */
export type OutputQueryStatus = "loading" | "error" | "ready";

export interface TenantOutputBuildingData {
  buildingId: number;
  cardRows: TenantCardSheetRow[];
  buildingFull: BuildingFull | null;
  cardStatus: OutputQueryStatus;
  documents: BillDocument[];
  feeItems: FeeItem[];
  elecRows: UtilityUnitRow[];
  waterRows: UtilityUnitRow[];
  statementStatus: OutputQueryStatus;
}

type QueryState = { isError: boolean; isPending: boolean } | undefined;
const statusOf = (queries: QueryState[]): OutputQueryStatus =>
  queries.some((query) => query?.isError) ? "error" : queries.some((query) => query?.isPending) ? "loading" : "ready";

/**
 * 입주자카드·부과내역 출력 모달 — 선택 건물마다 양식에 필요한 데이터를 병렬 조회한다.
 * 단일 화면 훅과 같은 query key·API를 써서 캐시를 공유한다(선례: useAdjustmentStatements).
 * 부과내역서용 조회(문서·부과 항목·검침)는 확정 세대가 있는 건물만 켠다. 반환 순서 = buildings 순서.
 */
export function useTenantOutputData(buildings: Building[], period: string): TenantOutputBuildingData[] {
  const cardQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: tenantOutputKeys.cardRows(building.id),
      queryFn: () => getTenantCardSheetRows(building.id),
      // 원문 연락처가 담긴 응답이라 화면을 벗어나면 캐시에 남기지 않는다.
      gcTime: 0,
    })),
  });
  const fullQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: buildingKeys.full(building.id),
      queryFn: () => getBuildingFull(building.id),
    })),
  });
  const targetQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: billKeys.targets(building.id, period),
      queryFn: () => listBillTargets(building.id, period),
    })),
  });
  const hasUnits = (index: number) => (targetQueries[index]?.data?.length ?? 0) > 0;
  const documentQueries = useQueries({
    queries: buildings.map((building, index) => {
      const unitIds = (targetQueries[index]?.data ?? []).map((target) => target.unitId);
      return {
        queryKey: billKeys.documents(building.id, period, unitIds),
        queryFn: () => getBillDocuments(building.id, period, unitIds),
        enabled: unitIds.length > 0,
      };
    }),
  });
  const feeItemQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: feeItemKeys.list(building.typeId ?? 0),
      queryFn: () => listFeeItems(building.typeId as number),
      enabled: building.typeId != null && hasUnits(index),
    })),
  });
  const elecQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: utilityKeys.rows(building.id, "electricity", period),
      queryFn: () => listUtilityRows(building.id, "electricity", period),
      enabled: hasUnits(index),
    })),
  });
  const waterQueries = useQueries({
    queries: buildings.map((building, index) => ({
      queryKey: utilityKeys.rows(building.id, "water", period),
      queryFn: () => listUtilityRows(building.id, "water", period),
      enabled: hasUnits(index),
    })),
  });

  // 콜백 반환 타입을 명시해야 상태 리터럴이 string으로 넓혀지지 않는다.
  return buildings.map((building, index): TenantOutputBuildingData => {
    const units = hasUnits(index);
    const typed = building.typeId != null;
    return {
      buildingId: building.id,
      cardRows: cardQueries[index]?.data ?? [],
      buildingFull: fullQueries[index]?.data ?? null,
      cardStatus: statusOf([cardQueries[index], fullQueries[index]]),
      documents: units ? (documentQueries[index]?.data ?? []) : [],
      feeItems: units && typed ? (feeItemQueries[index]?.data ?? []) : [],
      elecRows: units ? (elecQueries[index]?.data ?? []) : [],
      waterRows: units ? (waterQueries[index]?.data ?? []) : [],
      // 꺼진 쿼리(pending·idle)는 로딩으로 치지 않는다.
      statementStatus: statusOf([
        targetQueries[index],
        units ? documentQueries[index] : undefined,
        units && typed ? feeItemQueries[index] : undefined,
        units ? elecQueries[index] : undefined,
        units ? waterQueries[index] : undefined,
      ]),
    };
  });
}
