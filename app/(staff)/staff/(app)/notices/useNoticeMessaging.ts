"use client";

import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import type { Building } from "@/hooks/reactquery/buildings";
import { useAttachNoticeSendLog, type Notice } from "@/hooks/reactquery/notices";
import type { SendMessagesResult } from "@/hooks/reactquery/messaging";
import {
  useOrganizationTenantList,
  useTenantList,
} from "@/hooks/reactquery/occupancies";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useMintNoticeShareToken } from "@/hooks/reactquery/residentNotice";
import type { MessageRecipient, MessagingPreset } from "@/lib/messaging/preset";
import { residentOrigin } from "@/lib/messaging/residentOrigin";
import { getNoticeStatus, getNoticeTemplateTitle } from "./utils";

/**
 * 공지 알림톡/문자 발송 흐름을 캡슐화한 공용 훅.
 *
 * 상세 슬라이드(NoticeDetail)와 상세 모달(NoticeDetailModal)이 동일한 수신처 산출·
 * 공개 상세 링크 발급·preset 구성을 공유하도록 분리했다. 소비자는 반환된 `preset`으로
 * `<MessagingModal open={open} .../>`를 직접 렌더한다.
 *
 * 대상 건물 규칙: buildingIds가 정확히 1곳이면 해당 건물, 그 외(빈 배열=전체·다중)는
 * 대상 건물들(전체면 org 전 건물)의 세대를 합쳐 수신처로 삼는다.
 */
export function useNoticeMessaging(
  notice: Notice,
  buildings: Building[],
  canSendMessages: boolean,
) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const mintShareToken = useMintNoticeShareToken();
  const attachSendLog = useAttachNoticeSendLog();
  const { data: orgContact } = useOrgContact();
  const status = getNoticeStatus(notice);

  const isSingleBuilding = notice.buildingIds.length === 1;
  const singleBuildingId = isSingleBuilding ? notice.buildingIds[0] : null;
  const singleBuildingName = singleBuildingId !== null
    ? (buildings.find((building) => building.id === singleBuildingId)?.name ?? "삭제된 건물")
    : null;
  // 빈 배열 = 전체 → org 전 건물, 다중 = 지정 건물들.
  const targetBuildingIds = notice.buildingIds.length > 0
    ? notice.buildingIds
    : buildings.map((building) => building.id);

  const buildingTenants = useTenantList(singleBuildingId ?? 0);
  const organizationTenants = useOrganizationTenantList(
    isSingleBuilding ? [] : targetBuildingIds,
  );
  const recipientsLoading = isSingleBuilding
    ? buildingTenants.isLoading
    : organizationTenants.isLoading;
  const recipientsFetching = isSingleBuilding
    ? buildingTenants.isFetching
    : organizationTenants.isFetching;
  const recipientsRefreshing = recipientsFetching && !recipientsLoading;
  const disabled = !canSendMessages || recipientsLoading || recipientsRefreshing || mintShareToken.isPending;

  const trigger = async () => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (recipientsLoading || recipientsRefreshing) {
      toast.info("입주자 수신처를 불러오는 중입니다.");
      return;
    }

    const rows = isSingleBuilding
      ? (buildingTenants.data ?? []).map((tenant) => ({
          ...tenant,
          buildingId: singleBuildingId as number,
        }))
      : (organizationTenants.data ?? []);
    const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));
    const nextRecipients: MessageRecipient[] = rows
      .filter((tenant) => !tenant.isVacant && tenant.occupancyId !== null)
      .map((tenant) => ({
        name: tenant.tenantName,
        phone: tenant.phone,
        unitNo: tenant.unitNo,
        kind: "tenant",
        variables: {
          공지제목: notice.title,
          ...(isSingleBuilding
            ? {}
            : { 건물명: buildingNames.get(tenant.buildingId) ?? "" }),
        },
        ref: {
          occupancyId: tenant.occupancyId as number,
          unitId: tenant.unitId,
          buildingId: tenant.buildingId,
        },
      }));

    if (nextRecipients.length === 0) {
      toast.info("공지를 받을 입주자가 없습니다.");
      return;
    }
    try {
      const token = await mintShareToken.mutateAsync(notice.id);
      const detailLink = `${residentOrigin()}/share/notice/${token}`;
      setRecipients(nextRecipients.map((recipient) => ({
        ...recipient,
        variables: {
          ...recipient.variables,
          상세링크: detailLink,
        },
      })));
      setOpen(true);
    } catch (error) {
      toast.error(error, "공지 상세 링크를 만들지 못했습니다.");
    }
  };

  const preset: MessagingPreset = {
    context: "공지",
    buildingId: singleBuildingId ?? undefined,
    channel: "alimtalk",
    mode: "auto",
    templateTitle: getNoticeTemplateTitle(notice.noticeType),
    recipients,
    commonVariables: {
      건물명: singleBuildingName ?? "전체 공지",
      관리사무소연락처: orgContact?.phone ?? "",
    },
    scheduledAt: status === "scheduled" ? notice.publishedAt ?? undefined : undefined,
  };

  // 발송 완료 후 로그를 이 공지에 귀속시킨다(귀속 실패는 비핵심 → 무시).
  const onSent = async (result: SendMessagesResult) => {
    if (result?.logId) {
      try {
        await attachSendLog.mutateAsync({ logId: result.logId, noticeId: notice.id });
      } catch {
        // 발송 자체는 성공했으므로 귀속 실패는 무시한다.
      }
    }
    setOpen(false);
  };

  return {
    open,
    close: () => setOpen(false),
    onSent,
    trigger,
    preset,
    disabled,
    recipientsRefreshing,
    isPreparing: mintShareToken.isPending,
  };
}
