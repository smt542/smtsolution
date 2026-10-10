"use client";

import { useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import type { Building } from "@/hooks/reactquery/buildings";
import { useAttachNoticeSendLog, type Notice } from "@/hooks/reactquery/notices";
import {
  useSendMessages,
  useTenantAlimtalkConsents,
  MessageSendError,
} from "@/hooks/reactquery/messaging";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import { useOrganizationTenantList } from "@/hooks/reactquery/occupancies";
import type { RecipientCheckOption } from "@/components/messenger/RecipientCheckSelect";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useMintNoticeShareToken } from "@/hooks/reactquery/residentNotice";
import { renderTemplate } from "@/lib/messaging/render";
import { newUuid } from "@/lib/messaging/idempotencyKey";
import {
  buildRecipientRenderVariables,
  dedupeRecipients,
  validRecipients,
  type MessageChannel,
  type MessageRecipient,
  type ResolvedRecipient,
} from "@/lib/messaging/preset";
import { residentOrigin } from "@/lib/messaging/residentOrigin";
import { getNoticeTemplateTitle, NOTICE_TYPE_LABELS } from "./utils";

/**
 * 공지 상세 "발송/재전송" 확인 다이얼로그(Figma 45:31983)에서 곧바로 알림톡을 접수하는 훅.
 *
 * 작성기(MessagingComposer)를 거치지 않고 발송하되, 수신처 산출·채널 라우팅·본문 렌더·멱등 키·
 * 접수 payload는 작성기와 동일한 헬퍼/훅을 재사용해 동작을 일치시킨다. 포인트 충분 여부는
 * 서버(접수 라우트)가 예약 시 강제하므로(INSUFFICIENT_POINTS) 클라이언트 사전 견적은 생략한다.
 * 채널 라우팅: auto 모드 — 알림톡 동의 세대는 alimtalk, 그 외는 sms(어느 쪽이든 발송은 됨).
 *
 * 수신 대상은 저장된 공지 대상이 아니라 **화면에서 지금 고른 대상 건물**(target.buildingIds, 빈 배열=전체·null=선택 없음)과
 * 「대상자」에서 체크를 푼 입주(target.excludedOccupancyIds)를 따른다.
 */
export function useNoticeAlimtalkSend(
  notice: Notice,
  buildings: Building[],
  canSendMessages: boolean,
  target: { buildingIds: number[] | null; excludedOccupancyIds: ReadonlySet<number> },
) {
  const mintShareToken = useMintNoticeShareToken();
  const attachSendLog = useAttachNoticeSendLog();
  const sendMessages = useSendMessages();
  const { data: orgContact } = useOrgContact();
  const { data: templates = [] } = useMessageTemplates();

  const selectedBuildingIds = target.buildingIds;
  const isSingleBuilding = selectedBuildingIds?.length === 1;
  const singleBuildingId = isSingleBuilding ? selectedBuildingIds[0] : null;
  const singleBuildingName = singleBuildingId !== null
    ? (buildings.find((building) => building.id === singleBuildingId)?.name ?? "삭제된 건물")
    : null;
  // 빈 배열 = 전체 → org 전 건물, 다중 = 지정 건물들, null = 선택 없음(수신자 없음).
  const targetBuildingIds = selectedBuildingIds === null
    ? []
    : selectedBuildingIds.length > 0
      ? selectedBuildingIds
      : buildings.map((building) => building.id);

  const organizationTenants = useOrganizationTenantList(targetBuildingIds);
  // 동의는 대상 건물 전부에서 조회한다(대표 1개 건물만 보면 다른 건물 동의 세대가 SMS 로 나갔다).
  const consentQuery = useTenantAlimtalkConsents(targetBuildingIds);
  const recipientsLoading = organizationTenants.isLoading;
  const tenantRows = organizationTenants.data;

  // 「대상자」 선택지: 입주 중이고 전화번호가 있는 입주 1건 = 1명(전화가 여럿이어도 한 줄).
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

  const commonVariables = useMemo(
    () => ({
      건물명: singleBuildingName ?? "전체 공지",
      관리사무소연락처: orgContact?.phone ?? "",
    }),
    [singleBuildingName, orgContact?.phone],
  );

  // 수신처(상세링크 제외). 개수 표시·발송 공용. 상세링크는 발송 시 토큰 발급 후 주입한다.
  const baseRecipients = useMemo<MessageRecipient[]>(() => {
    const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));
    const recipients: MessageRecipient[] = tenantRows
      .filter((tenant) =>
        !tenant.isVacant
        && tenant.occupancyId !== null
        && !target.excludedOccupancyIds.has(tenant.occupancyId))
      .flatMap((tenant) =>
        [tenant.phone, ...tenant.phonesMore]
          .filter((phone): phone is string => Boolean(phone?.replace(/\D/g, "")))
          .map((phone, index) => ({
            name: tenant.tenantName,
            phone,
            phoneType: index === 0 && phone === tenant.phone ? "primary" as const : "secondary" as const,
            unitNo: tenant.unitNo,
            kind: "tenant" as const,
            variables: {
              공지제목: notice.title,
              ...(isSingleBuilding ? {} : { 건물명: buildingNames.get(tenant.buildingId) ?? "" }),
            },
            ref: {
              occupancyId: tenant.occupancyId as number,
              unitId: tenant.unitId,
              buildingId: tenant.buildingId,
            },
          })),
      );
    return validRecipients(dedupeRecipients(recipients));
  }, [buildings, isSingleBuilding, tenantRows, target.excludedOccupancyIds, notice.title]);

  const template = useMemo(
    () => templates.find((item) => item.title === getNoticeTemplateTitle(notice.noticeType)),
    [templates, notice.noticeType],
  );

  const recipientCount = baseRecipients.length;
  const firstBuildingName = buildings.find((building) => building.id === targetBuildingIds[0])?.name ?? "";
  const buildingLabel = singleBuildingName
    ?? (selectedBuildingIds === null
      ? "대상 건물 없음"
      : selectedBuildingIds.length === 0
        ? "전체 건물"
        : `${firstBuildingName} 외 ${targetBuildingIds.length - 1}곳`);
  const templateLabel = `${NOTICE_TYPE_LABELS[notice.noticeType]} 템플릿`;
  const disabled = !canSendMessages || recipientsLoading || recipientCount === 0;

  const [isSending, setIsSending] = useState(false);
  // 멱등 키: 같은 다이얼로그의 중복 클릭·재시도는 같은 키(이중 접수 방지), 성공 후 회전.
  const idempotencyRef = useRef<string | null>(null);

  const sendNow = async (): Promise<boolean> => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return false;
    }
    if (recipientsLoading) {
      toast.info("입주자 수신처를 불러오는 중입니다.");
      return false;
    }
    if (baseRecipients.length === 0) {
      toast.info("공지를 받을 입주자가 없습니다. 대상자를 선택해 주세요.");
      return false;
    }
    if (!template) {
      toast.error("알림톡 템플릿이 준비되지 않았습니다.");
      return false;
    }

    setIsSending(true);
    const key = idempotencyRef.current ?? newUuid();
    idempotencyRef.current = key;
    try {
      const token = await mintShareToken.mutateAsync(notice.id);
      const detailLink = `${residentOrigin()}/share/notice/${token}`;
      const consentByOccupancy = new Map(
        (consentQuery.data ?? []).map((consent) => [consent.occupancyId, consent.alimtalkOptIn]),
      );
      const recipients: ResolvedRecipient[] = baseRecipients.map((recipient) => {
        const variables = { ...recipient.variables, 상세링크: detailLink };
        const occupancyId = recipient.ref?.occupancyId;
        const hasConsent = occupancyId !== undefined && consentByOccupancy.get(occupancyId) === true;
        const channel: MessageChannel = hasConsent ? "alimtalk" : "sms";
        return {
          ...recipient,
          variables,
          channel,
          renderedBody: renderTemplate(
            template.body,
            buildRecipientRenderVariables({ ...recipient, variables }, commonVariables, singleBuildingName),
          ),
        };
      });

      const result = await sendMessages.mutateAsync({
        mode: "auto",
        body: template.body,
        context: "공지",
        templateId: template.id,
        recipients,
        scheduledAt: null,
        idempotencyKey: key,
      });
      idempotencyRef.current = null; // 성공 접수 후 키 회전.
      if (result?.logId) {
        // 발송 로그를 이 공지에 귀속(비핵심 → 실패 무시).
        try {
          await attachSendLog.mutateAsync({ logId: result.logId, noticeId: notice.id });
        } catch {
          // 발송 자체는 접수됐으므로 귀속 실패는 무시한다.
        }
      }
      toast.success(`발송을 접수했습니다 · ${result.queuedCount ?? result.count}건 · 결과 확인 중`);
      return true;
    } catch (error) {
      const code = error instanceof MessageSendError ? error.code : null;
      // 비종결(진행 중·결과 불명): 키를 유지해 같은 키로 안전하게 재시도할 수 있게 한다.
      if (code === "SEND_IN_PROGRESS" || code === "SEND_UNCONFIRMED") {
        toast.info(
          code === "SEND_IN_PROGRESS"
            ? "발송이 처리 중입니다. 잠시 후 결과를 확인해 주세요."
            : "발송 접수 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요.",
        );
        return false;
      }
      idempotencyRef.current = null; // 확정 실패는 키 회전(깨끗한 재시도).
      toast.error(
        code === "INSUFFICIENT_POINTS"
          ? "포인트가 부족합니다."
          : code === "PROVIDER_NOT_CONFIGURED"
            ? "발송 공급자가 설정되지 않아 발송할 수 없습니다."
            : code === "RECIPIENT_NOT_ALLOWED"
              ? "발송 제한 번호라 보내지 않았습니다."
              : code === "PROVIDER_INSUFFICIENT_BALANCE"
                ? "팝빌 충전 잔액이 부족해 발송하지 못했습니다. 운영사에 충전을 요청해 주세요."
                : "발송하지 못했습니다.",
      );
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return {
    disabled,
    recipientsLoading,
    recipientCount,
    tenantOptions,
    buildingLabel,
    templateLabel,
    isSending,
    sendNow,
  };
}
