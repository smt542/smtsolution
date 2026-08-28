"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Modal, Panel } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useDeleteNotice, type Notice } from "@/hooks/reactquery/notices";
import {
  useOrganizationTenantList,
  useTenantList,
} from "@/hooks/reactquery/occupancies";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useMintNoticeShareToken } from "@/hooks/reactquery/residentNotice";
import type { MessageRecipient, MessagingPreset } from "@/lib/messaging/preset";
import { residentOrigin } from "@/lib/messaging/residentOrigin";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import {
  formatNoticeDate,
  getNoticeStatus,
  getNoticeTemplateTitle,
  NOTICE_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
} from "../utils";

export function NoticeDetail({
  notice,
  buildings,
  canSendMessages,
  onEdit,
  onDeleted,
}: {
  notice: Notice;
  buildings: Building[];
  canSendMessages: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageRecipients, setMessageRecipients] = useState<MessageRecipient[]>([]);
  const deleteNotice = useDeleteNotice();
  const mintShareToken = useMintNoticeShareToken();
  const { data: orgContact } = useOrgContact();
  const status = getNoticeStatus(notice);
  const buildingName = notice.buildingId === null
    ? "전체 공지"
    : (buildings.find((building) => building.id === notice.buildingId)?.name ?? "삭제된 건물");
  const buildingTenants = useTenantList(notice.buildingId ?? 0);
  const organizationTenants = useOrganizationTenantList(
    notice.buildingId === null ? buildings.map((building) => building.id) : [],
  );
  const recipientsLoading = notice.buildingId === null
    ? organizationTenants.isLoading
    : buildingTenants.isLoading;

  const openNoticeMessaging = async () => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (recipientsLoading) {
      toast.info("입주자 수신처를 불러오는 중입니다.");
      return;
    }

    const rows = notice.buildingId === null
      ? organizationTenants.data
      : (buildingTenants.data ?? []).map((tenant) => ({
          ...tenant,
          buildingId: notice.buildingId as number,
        }));
    const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));
    const recipients: MessageRecipient[] = rows
      .filter((tenant) => !tenant.isVacant && tenant.occupancyId !== null)
      .map((tenant) => ({
        name: tenant.tenantName,
        phone: tenant.phone,
        unitNo: tenant.unitNo,
        kind: "tenant",
        variables: {
          공지제목: notice.title,
          ...(notice.buildingId === null
            ? { 건물명: buildingNames.get(tenant.buildingId) ?? "" }
            : {}),
        },
        ref: {
          occupancyId: tenant.occupancyId as number,
          unitId: tenant.unitId,
          buildingId: tenant.buildingId,
        },
      }));

    if (recipients.length === 0) {
      toast.info("공지를 받을 입주자가 없습니다.");
      return;
    }
    try {
      const token = await mintShareToken.mutateAsync(notice.id);
      const detailLink = `${residentOrigin()}/r/notice/${token}`;
      setMessageRecipients(recipients.map((recipient) => ({
        ...recipient,
        variables: {
          ...recipient.variables,
          상세링크: detailLink,
        },
      })));
      setMessageOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "공지 상세 링크를 만들지 못했습니다.",
      );
    }
  };

  const messagingPreset: MessagingPreset = {
    context: "공지",
    buildingId: notice.buildingId ?? undefined,
    channel: "alimtalk",
    mode: "auto",
    templateTitle: getNoticeTemplateTitle(notice.noticeType),
    recipients: messageRecipients,
    commonVariables: {
      건물명: notice.buildingId === null ? "전체 공지" : buildingName,
      관리사무소연락처: orgContact?.phone ?? "",
    },
    scheduledAt: status === "scheduled" ? notice.publishedAt ?? undefined : undefined,
  };

  const handleDelete = async () => {
    try {
      await deleteNotice.mutateAsync(notice.id);
      toast.success("공지가 삭제되었습니다.");
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "공지를 삭제하지 못했습니다.");
    }
  };

  return (
    <>
      <Panel
        title="공지 상세"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void openNoticeMessaging()}
              disabled={!canSendMessages || recipientsLoading || mintShareToken.isPending}
              title={!canSendMessages ? "문자 발송 권한이 필요합니다." : undefined}
            >
              공지 알림 발송
            </Button>
            <Button type="button" variant="ghost" onClick={onEdit}>수정</Button>
            <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>삭제</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-blue-t px-2.5 py-1 text-blue-d">
            {NOTICE_TYPE_LABELS[notice.noticeType]}
          </Badge>
          <Badge className="bg-bg px-2.5 py-1 text-t2">
            {NOTICE_STATUS_LABELS[status]}
          </Badge>
          <span className="text-sm text-t3">{buildingName}</span>
        </div>

        <h2 className="mt-5 text-xl font-extrabold leading-8 text-t1">{notice.title}</h2>
        <div className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-bg p-4 text-sm leading-7 text-t1">
          {notice.content}
        </div>

        <dl className="mt-5 grid gap-x-5 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-[100px_1fr]">
          <dt className="font-semibold text-t3">게시 일시</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.publishedAt)}</dd>
          <dt className="font-semibold text-t3">게시 종료</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.expiresAt)}</dd>
          <dt className="font-semibold text-t3">작성 일시</dt>
          <dd className="num text-t1">{formatNoticeDate(notice.createdAt)}</dd>
        </dl>
      </Panel>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="공지 삭제">
        <p className="text-sm leading-6 text-t1">
          “{notice.title}” 공지를 삭제할까요? 삭제 후 목록에서 보이지 않습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>취소</Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteNotice.isPending}>
            {deleteNotice.isPending ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </Modal>

      {messageOpen && (
        <MessagingModal
          open
          preset={messagingPreset}
          onClose={() => setMessageOpen(false)}
          onSent={(result) => {
            toast.success(`공지 안내 ${result.count}건 발송을 접수했습니다.`);
            setMessageOpen(false);
          }}
        />
      )}
    </>
  );
}
