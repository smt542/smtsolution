"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/reactquery/auth";
import { billKeys, getBillDocuments, listBillDueDates, listBillTargets, type BillTarget } from "@/hooks/reactquery/bill";
import { billingKeys } from "@/hooks/reactquery/billing/keys";
import { getBillingPeriodSetting } from "@/hooks/reactquery/billing/apis";
import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates/apis";
import { useNotices } from "@/hooks/reactquery/notices";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useStaffSignBillUrls } from "@/hooks/reactquery/residentBilling";
import { useMintNoticeShareToken } from "@/hooks/reactquery/residentNotice";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { DEFAULT_BILL_PRINT_OPTIONS } from "@/lib/bill/document";
import {
  BILL_NOTICE_KIND_LABELS,
  BILL_NOTICE_TEMPLATE_CODES,
  BILL_NOTICE_TEMPLATE_TITLES,
  billNoticeAmounts,
  billNoticeChargePeriod,
  billNoticeCustomerNo,
  billNoticeDate,
  billNoticeDetailPath,
  billNoticeKind,
  billNoticeVariables,
  type BillNoticeKind,
} from "@/lib/messaging/billNotice";
import type { MessageRecipient } from "@/lib/messaging/preset";

/**
 * 플로팅 메신저(빠른발송) 알림톡 — 팝빌 승인 템플릿별 수신자 변수 자동 채움(2026-10-14).
 *  · 관리비 고지 3종(일반·자동이체·장기미납, 0309): 고른 부과월의 부과 확정 내역으로 세대별 금액·기간·마감일·고객번호를
 *    채우고, 발송 직전에 고지서 상세 링크(#{상세경로})를 서명 발급한다. 변수 규칙은 「관리비 고지서」 탭과 같다(lib/messaging/billNotice).
 *  · 신규 공지(공지 안내(신규)): 고른 공지의 제목(#{공지제목})을 넣고, 발송 직전에 공유 토큰으로 버튼 링크(#{버튼1})를 만든다.
 */
export type AlimtalkDynamicKind =
  | { type: "bill"; billKind: BillNoticeKind }
  | { type: "notice" }
  | null;

const BILL_KINDS = Object.keys(BILL_NOTICE_TEMPLATE_CODES) as BillNoticeKind[];

/** useQueries combine — 결과가 같으면 같은 객체를 돌려줘 아래 useMemo 가 렌더마다 다시 계산되지 않게 한다. */
function combineResults<T>(results: { data?: T; isLoading: boolean }[]) {
  return { data: results.map((result) => result.data), loading: results.some((result) => result.isLoading) };
}

/** 템플릿별 자동 채움 종류. 승인 코드(또는 0309 제목)로 관리비 고지를, 본문 #{공지제목}으로 공지를 알아본다. */
export function alimtalkDynamicKind(template: MessageTemplate | null): AlimtalkDynamicKind {
  if (!template) return null;
  const billKind = BILL_KINDS.find((kind) =>
    template.alimtalkTemplateCode === BILL_NOTICE_TEMPLATE_CODES[kind]
    || template.title === BILL_NOTICE_TEMPLATE_TITLES[kind]);
  if (billKind) return { type: "bill", billKind };
  if (/#\{\s*공지제목\s*\}/.test(template.body)) return { type: "notice" };
  return null;
}

/** 자동 채움 변수 이름(입력칸을 띄우지 않는다). */
export const DYNAMIC_VARIABLE_NAMES = new Set([
  "건물명", "호수", "관리비기간", "납부마감일", "출금예정일", "고객번호",
  "당월관리비", "미납관리비", "총납부금액", "관리실연락처", "상세경로", "공지제목", "버튼1",
]);

export interface AlimtalkDynamicResult {
  kind: AlimtalkDynamicKind;
  loading: boolean;
  /** 모든 수신자 공통 변수(공지: 공지제목). */
  commonVariables: Record<string, string>;
  /** 세대(unitId)별 변수(관리비 고지). 발송 직전 링크 변수는 resolveLinks 가 더한다. */
  variablesByUnit: Map<number, Record<string, string>>;
  /** 보낼 수 없는 수신자 사유(unitId → 사유). */
  excludedByUnit: Map<number, string>;
  /** 템플릿 전체를 막는 사유(관리실 연락처 없음·공지 미선택 등). */
  blocker: string | null;
  notices: { id: number; title: string }[];
  /** 발송 직전 링크 변수(공지 버튼1 = 공통, 관리비 상세경로 = 세대별)를 발급한다. 실패하면 throw. */
  resolveLinks: (unitIds: number[]) => Promise<{ common: Record<string, string>; byUnit: Map<number, Record<string, string>> }>;
}

export function useAlimtalkDynamicVariables({
  template,
  recipients,
  buildingNames,
  period,
  noticeId,
}: {
  template: MessageTemplate | null;
  recipients: MessageRecipient[];
  buildingNames: Map<number, string>;
  /** 관리비 고지 부과월 'YYYY-MM-01' */
  period: string;
  noticeId: number | null;
}): AlimtalkDynamicResult {
  const kind = alimtalkDynamicKind(template);
  const isBill = kind?.type === "bill";
  const isNotice = kind?.type === "notice";
  const { data: me } = useMe();
  const { data: orgContact, isLoading: orgContactLoading } = useOrgContact();
  const setupConfigQuery = useSetupConfig(isBill ? me?.orgId : undefined);
  const noticesQuery = useNotices({}, 0, 50);
  const signBillUrls = useStaffSignBillUrls();
  const mintShareToken = useMintNoticeShareToken();

  const tenantRecipients = useMemo(
    () => recipients.filter((recipient) =>
      recipient.kind === "tenant" && recipient.ref?.unitId !== undefined && recipient.ref?.buildingId !== undefined),
    [recipients],
  );
  const buildingIds = useMemo(
    () => (isBill ? [...new Set(tenantRecipients.map((recipient) => recipient.ref!.buildingId!))].sort((a, b) => a - b) : []),
    [isBill, tenantRecipients],
  );
  const unitIdsByBuilding = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const recipient of tenantRecipients) {
      const list = map.get(recipient.ref!.buildingId!) ?? [];
      if (!list.includes(recipient.ref!.unitId!)) list.push(recipient.ref!.unitId!);
      map.set(recipient.ref!.buildingId!, list);
    }
    map.forEach((list) => list.sort((a, b) => a - b));
    return map;
  }, [tenantRecipients]);
  const allUnitIds = useMemo(
    () => (isBill ? [...unitIdsByBuilding.values()].flat().sort((a, b) => a - b) : []),
    [isBill, unitIdsByBuilding],
  );

  const targetQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: billKeys.targets(buildingId, period),
      queryFn: () => listBillTargets(buildingId, period),
    })),
    combine: combineResults,
  });
  const documentQueries = useQueries({
    queries: buildingIds.map((buildingId) => {
      const unitIds = unitIdsByBuilding.get(buildingId) ?? [];
      return {
        queryKey: billKeys.documents(buildingId, period, unitIds),
        queryFn: () => getBillDocuments(buildingId, period, unitIds),
        enabled: unitIds.length > 0,
      };
    }),
    combine: combineResults,
  });
  const periodSettingQueries = useQueries({
    queries: buildingIds.map((buildingId) => ({
      queryKey: billingKeys.periodSetting(buildingId, period),
      queryFn: () => getBillingPeriodSetting(buildingId, period),
    })),
    combine: combineResults,
  });
  const dueDatesQuery = useQuery({
    queryKey: billKeys.dueDates(period, allUnitIds),
    queryFn: () => listBillDueDates(allUnitIds, period),
    enabled: allUnitIds.length > 0,
  });

  const officePhone = orgContact?.phone?.trim() ?? "";
  const lateFeeMerge = setupConfigQuery.data?.lateFeeMerge ?? DEFAULT_BILL_PRINT_OPTIONS.lateFeeMerge;
  const notices = useMemo(
    () => (noticesQuery.data?.items ?? []).map((notice) => ({ id: notice.id, title: notice.title })),
    [noticesQuery.data],
  );
  const selectedNotice = notices.find((notice) => notice.id === noticeId) ?? null;

  const billLoading = isBill && (
    targetQueries.loading
    || documentQueries.loading
    || periodSettingQueries.loading
    || (allUnitIds.length > 0 && dueDatesQuery.isLoading)
    || setupConfigQuery.isLoading
    || orgContactLoading
  );

  const { variablesByUnit, excludedByUnit } = useMemo(() => {
    const variables = new Map<number, Record<string, string>>();
    const excluded = new Map<number, string>();
    if (!isBill || kind?.type !== "bill") return { variablesByUnit: variables, excludedByUnit: excluded };

    const dueDates = new Map((dueDatesQuery.data ?? []).map((item) => [item.unitId, item.dueDate]));
    buildingIds.forEach((buildingId, index) => {
      const targets = new Map<number, BillTarget>((targetQueries.data[index] ?? []).map((target) => [target.unitId, target]));
      const documents = new Map((documentQueries.data[index] ?? []).map((document) => [document.unitId, document]));
      const setting = periodSettingQueries.data[index];
      const chargePeriod = billNoticeChargePeriod(period, setting?.chargeStartDate, setting?.chargeEndDate);
      for (const recipient of tenantRecipients.filter((item) => item.ref!.buildingId === buildingId)) {
        const unitId = recipient.ref!.unitId!;
        const target = targets.get(unitId);
        const document = documents.get(unitId);
        const customerNo = billNoticeCustomerNo(target?.payerNo);
        const dueDate = billNoticeDate(dueDates.get(unitId));
        const unitKind = target ? billNoticeKind(target) : null;
        const reason = !target || target.occupancyId === null || target.occupancyId !== recipient.ref?.occupancyId
          ? "이 달 부과 확정 내역 없음"
          : unitKind !== kind.billKind
            ? `고지 유형이 ${BILL_NOTICE_KIND_LABELS[unitKind as BillNoticeKind]} 세대`
            : !customerNo
              ? "납부자번호 없음"
              : !document || !dueDate
                ? "고지서 금액·납부 마감일 없음"
                : null;
        if (reason) {
          excluded.set(unitId, reason);
          continue;
        }
        variables.set(unitId, billNoticeVariables({
          kind: kind.billKind,
          buildingName: buildingNames.get(buildingId) ?? "",
          unitNo: target!.unitNo,
          dong: target!.dong,
          chargePeriod,
          dueDate: dueDate as string,
          customerNo: customerNo as string,
          amounts: billNoticeAmounts(document!, lateFeeMerge),
          officePhone,
          // 상세경로는 발송 직전에 서명 발급한다(resolveLinks).
          detailPath: "",
        }));
      }
    });
    // 입주자 외 수신자(건물주·청소 등)는 고지 대상이 아니다.
    for (const recipient of recipients) {
      const unitId = recipient.ref?.unitId;
      if (recipient.kind !== "tenant" && unitId !== undefined && !variables.has(unitId)) {
        excluded.set(unitId, "입주자가 아님");
      }
    }
    return { variablesByUnit: variables, excludedByUnit: excluded };
  }, [
    buildingIds, buildingNames, documentQueries.data, dueDatesQuery.data, isBill, kind,
    lateFeeMerge, officePhone, period, periodSettingQueries.data, recipients, targetQueries.data, tenantRecipients,
  ]);
  const commonVariables = useMemo<Record<string, string>>(
    (): Record<string, string> => (isNotice && selectedNotice ? { 공지제목: selectedNotice.title } : {}),
    [isNotice, selectedNotice],
  );

  const blocker = isBill
    ? (!orgContactLoading && !officePhone
      ? "관리실 연락처(회사 대표 전화)가 없어 보낼 수 없어요. 회사 정보에 대표 전화를 등록해 주세요."
      : null)
    : isNotice && !selectedNotice
      ? "보낼 공지를 선택해 주세요."
      : null;

  const resolveLinks = useCallback(async (unitIds: number[]) => {
    const links = new Map<number, Record<string, string>>();
    let common: Record<string, string> = {};
    if (isBill && unitIds.length > 0) {
      const signed = await signBillUrls.mutateAsync({ unitIds, period });
      for (const link of signed) {
        links.set(link.unitId, {
          상세경로: billNoticeDetailPath({
            buildingId: link.buildingId,
            unitNo: link.unitNo,
            period,
            sig: link.sig,
            issuedDay: link.issuedDay,
          }),
        });
      }
    }
    if (isNotice && noticeId !== null) {
      const token = await mintShareToken.mutateAsync(noticeId);
      // 승인 템플릿 버튼은 `https://www.smtsolution.kr/#{버튼1}` 형태라 도메인 뒤 경로만 넣는다(useNoticeAlimtalkSend 와 같음).
      common = { 버튼1: `share/notice/${token}` };
    }
    return { common, byUnit: links };
  }, [isBill, isNotice, mintShareToken, noticeId, period, signBillUrls]);

  return {
    kind,
    commonVariables,
    loading: billLoading || (isNotice && noticesQuery.isLoading),
    variablesByUnit,
    excludedByUnit,
    blocker,
    notices,
    resolveLinks,
  };
}
