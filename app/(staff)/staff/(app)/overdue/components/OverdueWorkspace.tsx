"use client";

import { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Spinner } from "@/components/common";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { signedBillPath, useStaffSignBillUrls } from "@/hooks/reactquery/residentBilling";
import {
  useOverdueHouseholds,
  useOverduePeriods,
  type OverdueHousehold,
  type OverduePeriodRow,
  type OverdueScope,
} from "@/hooks/reactquery/overdue";
import { computeLateFee, type OverduePeriodInput } from "@/lib/billing/lateFee";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { openMessengerWith } from "@/lib/messaging/messengerHandoff";
import { residentOrigin } from "@/lib/messaging/residentOrigin";
import { formatDate, formatKrw, formatPeriodMonth, formatUnit } from "@/lib/messaging/vars";
import { isDebtCollectionTarget } from "../utils";
import { OverdueLedgerPrintView } from "./OverdueLedgerPrintView";
import { OverdueEmptyState } from "./OverdueEmptyState";
import { OverdueFloatingActions } from "./OverdueFloatingActions";
import { OverdueTable } from "./OverdueTable";
import { OverdueToolbar } from "./OverdueToolbar";
import { useOverdueOrgContact } from "./useOverdueOrgContact";

/**
 * 정본 `#ovDunSend` 가 `#fmpMsg` 에 채우는 본문 그대로다. 변수 표기만 앱 렌더러 문법
 * (`#{키}`)으로 옮겼다 — `건물명`·`호수` 는 공용 렌더러가 수신자에서 채우고,
 * `미납개월`·`미납금액` 은 아래에서 수신자별 변수로 넣는다.
 */
const DUNNING_BODY = [
  "[관리비 미납 안내]",
  "",
  "#{건물명} #{호수} 세대주님께 안내드립니다.",
  "",
  "· 미납 개월 : #{미납개월}개월",
  "· 미납 금액 : #{미납금액}원 (연체료 포함)",
  "",
  "2개월 이상 · 10만원 이상 장기 미납 상태입니다.",
  "조속히 납부해 주시기 바라며, 계속 미납될 경우 연체료가 추가되고 관련 절차가 진행될 수 있습니다.",
].join("\n");

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

export function OverdueWorkspace({
  orgId,
  canSendMessages,
}: {
  orgId: number;
  canSendMessages: boolean;
}) {
  const [search, setSearch] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<{
    year: number | null;
    month: number | null;
  }>({ year: null, month: null });
  const [scope, setScope] = useState<OverdueScope>("all");
  const [debtFilterEnabled, setDebtFilterEnabled] = useState(false);

  // 정본과 같다 — 년·월만 고르면 org 전체 건물을 조회하고, 건물명은 결과를 거르는 검색어다.
  const hasPeriod = targetPeriod.year !== null && targetPeriod.month !== null;
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
  } = useOverdueHouseholds(null, overdueQuery, hasPeriod);
  const { data: overduePeriods = [] } = useOverduePeriods(null, overdueQuery, hasPeriod);
  const { data: lateFeeRateTiers = [] } = useLateFeeRateTiers(orgId);
  // "납.후연체" 는 /staff/setup 고지서 설정의 납기후 가산율로 계산한다(0187).
  const { data: setupConfig } = useSetupConfig(orgId);
  const postDueRatePct = setupConfig?.lateFeePostDueRate ?? 0;
  const { data: orgContact } = useOverdueOrgContact(orgId);
  const signBillUrls = useStaffSignBillUrls();

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
        postDueRatePct,
      );
      return {
        ...household,
        lateFeeAmount: result.totalLateFee,
        postDueFeeAmount: result.totalPostDueFee,
        lateFeeByPeriod: result.byPeriod,
      };
    });
  }, [households, lateFeeRateTiers, overduePeriods, postDueRatePct, targetPeriod.month, targetPeriod.year]);

  // 정본은 미납이 있는 세대만 표에 넣는다(`build()` 가 미납 세대만 만든다).
  // 앱은 점유 세대를 전부 조회하므로 잔액 0 인 세대를 여기서 걸러낸다 —
  // 안 걸러내면 0원 행이 표를 채우고 합계행의 "항목 N / M건"도 전 세대 수가 된다.
  // 검색어는 정본 `view()` 와 같은 규칙(건물명 + 동호 부분일치, 대소문자 무시).
  const overdueHouseholds = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    return rowsWithLateFee.filter((household) => {
      if (household.overdueAmount <= 0) return false;
      if (!keyword) return true;
      const haystack = `${household.buildingName}${household.dong ?? ""}${household.unitNo}`
        .toLocaleLowerCase("ko-KR");
      return haystack.includes(keyword);
    });
  }, [rowsWithLateFee, search]);
  const messageTargets = useMemo(
    () => overdueHouseholds.filter(isDebtCollectionTarget),
    [overdueHouseholds],
  );
  const visibleHouseholds = useMemo(
    () => (debtFilterEnabled ? messageTargets : overdueHouseholds),
    [debtFilterEnabled, messageTargets, overdueHouseholds],
  );
  const resetResultState = () => {
    setDebtFilterEnabled(false);
  };

  const changePeriod = (year: number | null, month: number | null) => {
    setTargetPeriod({ year, month });
    resetResultState();
  };

  const changeScope = (nextScope: OverdueScope) => {
    setScope(nextScope);
    resetResultState();
  };

  // 정본 `#ovPrint` 와 같다 — 내려받기가 아니라 브라우저 인쇄로 A4 시트를 뽑는다.
  const exportLedger = () => {
    if (visibleHouseholds.length === 0) {
      toast.info("출력할 내역이 없어요");
      return;
    }
    window.print();
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

    // 상세링크는 정본 본문에 없는 앱 전용 변수다. 만들지 못해도(예: 세입자 앱 origin 미설정)
    // 발송 자체를 막지 않는다 — 링크만 비우고 진행한다. 예전에는 여기서 던져
    // "미납 고지서 상세 링크를 만들지 못했습니다" 토스트만 뜨고 패널이 아예 안 열렸다.
    let signedByUnitId = new Map<number, Awaited<ReturnType<typeof signBillUrls.mutateAsync>>[number]>();
    let origin = "";
    try {
      const signedGroups = await Promise.all(
        [...unitIdsByPeriod].map(([period, unitIds]) =>
          signBillUrls.mutateAsync({ unitIds, period }),
        ),
      );
      signedByUnitId = new Map(signedGroups.flat().map((link) => [link.unitId, link]));
      origin = residentOrigin();
    } catch (error) {
      console.error("미납 고지서 상세 링크 생성 실패 — 링크 없이 진행합니다", error);
    }

    {
      const recipients: MessageRecipient[] = messageTargets.flatMap((row) => {
        const latestPeriod = latestOverduePeriod(row, overduePeriods);
        const signed = signedByUnitId.get(row.unitId);
        if (!latestPeriod) return [];
        const unit = formatUnit(row.dong, row.unitNo);
        const detailLink = signed && origin
          ? `${origin}${signedBillPath({
              buildingId: signed.buildingId,
              unitNo: signed.unitNo,
              period: latestPeriod.period,
              sig: signed.sig,
              issuedDay: signed.issuedDay,
            })}`
          : "";

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
              // 전체 건물 조회라 수신자마다 건물이 다르다 → 건물명은 공통변수가 아니라 여기서 준다.
              건물명: row.buildingName,
              세대: unit,
              // 정본 본문은 "연체료 포함" 금액과 미납 개월수를 쓴다.
              미납개월: String(row.overdueMonths),
              미납금액: formatKrw(
                row.overdueAmount + (row.lateFeeAmount ?? 0) + (row.postDueFeeAmount ?? 0),
              ),
              미납월: formatPeriodMonth(latestPeriod.period),
              납기일: formatDate(latestPeriod.dueDate),
              상세링크: detailLink,
              // FAB 경로에는 공통변수 개념이 없어, 예전 preset.commonVariables 로 주던 값도
              // 수신자별 변수로 옮긴다(본문에서 #{관리사무소연락처} 를 계속 쓸 수 있게).
              관리사무소연락처: orgContact?.phone ?? "",
            },
            ref: {
              occupancyId: row.occupancyId,
              unitId: row.unitId,
              buildingId: row.buildingId,
            },
          }));
      });

      // 정본과 같다 — 별도 모달이 아니라 공용 메신저 FAB 패널을 열고 본문을 채운다.
      openMessengerWith({ recipients, body: DUNNING_BODY, channel: "sms" });
      toast.success(`${messageTargets.length}세대를 수신자로 담았어요`);
    }
  };

  return (
    <>
      <div className="h-[calc(100dvh-62px)] min-h-[520px] bg-bg px-[24px] pb-[24px] pt-[22px] print:hidden">
        {/* 정본 `.hf-body>.hf-panel{overflow:visible}` — 툴바 드롭다운 메뉴가 패널 밖으로
            나가야 해서 클리핑하지 않는다. 아래 모서리는 표 래퍼/합계행이 직접 둥글린다. */}
        <section className="flex h-full min-h-0 flex-col overflow-visible rounded-[16px] bg-white shadow-card">
          <OverdueToolbar
            search={search}
            onSearchChange={setSearch}
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
          />

          {/* 정본은 조회 준비 상태를 년·월만 보고 판단한다(`ready = !!(oy && om)`) — 건물은
              표를 거르는 검색어일 뿐 선택 게이트가 없다. 앱은 조회 RPC에 건물이 필요해
              게이트가 남지만, 문구는 정본의 한 가지로 통일한다(사용자 결정 2026-09-21). */}
          {!hasPeriod ? (
            <OverdueEmptyState
              title="년도와 월을 선택해 주세요"
              description="조회 기간을 고르면 미납 내역이 표시돼요"
            />
          ) : isHouseholdsLoading ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center">
              <Spinner label="미납 세대 조회 중" showLabel />
            </div>
          ) : householdsError ? (
            <div role="alert" className="flex min-h-[360px] flex-1 flex-col items-center justify-center gap-[12px] text-center">
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
            />
          )}
        </section>

        <OverdueFloatingActions />
      </div>

      {hasPeriod && visibleHouseholds.length > 0 && (
        <OverdueLedgerPrintView
          year={targetPeriod.year as number}
          month={targetPeriod.month as number}
          rows={visibleHouseholds}
          periods={overduePeriods}
        />
      )}
    </>
  );
}
