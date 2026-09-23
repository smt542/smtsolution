import { useQueries } from "@tanstack/react-query";
import { getTenantCardPrintData, occupancyKeys, type TenantCardRow } from "@/hooks/reactquery/occupancies";
import { getBillDocuments, listBillTargets, type BillDocument } from "./apis";
import { billKeys } from "./keys";

/** 출력 모달 패널 하나의 조회 상태. */
export type OutputQueryStatus = "loading" | "error" | "ready";

export interface TenantOutputBuildingData {
  buildingId: number;
  tenants: TenantCardRow[];
  cardStatus: OutputQueryStatus;
  documents: BillDocument[];
  statementStatus: OutputQueryStatus;
}

/**
 * 입주자카드·부과내역 출력 모달 — 선택한 건물마다 입주자카드 인쇄 데이터·부과 대상·부과 문서를 병렬 조회한다.
 * 단일 건물 훅(useTenantCardPrintData·useBillTargets·useBillDocuments)과 같은 query key·API라 캐시를 공유한다
 * (선례: useAdjustmentStatements). 반환 순서 = buildingIds 순서.
 */
export function useTenantOutputData(buildingIds: number[], period: string): TenantOutputBuildingData[] {
  const cardQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: occupancyKeys.tenantCardPrint(buildingId),
      queryFn: () => getTenantCardPrintData(buildingId),
      // 원문 연락처가 담긴 응답이므로 화면을 벗어나면 캐시에 남기지 않는다(useTenantCardPrintData와 같다).
      gcTime: 0,
    })),
  });
  const targetQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: billKeys.targets(buildingId, period),
      queryFn: () => listBillTargets(buildingId, period),
    })),
  });
  const documentQueries = useQueries({
    queries: buildingIds.map((buildingId, index) => {
      const unitIds = (targetQueries[index]?.data ?? []).map((target) => target.unitId);
      return {
        queryKey: billKeys.documents(buildingId, period, unitIds),
        queryFn: () => getBillDocuments(buildingId, period, unitIds),
        enabled: unitIds.length > 0,
      };
    }),
  });

  // 콜백 반환 타입을 명시해야 상태 리터럴이 string으로 넓혀지지 않는다.
  return buildingIds.map((buildingId, index): TenantOutputBuildingData => {
    const card = cardQueries[index];
    const target = targetQueries[index];
    const document = documentQueries[index];
    const hasUnits = (target?.data?.length ?? 0) > 0;
    return {
      buildingId,
      tenants: card?.data ?? [],
      cardStatus: card?.isError ? "error" : card?.isPending ? "loading" : "ready",
      documents: hasUnits ? (document?.data ?? []) : [],
      // 부과 대상이 없으면 문서 쿼리는 꺼져 있어(pending·idle) 로딩으로 치지 않는다.
      statementStatus:
        target?.isError || (hasUnits && document?.isError)
          ? "error"
          : target?.isPending || (hasUnits && document?.isPending)
            ? "loading"
            : "ready",
    };
  });
}
