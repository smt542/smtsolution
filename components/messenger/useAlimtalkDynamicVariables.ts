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
import { extractVariables } from "@/lib/messaging/render";
import { formatAccount, formatKrw, formatPeriodMonth, formatUnit } from "@/lib/messaging/vars";
import { formatWon } from "@/lib/format/number";

/**
 * 플로팅 메신저(빠른발송) 알림톡 — 팝빌 승인 템플릿별 수신자 변수 자동 채움(2026-10-14).
 *  · 관리비 고지 3종(일반·자동이체·장기미납, 0309): 고른 부과월의 부과 확정 내역으로 세대별 금액·기간·마감일·고객번호를
 *    채우고, 발송 직전에 고지서 상세 링크(#{상세경로})를 서명 발급한다. 변수 규칙은 「관리비 고지서」 탭과 같다(lib/messaging/billNotice).
 *  · 신규 공지(공지 안내(신규)): 고른 공지의 제목(#{공지제목})을 넣고, 발송 직전에 공유 토큰으로 버튼 링크(#{버튼1})를 만든다.
 */
export type AlimtalkDynamicKind =
  /** billKind null = 수기 작성·일반 템플릿 본문의 관리비 변수(세대별 고지 유형 그대로, 유형으로 제외하지 않음). */
  | { type: "bill"; billKind: BillNoticeKind | null }
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

/**
 * 본문에 있으면 관리비 자동 채움을 켜는 변수(수기 작성·「관리비 고지서」 같은 일반 템플릿 — 2026-10-18).
 * 승인 고지 템플릿 3종이 아니어도 고른 부과월의 부과 확정 내역으로 세대별 금액을 채운다.
 */
const BILL_BODY_VARIABLES = new Set([
  "청구금액", "청구월", "당월관리비", "당월 총 관리비", "미납관리비", "미납금액", "이전 미납 관리비 총액",
  "총납부금액", "총 납부해야할 금액", "납기일", "관리비 납부 기한일", "납부마감일", "출금예정일",
  "관리비기간", "관리비 정산 기간", "고객번호", "납부계좌",
]);

/** 본문(수기·일반 템플릿)이 관리비 변수를 쓰는지. */
export function bodyUsesBillVariables(body: string): boolean {
  return extractVariables(body).some((name) => BILL_BODY_VARIABLES.has(name));
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
  /** 고른 승인 고지 템플릿과 고지 유형이 다른 세대(unitId → 그 세대의 실제 고지 유형). */
  kindMismatchByUnit: Map<number, BillNoticeKind>;
  /** 납부자번호가 없어 고객번호만 빈 값으로 보내는 세대(나머지 값은 채운다). */
  missingCustomerNoUnits: Set<number>;
  /** 템플릿 전체를 막는 사유(관리실 연락처 없음·공지 미선택 등). */
  blocker: string | null;
  notices: { id: number; title: string }[];
  /** 발송 직전 링크 변수(공지 버튼1 = 공통, 관리비 상세경로 = 세대별)를 발급한다. 실패하면 throw. */
  resolveLinks: (unitIds: number[]) => Promise<{ common: Record<string, string>; byUnit: Map<number, Record<string, string>> }>;
}

export function useAlimtalkDynamicVariables({
  template,
  body = "",
  recipients,
  buildingNames,
  period,
  noticeId,
}: {
  template: MessageTemplate | null;
  /** 작성 중인 본문 — 승인 고지 템플릿이 아니어도 관리비 변수가 있으면 세대별 금액을 채운다. */
  body?: string;
  recipients: MessageRecipient[];
  buildingNames: Map<number, string>;
  /** 관리비 고지 부과월 'YYYY-MM-01' */
  period: string;
  noticeId: number | null;
}): AlimtalkDynamicResult {
  const manualBill = bodyUsesBillVariables(body);
  const kind = useMemo<AlimtalkDynamicKind>(
    () => alimtalkDynamicKind(template) ?? (manualBill ? { type: "bill", billKind: null } : null),
    [manualBill, template],
  );
  const isBill = kind?.type === "bill";
  /** 수기 작성·일반 템플릿의 관리비 변수(승인 고지 템플릿 아님). */
  const isManualBill = kind?.type === "bill" && kind.billKind === null;
  const usesDetailLink = !isManualBill || extractVariables(body).includes("상세경로");
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
  const payAccount = formatAccount(setupConfigQuery.data?.mgmtBank1, setupConfigQuery.data?.mgmtAcct1);
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

  const { variablesByUnit, excludedByUnit, kindMismatchByUnit, missingCustomerNoUnits } = useMemo(() => {
    const variables = new Map<number, Record<string, string>>();
    const excluded = new Map<number, string>();
    const mismatch = new Map<number, BillNoticeKind>();
    const missingCustomerNo = new Set<number>();
    if (!isBill || kind?.type !== "bill") {
      return { variablesByUnit: variables, excludedByUnit: excluded, kindMismatchByUnit: mismatch, missingCustomerNoUnits: missingCustomerNo };
    }

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
        // 수기 작성은 세대 고지 유형으로 제외하지 않는다. 납부자번호가 없으면 고객번호 칸만 비우고
        // 나머지(기간·마감일·금액 등)는 채운다(2026-10-19 — 예전엔 세대를 통째로 빼 모든 값이 빈 알림톡이 나갔다).
        const reason = !target || target.occupancyId === null || target.occupancyId !== recipient.ref?.occupancyId
          ? "이 달 부과 확정 내역 없음"
          : kind.billKind !== null && unitKind !== kind.billKind
            ? `고지 유형이 ${BILL_NOTICE_KIND_LABELS[unitKind as BillNoticeKind]} 세대`
            : !document || !dueDate
              ? "고지서 금액·납부 마감일 없음"
              : null;
        if (reason) {
          excluded.set(unitId, reason);
          if (kind.billKind !== null && unitKind !== null && unitKind !== kind.billKind) mismatch.set(unitId, unitKind);
          continue;
        }
        if (!customerNo) missingCustomerNo.add(unitId);
        const amounts = billNoticeAmounts(document!, lateFeeMerge);
        const base = billNoticeVariables({
          kind: kind.billKind ?? (unitKind as BillNoticeKind),
          buildingName: buildingNames.get(buildingId) ?? "",
          unitNo: target!.unitNo,
          dong: target!.dong,
          chargePeriod,
          dueDate: dueDate as string,
          customerNo: customerNo ?? "",
          amounts,
          officePhone,
          // 상세경로는 발송 직전에 서명 발급한다(resolveLinks).
          detailPath: "",
        });
        variables.set(unitId, kind.billKind !== null ? base : {
          ...base,
          // 기본 문자·알림톡 템플릿 변수명(AUTO_VARS). 템플릿이 「#{청구금액}원」처럼 단위를 붙여 쓰는 값은 숫자만 넣는다.
          세대: formatUnit(target!.dong, target!.unitNo),
          청구월: formatPeriodMonth(period),
          "관리비 정산 기간": chargePeriod,
          납기일: dueDate as string,
          "관리비 납부 기한일": dueDate as string,
          납부마감일: dueDate as string,
          출금예정일: dueDate as string,
          "당월 총 관리비": formatWon(amounts.month),
          청구금액: formatKrw(amounts.total),
          미납금액: formatKrw(amounts.unpaid),
          "이전 미납 관리비 총액": formatWon(amounts.unpaid),
          "총 납부해야할 금액": formatWon(amounts.total),
          납부계좌: payAccount,
          관리사무소연락처: officePhone,
          "관리실 번호": officePhone,
        });
      }
    });
    // 입주자 외 수신자(건물주·청소 등)는 고지 대상이 아니다.
    for (const recipient of recipients) {
      const unitId = recipient.ref?.unitId;
      if (recipient.kind !== "tenant" && unitId !== undefined && !variables.has(unitId)) {
        excluded.set(unitId, "입주자가 아님");
      }
    }
    return { variablesByUnit: variables, excludedByUnit: excluded, kindMismatchByUnit: mismatch, missingCustomerNoUnits: missingCustomerNo };
  }, [
    buildingIds, buildingNames, documentQueries.data, dueDatesQuery.data, isBill, kind,
    lateFeeMerge, officePhone, payAccount, period, periodSettingQueries.data, recipients, targetQueries.data, tenantRecipients,
  ]);
  const commonVariables = useMemo<Record<string, string>>(
    (): Record<string, string> => (isNotice && selectedNotice ? { 공지제목: selectedNotice.title } : {}),
    [isNotice, selectedNotice],
  );

  // 관리실 연락처 없음은 승인 고지 템플릿만 막는다(수기 작성은 그 칸만 빈 값).
  const blocker = isBill && !isManualBill
    ? (!orgContactLoading && !officePhone
      ? "관리실 연락처(회사 대표 전화)가 없어 보낼 수 없어요. 회사 정보에 대표 전화를 등록해 주세요."
      : null)
    : isNotice && !selectedNotice
      ? "보낼 공지를 선택해 주세요."
      : null;

  const resolveLinks = useCallback(async (unitIds: number[]) => {
    const links = new Map<number, Record<string, string>>();
    let common: Record<string, string> = {};
    if (isBill && usesDetailLink && unitIds.length > 0) {
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
  }, [isBill, isNotice, mintShareToken, noticeId, period, signBillUrls, usesDetailLink]);

  return {
    kind,
    commonVariables,
    loading: billLoading || (isNotice && noticesQuery.isLoading),
    variablesByUnit,
    excludedByUnit,
    kindMismatchByUnit,
    missingCustomerNoUnits,
    blocker,
    notices,
    resolveLinks,
  };
}
