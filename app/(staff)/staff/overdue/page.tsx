"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useStaffMintBillTokens } from "@/hooks/reactquery/residentBilling";
import {
  useOverdueBuildings,
  useOverdueHouseholds,
  useOverduePeriods,
  type OverdueHousehold,
  type OverduePeriodRow,
  type OverdueScope,
} from "@/hooks/reactquery/overdue";
import { hasModule } from "@/lib/auth/permissions";
import { computeLateFee, type OverduePeriodInput } from "@/lib/billing/lateFee";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { residentOrigin } from "@/lib/messaging/residentOrigin";
import { formatDate, formatKrw, formatPeriodMonth, formatUnit } from "@/lib/messaging/vars";
import { MessagingModal } from "../messaging/components/MessagingModal";
import { OverdueDetailModal } from "./components/OverdueDetailModal";
import { OverdueEmptyState } from "./components/OverdueEmptyState";
import { OverdueFloatingActions } from "./components/OverdueFloatingActions";
import { OverdueTable } from "./components/OverdueTable";
import { OverdueToolbar } from "./components/OverdueToolbar";
import { downloadOverdueLedger, isDebtCollectionTarget } from "./utils";

function latestOverduePeriod(
  household: OverdueHousehold,
  periods: OverduePeriodRow[],
): OverduePeriodRow | undefined {
  return periods.reduce<OverduePeriodRow | undefined>((latest, period) => {
    if (
      period.occupancyId !== household.occupancyId ||
      period.unitId !== household.unitId
    ) {
      return latest;
    }
    return !latest || period.period > latest.period ? period : latest;
  }, undefined);
}

export default function OverduePage() {
  const { data: me, isLoading: isMeLoading } = useMe();
  const canAccess = hasModule(me, "overdue");
  const canSendMessages = hasModule(me, "messaging");
  const { data: buildings = [], isLoading: isBuildingsLoading } =
    useOverdueBuildings(canAccess);

  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<{
    year: number | null;
    month: number | null;
  }>({ year: null, month: null });
  const [scope, setScope] = useState<OverdueScope>("all");
  const [debtFilterEnabled, setDebtFilterEnabled] = useState(false);
  const [detailHousehold, setDetailHousehold] = useState<OverdueHousehold | null>(null);
  const [messageRecipients, setMessageRecipients] = useState<MessageRecipient[]>([]);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);

  const hasPeriod = targetPeriod.year !== null && targetPeriod.month !== null;
  const readyBuildingId = canAccess && hasPeriod ? selectedBuildingId : null;
  const overdueQuery = {
    year: targetPeriod.year ?? undefined,
    month: targetPeriod.month ?? undefined,
    scope,
  };

  const {
    data: households = [],
    isLoading: isHouseholdsLoading,
    error: householdsError,
    refetch,
  } = useOverdueHouseholds(readyBuildingId, overdueQuery);
  const { data: overduePeriods = [] } = useOverduePeriods(readyBuildingId, overdueQuery);
  const { data: lateFeeRateTiers = [] } = useLateFeeRateTiers(me?.orgId ?? null);
  const { data: orgContact } = useOrgContact();
  const mintBillTokens = useStaffMintBillTokens();

  const rowsWithLateFee = useMemo(() => {
    if (households.length === 0 || targetPeriod.year === null || targetPeriod.month === null) {
      return households;
    }

    const periodsByHousehold = new Map<string, OverduePeriodInput[]>();
    for (const period of overduePeriods) {
      const key = `${period.occupancyId}:${period.unitId}`;
      periodsByHousehold.set(key, [
        ...(periodsByHousehold.get(key) ?? []),
        {
          period: period.period as OverduePeriodInput["period"],
          unpaidPrincipal: period.unpaidPrincipal,
          dueDate: period.dueDate,
        },
      ]);
    }

    return households.map((household) => {
      const result = computeLateFee(
        periodsByHousehold.get(`${household.occupancyId}:${household.unitId}`) ?? [],
        lateFeeRateTiers,
        targetPeriod.year as number,
        targetPeriod.month as number,
      );
      return {
        ...household,
        lateFeeAmount: result.totalLateFee,
        lateFeeByPeriod: result.byPeriod,
      };
    });
  }, [households, lateFeeRateTiers, overduePeriods, targetPeriod.month, targetPeriod.year]);

  const selectedBuilding =
    buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const messageTargets = useMemo(
    () => rowsWithLateFee.filter(isDebtCollectionTarget),
    [rowsWithLateFee],
  );
  const visibleHouseholds = useMemo(
    () => (debtFilterEnabled ? messageTargets : rowsWithLateFee),
    [debtFilterEnabled, messageTargets, rowsWithLateFee],
  );
  const messageTargetKeys = useMemo(
    () => new Set(messageTargets.map((row) => `${row.occupancyId}:${row.unitId}`)),
    [messageTargets],
  );
  const messageItemCount = useMemo(() => {
    const count = overduePeriods.filter((period) =>
      messageTargetKeys.has(`${period.occupancyId}:${period.unitId}`),
    ).length;
    return count || messageTargets.length;
  }, [messageTargetKeys, messageTargets.length, overduePeriods]);

  const resetResultState = () => {
    setDebtFilterEnabled(false);
    setDetailHousehold(null);
    setMessageRecipients([]);
    setIsMessagingOpen(false);
  };

  const changeBuilding = (buildingId: number | null) => {
    setSelectedBuildingId(buildingId);
    resetResultState();
  };

  const changePeriod = (year: number | null, month: number | null) => {
    setTargetPeriod({ year, month });
    resetResultState();
  };

  const changeScope = (nextScope: OverdueScope) => {
    setScope(nextScope);
    resetResultState();
  };

  const exportLedger = () => {
    if (!selectedBuilding || visibleHouseholds.length === 0) {
      toast.info("출력할 미납 세대가 없습니다.");
      return;
    }

    try {
      const filename = downloadOverdueLedger(selectedBuilding.name, visibleHouseholds);
      toast.success(`${filename} 파일을 저장했습니다.`);
    } catch {
      toast.error("미납대장을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const openMessagingModal = async () => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (messageTargets.length === 0) {
      toast.info("발송할 대상이 없어요");
      return;
    }

    const unitIdsByPeriod = new Map<string, number[]>();
    for (const row of messageTargets) {
      const latestPeriod = latestOverduePeriod(row, overduePeriods);
      if (!latestPeriod) {
        toast.error("미납 고지서 기준 월을 확인할 수 없습니다.");
        return;
      }
      unitIdsByPeriod.set(latestPeriod.period, [
        ...(unitIdsByPeriod.get(latestPeriod.period) ?? []),
        row.unitId,
      ]);
    }

    try {
      const mintedGroups = await Promise.all(
        [...unitIdsByPeriod].map(([period, unitIds]) =>
          mintBillTokens.mutateAsync({ unitIds, period }),
        ),
      );
      const tokenByUnitId = new Map(
        mintedGroups.flat().map(({ unitId, token }) => [unitId, token]),
      );
      const origin = residentOrigin();
      const recipients: MessageRecipient[] = messageTargets.flatMap((row) => {
        const latestPeriod = latestOverduePeriod(row, overduePeriods);
        const token = tokenByUnitId.get(row.unitId);
        if (!latestPeriod || !token) {
          throw new Error("미납 고지서 상세 링크를 만들지 못했습니다.");
        }
        const unit = formatUnit(row.dong, row.unitNo);

        return [row.phone, row.phone2]
          .filter((phone, index, values): phone is string =>
            Boolean(phone) && values.indexOf(phone) === index,
          )
          .map((phone) => ({
            name: row.tenantName ?? null,
            phone,
            unitNo: unit,
            kind: "tenant" as const,
            variables: {
              세대: unit,
              미납금액: formatKrw(row.overdueAmount),
              미납월: formatPeriodMonth(latestPeriod.period),
              납기일: formatDate(latestPeriod.dueDate),
              상세링크: `${origin}/r/${token}`,
            },
            ref: {
              occupancyId: row.occupancyId,
              unitId: row.unitId,
              buildingId: row.buildingId,
            },
          }));
      });

      setMessageRecipients(recipients);
      setIsMessagingOpen(true);
      toast.success(`${messageTargets.length}세대를 수신자로 담았어요`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "미납 고지서 상세 링크를 만들지 못했습니다.",
      );
    }
  };

  if (isMeLoading) {
    return (
      <div className="flex h-[calc(100dvh-62px)] items-center justify-center" aria-label="권한 확인 중">
        <Spinner />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="h-[calc(100dvh-62px)] p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-62px)] min-h-[520px] bg-bg px-[24px] pb-[24px] pt-[22px]">
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <OverdueToolbar
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onBuildingChange={changeBuilding}
          targetYear={targetPeriod.year}
          targetMonth={targetPeriod.month}
          scope={scope}
          onPeriodChange={changePeriod}
          onScopeChange={changeScope}
          debtFilterEnabled={debtFilterEnabled}
          onToggleDebtFilter={() => setDebtFilterEnabled((current) => !current)}
          onSend={() => void openMessagingModal()}
          onExport={exportLedger}
          canSend={!isHouseholdsLoading && canSendMessages}
          canExport={!isHouseholdsLoading}
          disabled={isBuildingsLoading}
        />

        {!hasPeriod ? (
          <OverdueEmptyState
            title="년도와 월을 선택해 주세요"
            description="조회 기간을 고르면 미납 내역이 표시돼요"
          />
        ) : selectedBuildingId === null ? (
          <OverdueEmptyState
            title="건물명을 검색해 선택해 주세요"
            description="선택한 건물의 미납 내역을 조회할 수 있어요"
          />
        ) : isHouseholdsLoading ? (
          <div aria-label="미납 세대 조회 중" className="flex min-h-0 flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : householdsError ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[12px] text-center">
            <p className="text-[13.5px] text-t3">미납 내역을 불러오지 못했어요</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="h-[34px] rounded-[9px] border border-line bg-white px-[14px] text-[13px] font-bold text-t2"
            >
              다시 조회
            </button>
          </div>
        ) : visibleHouseholds.length === 0 ? (
          <OverdueEmptyState
            title={debtFilterEnabled ? "독촉 대상이 없어요" : "조회 결과가 없어요"}
            description={debtFilterEnabled ? "독촉 기준을 만족하는 미납 세대가 없어요" : "다른 조회 조건을 선택해 보세요"}
          />
        ) : (
          <OverdueTable
            rows={visibleHouseholds}
            periods={overduePeriods}
            onRowClick={setDetailHousehold}
          />
        )}
      </section>

      <OverdueFloatingActions />
      <OverdueDetailModal household={detailHousehold} onClose={() => setDetailHousehold(null)} />
      <MessagingModal
        open={isMessagingOpen}
        presentation="workspace"
        itemCount={messageItemCount}
        preset={{
          context: "독촉",
          buildingId: selectedBuildingId ?? undefined,
          channel: "sms",
          mode: "sms",
          templateTitle: "관리비 미납 안내",
          recipients: messageRecipients,
          commonVariables: {
            건물명: selectedBuilding?.name ?? "",
            관리사무소연락처: orgContact?.phone ?? "",
          },
        }}
        onClose={() => setIsMessagingOpen(false)}
        onSent={(result) => {
          toast.success(`독촉 안내 ${result.count}건 발송을 접수했습니다.`);
          setIsMessagingOpen(false);
        }}
      />
    </div>
  );
}
