"use client";

import { useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useBillDocuments,
  useBillDueDates,
  useBillTargets,
  useRecordBillDelivery,
} from "@/hooks/reactquery/bill";
import { useBillingPeriodSetting } from "@/hooks/reactquery/billing";
import {
  MessageSendError,
  useSendMessages,
  useTenantAlimtalkConsent,
} from "@/hooks/reactquery/messaging";
import { useMessageTemplates, type MessageTemplate } from "@/hooks/reactquery/messageTemplates";
import { useOrganizationTenantList } from "@/hooks/reactquery/occupancies";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useStaffSignBillUrls } from "@/hooks/reactquery/residentBilling";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { DEFAULT_BILL_PRINT_OPTIONS } from "@/lib/bill/document";
import {
  BILL_NOTICE_KIND_LABELS,
  BILL_NOTICE_KINDS,
  BILL_NOTICE_TEMPLATE_CODES,
  BILL_NOTICE_TEMPLATE_TITLES,
  billNoticeAmounts,
  billNoticeChargePeriod,
  billNoticeCustomerNo,
  billNoticeDate,
  billNoticeDetailPath,
  billNoticeKind,
  billNoticeVariables,
  type BillNoticeAmounts,
  type BillNoticeKind,
} from "@/lib/messaging/billNotice";
import { newUuid } from "@/lib/messaging/idempotencyKey";
import {
  buildRecipientRenderVariables,
  dedupeRecipients,
  validRecipients,
  type MessageRecipient,
  type ResolvedRecipient,
} from "@/lib/messaging/preset";
import { hasUnresolvedVariables, renderTemplate } from "@/lib/messaging/render";

export interface BillNoticeRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  occupancyId: number;
  tenantName: string | null;
  kind: BillNoticeKind;
  amounts: BillNoticeAmounts | null;
  phones: { phone: string; phoneType: "primary" | "secondary" }[];
  customerNo: string | null;
  dueDate: string | null;
  /** 비어 있으면 발송 가능. */
  excludeReasons: string[];
}

const hasDigits = (phone: string | null | undefined): phone is string => Boolean(phone?.replace(/\D/g, ""));

function sendErrorMessage(code: string | null): string {
  return code === "INSUFFICIENT_POINTS"
    ? "포인트가 부족합니다."
    : code === "PROVIDER_NOT_CONFIGURED"
      ? "발송 공급자가 설정되지 않아 발송할 수 없습니다."
      : code === "RECIPIENT_NOT_ALLOWED"
        ? "발송 제한 번호라 보내지 않았습니다."
        : code === "PROVIDER_INSUFFICIENT_BALANCE"
          ? "팝빌 충전 잔액이 부족해 발송하지 못했습니다. 운영사에 충전을 요청해 주세요."
          : code === "NO_ELIGIBLE_RECIPIENTS"
            ? "알림톡을 받을 수 있는 수신처가 없습니다."
            : "발송하지 못했습니다.";
}

function findTemplate(templates: MessageTemplate[], kind: BillNoticeKind): MessageTemplate | undefined {
  return templates.find((item) => item.title === BILL_NOTICE_TEMPLATE_TITLES[kind])
    ?? templates.find((item) => item.alimtalkTemplateCode === BILL_NOTICE_TEMPLATE_CODES[kind]);
}

/**
 * 문자·알림톡 관리 「관리비 고지서」 탭: 건물·월분의 부과 확정 세대에 유형별 승인 템플릿(일반·자동이체·장기미납)으로
 * 알림톡을 접수한다. 발송 경로(/api/messaging/send)·멱등 키·오류 안내는 공지 알림톡(useNoticeAlimtalkSend)과 같다.
 */
export function useBillNoticeSend(buildingId: number | null, buildingName: string, period: string) {
  const confirm = useConfirm();
  const { data: me } = useMe();
  const targetsQuery = useBillTargets(buildingId, period);
  const tenantsQuery = useOrganizationTenantList(buildingId ? [buildingId] : []);
  const consentQuery = useTenantAlimtalkConsent(buildingId ?? 0);
  const periodSettingQuery = useBillingPeriodSetting(buildingId, period);
  const setupConfigQuery = useSetupConfig(me?.orgId);
  const { data: orgContact, isLoading: orgContactLoading } = useOrgContact();
  const { data: templates = [], isLoading: templatesLoading } = useMessageTemplates();
  const signBillUrls = useStaffSignBillUrls();
  const sendMessages = useSendMessages();
  const recordDelivery = useRecordBillDelivery();

  // 대상 = 그 달 부과 확정 세대 중 지금 입주 중인 세대(확정 당시 입주가 퇴실했으면 제외).
  const currentOccupancyIds = useMemo(
    () => new Set(tenantsQuery.data
      .filter((tenant) => !tenant.isVacant && tenant.occupancyId !== null)
      .map((tenant) => tenant.occupancyId as number)),
    [tenantsQuery.data],
  );
  const occupiedTargets = useMemo(
    () => (targetsQuery.data ?? []).filter(
      (target) => target.occupancyId !== null && currentOccupancyIds.has(target.occupancyId),
    ),
    [targetsQuery.data, currentOccupancyIds],
  );
  const unitIds = useMemo(() => occupiedTargets.map((target) => target.unitId), [occupiedTargets]);
  const documentsQuery = useBillDocuments(buildingId, period, unitIds);
  const dueDatesQuery = useBillDueDates(unitIds, period);
  const lateFeeMerge = setupConfigQuery.data?.lateFeeMerge ?? DEFAULT_BILL_PRINT_OPTIONS.lateFeeMerge;

  const rows = useMemo<BillNoticeRow[]>(() => {
    const consent = new Map((consentQuery.data ?? []).map((item) => [item.occupancyId, item.alimtalkOptIn]));
    const documents = new Map((documentsQuery.data ?? []).map((document) => [document.unitId, document]));
    const dueDates = new Map((dueDatesQuery.data ?? []).map((item) => [item.unitId, item.dueDate]));
    return occupiedTargets.map((target) => {
      const occupancyId = target.occupancyId as number;
      const phones = [
        ...(hasDigits(target.phone) ? [{ phone: target.phone, phoneType: "primary" as const }] : []),
        ...(hasDigits(target.secondaryPhone) ? [{ phone: target.secondaryPhone, phoneType: "secondary" as const }] : []),
      ];
      const customerNo = billNoticeCustomerNo(target.payerNo);
      const document = documents.get(target.unitId);
      const excludeReasons = [
        ...(consent.get(occupancyId) === true ? [] : ["알림톡 수신 동의 없음"]),
        ...(phones.length > 0 ? [] : ["전화번호 없음"]),
        ...(customerNo ? [] : ["납부자번호 없음"]),
      ];
      return {
        unitId: target.unitId,
        unitNo: target.unitNo,
        dong: target.dong,
        occupancyId,
        tenantName: target.tenantName,
        kind: billNoticeKind(target),
        amounts: document ? billNoticeAmounts(document, lateFeeMerge) : null,
        phones,
        customerNo,
        dueDate: dueDates.get(target.unitId) ?? null,
        excludeReasons,
      };
    });
  }, [occupiedTargets, consentQuery.data, documentsQuery.data, dueDatesQuery.data, lateFeeMerge]);

  const templateByKind = useMemo(
    () => new Map(BILL_NOTICE_KINDS.map((kind) => [kind, findTemplate(templates, kind)] as const)),
    [templates],
  );
  const missingTemplateKinds = BILL_NOTICE_KINDS.filter((kind) => {
    const template = templateByKind.get(kind);
    return !template || !template.alimtalkTemplateCode?.trim();
  });
  const officePhone = orgContact?.phone?.trim() ?? "";

  const isLoading = buildingId !== null && (
    targetsQuery.isLoading
    || tenantsQuery.isLoading
    || consentQuery.isLoading
    || (unitIds.length > 0 && (documentsQuery.isLoading || dueDatesQuery.isLoading))
    || periodSettingQuery.isLoading
    || setupConfigQuery.isLoading
    || templatesLoading
    || orgContactLoading
  );
  const error = targetsQuery.error
    ?? consentQuery.error
    ?? documentsQuery.error
    ?? dueDatesQuery.error
    ?? periodSettingQuery.error
    ?? setupConfigQuery.error
    ?? (tenantsQuery.isError ? new Error("입주자 목록을 불러오지 못했습니다.") : null);

  /** 발송을 막는 화면 안내(템플릿·관리실 연락처). 비어 있으면 발송 가능. */
  const blockers = [
    ...(missingTemplateKinds.length > 0
      ? [`알림톡 템플릿이 준비되지 않았습니다(${missingTemplateKinds.map((kind) => BILL_NOTICE_TEMPLATE_TITLES[kind]).join(", ")}). 템플릿 관리에서 템플릿 코드를 확인해 주세요.`]
      : []),
    ...(!orgContactLoading && !officePhone
      ? ["관리실 연락처(회사 대표 전화)가 없어 발송할 수 없습니다. 회사 정보에 대표 전화를 등록해 주세요."]
      : []),
  ];

  const [isSending, setIsSending] = useState(false);
  // 멱등 키(건물·월·유형별): 같은 묶음의 재시도는 같은 키, 접수 성공·확정 실패 후 회전(공지 훅과 같은 방식).
  // 건물·월이 바뀌면 다른 키를 쓴다(이전 묶음의 키를 다른 대상에 재사용하지 않는다).
  const idempotencyRef = useRef<Record<string, string>>({});

  const refresh = () => {
    void Promise.all([targetsQuery.refetch(), consentQuery.refetch(), documentsQuery.refetch(), dueDatesQuery.refetch()]);
  };

  const send = async (selectedUnitIds: ReadonlySet<number>): Promise<boolean> => {
    if (buildingId === null) return false;
    const selected = rows.filter((row) => selectedUnitIds.has(row.unitId) && row.excludeReasons.length === 0);
    if (selected.length === 0) {
      toast.info("발송할 세대를 선택해 주세요.");
      return false;
    }
    if (blockers.length > 0) {
      toast.error(blockers[0]);
      return false;
    }
    if (selected.some((row) => row.amounts === null || !billNoticeDate(row.dueDate))) {
      toast.error("고지서 금액·납부 마감일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }

    const counts = BILL_NOTICE_KINDS
      .map((kind) => ({ kind, units: selected.filter((row) => row.kind === kind) }))
      .filter((group) => group.units.length > 0);
    const phoneCount = selected.reduce((sum, row) => sum + row.phones.length, 0);
    const ok = await confirm({
      title: "관리비 고지서를 발송할까요?",
      description: `${counts.map((group) => `${BILL_NOTICE_KIND_LABELS[group.kind]} ${group.units.length}`).join(" · ")} — 총 ${selected.length}명`
        + (phoneCount > selected.length ? `(수신 번호 ${phoneCount}개)` : "")
        + ". 알림톡으로만 발송되며 실패 시 문자로 대체하지 않습니다.",
      cancelLabel: "취소",
      confirmLabel: "발송",
      look: "split",
    });
    if (!ok) return false;

    setIsSending(true);
    try {
      let links;
      try {
        links = await signBillUrls.mutateAsync({ unitIds: selected.map((row) => row.unitId), period });
      } catch {
        toast.error("고지서 상세 링크를 발급하지 못했습니다.");
        return false;
      }
      const linkByUnit = new Map(links.map((link) => [link.unitId, link]));
      const chargePeriod = billNoticeChargePeriod(
        period,
        periodSettingQuery.data?.chargeStartDate,
        periodSettingQuery.data?.chargeEndDate,
      );

      const outcomes: { kind: BillNoticeKind; units: number; ok: boolean; message?: string; pending?: boolean }[] = [];
      let queuedTotal = 0;
      let recordFailed = false;
      let unsignedCount = 0;
      let dedupedUnitCount = 0;
      let blockedTotal = 0;

      for (const group of counts) {
        const template = templateByKind.get(group.kind) as MessageTemplate;
        const sendable = group.units.filter((row) => linkByUnit.has(row.unitId));
        unsignedCount += group.units.length - sendable.length;
        if (sendable.length === 0) continue;

        const recipients: ResolvedRecipient[] = validRecipients(dedupeRecipients(sendable.flatMap((row) => {
          const link = linkByUnit.get(row.unitId)!;
          const variables = billNoticeVariables({
            kind: row.kind,
            buildingName,
            unitNo: row.unitNo,
            dong: row.dong,
            chargePeriod,
            dueDate: billNoticeDate(row.dueDate) as string,
            customerNo: row.customerNo as string,
            amounts: row.amounts as BillNoticeAmounts,
            officePhone,
            detailPath: billNoticeDetailPath({
              buildingId: link.buildingId,
              unitNo: link.unitNo,
              period,
              sig: link.sig,
              issuedDay: link.issuedDay,
            }),
          });
          return row.phones.map<MessageRecipient>((phone) => ({
            name: row.tenantName,
            phone: phone.phone,
            phoneType: phone.phoneType,
            alimtalkOptIn: true,
            unitNo: row.unitNo,
            kind: "tenant",
            variables,
            ref: { occupancyId: row.occupancyId, unitId: row.unitId, buildingId },
          }));
        }))).map((recipient) => ({
          ...recipient,
          channel: "alimtalk",
          renderedBody: renderTemplate(
            template.body,
            buildRecipientRenderVariables(recipient, undefined, buildingName),
          ),
        }));
        // 번호 중복(dedupe)으로 수신자가 모두 빠진 세대는 이 묶음에서 실제로 보내지 않는다 → 기록·집계에서 뺀다.
        const sentUnitIds = [...new Set(recipients.map((recipient) => recipient.ref?.unitId as number))];
        dedupedUnitCount += sendable.length - sentUnitIds.length;
        if (recipients.some((recipient) => hasUnresolvedVariables(recipient.renderedBody))) {
          outcomes.push({ kind: group.kind, units: sentUnitIds.length, ok: false, message: "템플릿 변수를 채우지 못했습니다." });
          continue;
        }

        const keySlot = `${buildingId}:${period}:${group.kind}`;
        const key = idempotencyRef.current[keySlot] ?? newUuid();
        idempotencyRef.current[keySlot] = key;
        try {
          const result = await sendMessages.mutateAsync({
            mode: "alimtalk",
            body: template.body,
            context: "관리비 고지서",
            templateId: template.id,
            recipients,
            scheduledAt: null,
            idempotencyKey: key,
          });
          delete idempotencyRef.current[keySlot]; // 접수 성공 → 키 회전.
          queuedTotal += result.queuedCount ?? result.count;
          // 운영 허용 목록 밖 번호는 팝빌로 보내지 않았다. 응답에 세대 식별이 없어 기록은 묶음 단위로 남기고 안내만 한다.
          blockedTotal += result.blockedCount ?? 0;
          outcomes.push({ kind: group.kind, units: sentUnitIds.length, ok: true });
          if (result.logId) {
            try {
              await recordDelivery.mutateAsync({
                buildingId,
                period,
                unitIds: sentUnitIds,
                issueType: "kakao",
                sendStatus: "queued",
                messageLogId: result.logId,
              });
            } catch {
              recordFailed = true; // 발송은 접수됐으므로 기록 실패만 안내한다.
            }
          }
        } catch (error) {
          const code = error instanceof MessageSendError ? error.code : null;
          if (code === "SEND_IN_PROGRESS" || code === "SEND_UNCONFIRMED") {
            // 비종결: 키를 유지해 같은 키로 안전하게 재시도한다.
            outcomes.push({
              kind: group.kind,
              units: sentUnitIds.length,
              ok: false,
              pending: true,
              message: code === "SEND_IN_PROGRESS"
                ? "발송이 처리 중입니다. 잠시 후 결과를 확인해 주세요."
                : "발송 접수 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요.",
            });
          } else {
            delete idempotencyRef.current[keySlot]; // 확정 실패 → 키 회전.
            outcomes.push({ kind: group.kind, units: sentUnitIds.length, ok: false, message: sendErrorMessage(code) });
          }
        }
      }

      const succeeded = outcomes.filter((outcome) => outcome.ok);
      const failed = outcomes.filter((outcome) => !outcome.ok);
      if (succeeded.length > 0) {
        toast.success(
          `${succeeded.map((outcome) => `${BILL_NOTICE_KIND_LABELS[outcome.kind]} ${outcome.units}세대`).join(" · ")} 발송을 접수했습니다 · ${queuedTotal}건 · 결과 확인 중`,
        );
      }
      for (const outcome of failed) {
        const text = `${BILL_NOTICE_KIND_LABELS[outcome.kind]} ${outcome.units}세대: ${outcome.message ?? "발송하지 못했습니다."}`;
        if (outcome.pending) toast.info(text);
        else toast.error(text);
      }
      if (unsignedCount > 0) {
        toast.info(`${unsignedCount}세대는 고지서 상세 링크를 발급하지 못해 보내지 않았습니다.`);
      }
      if (dedupedUnitCount > 0) {
        toast.info(`전화번호가 다른 세대와 같은 ${dedupedUnitCount}세대는 번호당 한 번만 발송해 따로 보내지 않았습니다.`);
      }
      if (blockedTotal > 0) {
        toast.info(`운영 발송 허용 목록에 없는 번호 ${blockedTotal}건은 보내지 않았습니다.`);
      }
      if (recordFailed) {
        toast.info("발송은 접수됐지만 일부 세대의 고지서 발송 기록을 남기지 못했습니다.");
      }
      return succeeded.length > 0 && failed.length === 0 && unsignedCount === 0
        && dedupedUnitCount === 0 && blockedTotal === 0;
    } finally {
      setIsSending(false);
    }
  };

  return {
    rows,
    isLoading,
    error,
    refresh,
    blockers,
    isSending,
    send,
  };
}
