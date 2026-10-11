"use client";

import { useMemo } from "react";
import type { Building } from "@/hooks/reactquery/buildings";
import { useOrganizationTenantList } from "@/hooks/reactquery/occupancies";
import type { RecipientCheckOption } from "@/components/messenger/RecipientCheckSelect";

/**
 * 공지 대상 건물 기준의 수신 가능 입주자 산출. 상세 모달의 발송(useNoticeAlimtalkSend)과
 * 등록 모달의 수신자 수 미리보기가 같은 대상·같은 숫자를 쓰도록 공유한다.
 *
 * selectedBuildingIds: 빈 배열 = 전체(org 전 건물), 다중 = 지정 건물들, null = 선택 없음(수신자 없음).
 * 「대상자」 선택지: 입주 중이고 전화번호가 있는 입주 1건 = 1명(전화가 여럿이어도 한 줄).
 */
export function useNoticeTargetTenants(buildings: Building[], selectedBuildingIds: number[] | null) {
  const isSingleBuilding = selectedBuildingIds?.length === 1;
  const targetBuildingIds = selectedBuildingIds === null
    ? []
    : selectedBuildingIds.length > 0
      ? selectedBuildingIds
      : buildings.map((building) => building.id);

  const organizationTenants = useOrganizationTenantList(targetBuildingIds);
  const tenantRows = organizationTenants.data;

  const tenantOptions = useMemo<RecipientCheckOption[]>(() => {
    const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));
    const seen = new Set<number>();
    const options: RecipientCheckOption[] = [];
    for (const tenant of tenantRows) {
      if (tenant.isVacant || tenant.occupancyId === null || seen.has(tenant.occupancyId)) continue;
      const hasPhone = [tenant.phone, ...tenant.phonesMore].some((phone) => Boolean(phone?.replace(/\D/g, "")));
      if (!hasPhone) continue;
      seen.add(tenant.occupancyId);
      options.push({
        key: tenant.occupancyId,
        name: tenant.tenantName,
        sub: isSingleBuilding
          ? tenant.unitNo
          : `${buildingNames.get(tenant.buildingId) ?? ""} ${tenant.unitNo}`.trim(),
      });
    }
    return options;
  }, [buildings, isSingleBuilding, tenantRows]);

  return {
    isSingleBuilding,
    targetBuildingIds,
    tenantRows,
    tenantOptions,
    isLoading: organizationTenants.isLoading,
  };
}
