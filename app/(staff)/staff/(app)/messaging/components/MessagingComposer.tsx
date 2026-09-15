"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Panel, Select, Textarea } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAccounts, type Account } from "@/hooks/reactquery/accounts";
import { useBuildings, type Building } from "@/hooks/reactquery/buildings";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import {
  useMessagePointQuote,
  useSendMessages,
  useTenantAlimtalkConsent,
  MessageSendError,
  type SendMessagesResult,
} from "@/hooks/reactquery/messaging";
import {
  useTenantList,
  type TenantListRow,
} from "@/hooks/reactquery/occupancies";
import { useQuickMessages, type QuickMessage } from "@/hooks/reactquery/quickMessages";
import { useDebouncedValue } from "@/hooks/common";
import { formatNumber } from "@/lib/format";
import { renderTemplate } from "@/lib/messaging/render";
import {
  newUuid,
  resolveIdempotencyKey,
  type IdempotencyState,
} from "@/lib/messaging/idempotencyKey";
import { canonicalSendPayload } from "@/lib/messaging/sendSignature";
import {
  buildRecipientRenderVariables,
  dedupeRecipients,
  validRecipients,
  type MessageChannel,
  type MessageRecipient,
  type MessagingPreset,
  type ResolvedRecipient,
  type SendMode,
} from "@/lib/messaging/preset";
import { MessagePointQuoteCard } from "./MessagePointQuoteCard";
import { MessagingWorkspaceView } from "./MessagingWorkspaceView";

export interface MessagingComposerProps {
  preset?: MessagingPreset;
  initialMode?: SendMode;
  onSent?: (result: SendMessagesResult) => void | Promise<void>;
  onFailed?: (error: unknown) => void | Promise<void>;
  presentation?: "default" | "workspace";
  itemCount?: number;
}

function recipientKey(recipient: MessageRecipient): string {
  if (recipient.ref?.occupancyId !== undefined) {
    return `tenant:${recipient.ref.occupancyId}:${recipient.phone ?? ""}`;
  }
  if (recipient.ref?.buildingId !== undefined && recipient.kind === "owner") {
    return `owner:${recipient.ref.buildingId}`;
  }
  if (recipient.ref?.userId !== undefined) {
    return `staff:${recipient.ref.userId}`;
  }
  return `${recipient.kind}:${recipient.phone ?? ""}:${recipient.name ?? ""}`;
}

function toLocalDateTimeInput(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const TenantRecipientOption = memo(function TenantRecipientOption({
  buildingId,
  tenant,
  checked,
  onToggle,
}: {
  buildingId: number;
  tenant: TenantListRow;
  checked: boolean;
  onToggle: (recipient: MessageRecipient) => void;
}) {
  const recipient: MessageRecipient = {
    name: tenant.tenantName,
    phone: tenant.phone,
    unitNo: tenant.unitNo,
    kind: "tenant",
    ref: {
      occupancyId: tenant.occupancyId ?? undefined,
      buildingId,
    },
  };
  const phoneLabel = recipient.phone ?? "연락처 없음";

  return (
    <Checkbox
      label={`${tenant.unitNo} · ${tenant.tenantName ?? "입주자 미등록"} · ${phoneLabel}`}
      checked={checked}
      disabled={!recipient.phone}
      onChange={() => onToggle(recipient)}
    />
  );
});

const StaffRecipientOption = memo(function StaffRecipientOption({
  account,
  checked,
  onToggle,
}: {
  account: Account;
  checked: boolean;
  onToggle: (recipient: MessageRecipient) => void;
}) {
  const recipient: MessageRecipient = {
    name: account.fullName,
    phone: account.phone,
    kind: "staff",
    ref: { userId: account.userId },
  };

  return (
    <Checkbox
      label={`${account.fullName} · ${account.phone ?? "연락처 없음"}`}
      checked={checked}
      disabled={!recipient.phone}
      onChange={() => onToggle(recipient)}
    />
  );
});

interface RecipientPreview {
  recipient: MessageRecipient;
  channel: MessageChannel | null;
  renderedBody: string;
}

const RecipientLists = memo(function RecipientLists({
  selectedBuildingId,
  selectedBuilding,
  occupiedTenants,
  activeAccounts,
  selectedKeys,
  isTenantsLoading,
  isAccountsLoading,
  onToggle,
}: {
  selectedBuildingId: number;
  selectedBuilding: Building | undefined;
  occupiedTenants: TenantListRow[];
  activeAccounts: Account[];
  selectedKeys: Set<string>;
  isTenantsLoading: boolean;
  isAccountsLoading: boolean;
  onToggle: (recipient: MessageRecipient) => void;
}) {
  const ownerRecipient: MessageRecipient | null = selectedBuilding
    ? {
        name: selectedBuilding.ownerName,
        phone: selectedBuilding.ownerPhone,
        kind: "owner",
        ref: { buildingId: selectedBuilding.id },
      }
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section
        aria-labelledby="tenant-recipient-title"
        className="rounded-xl border border-line p-4"
      >
        <h4 id="tenant-recipient-title" className="mb-3 text-sm font-extrabold text-t1">
          세대
        </h4>
        {!selectedBuilding && (
          <p className="text-sm text-t4">건물을 먼저 선택해 주세요.</p>
        )}
        {selectedBuilding && isTenantsLoading && (
          <p className="text-sm text-t4">세대 목록을 불러오는 중입니다.</p>
        )}
        {selectedBuilding && !isTenantsLoading && occupiedTenants.length === 0 && (
          <p className="text-sm text-t4">선택할 입주 세대가 없습니다.</p>
        )}
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {occupiedTenants.map((tenant) => {
            const tenantKey = `tenant:${tenant.occupancyId ?? ""}:${tenant.phone ?? ""}`;
            return (
              <TenantRecipientOption
                key={tenant.unitId}
                buildingId={selectedBuildingId}
                tenant={tenant}
                checked={selectedKeys.has(tenantKey)}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="owner-recipient-title"
        className="rounded-xl border border-line p-4"
      >
        <h4 id="owner-recipient-title" className="mb-3 text-sm font-extrabold text-t1">
          건물주
        </h4>
        {!ownerRecipient ? (
          <p className="text-sm text-t4">건물을 먼저 선택해 주세요.</p>
        ) : (
          <Checkbox
            label={`${ownerRecipient.name ?? "건물주"} · ${ownerRecipient.phone ?? "연락처 없음"}`}
            checked={selectedKeys.has(recipientKey(ownerRecipient))}
            disabled={!ownerRecipient.phone}
            onChange={() => onToggle(ownerRecipient)}
          />
        )}
      </section>

      <section
        aria-labelledby="staff-recipient-title"
        className="rounded-xl border border-line p-4"
      >
        <h4 id="staff-recipient-title" className="mb-3 text-sm font-extrabold text-t1">
          직원
        </h4>
        {isAccountsLoading && (
          <p className="text-sm text-t4">직원 목록을 불러오는 중입니다.</p>
        )}
        {!isAccountsLoading && activeAccounts.length === 0 && (
          <p className="text-sm text-t4">선택할 직원이 없습니다.</p>
        )}
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {activeAccounts.map((account) => (
            <StaffRecipientOption
              key={account.userId}
              account={account}
              checked={selectedKeys.has(`staff:${account.userId}`)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </section>
    </div>
  );
});

const SelectedRecipientList = memo(function SelectedRecipientList({
  recipients,
  previewByRecipient,
}: {
  recipients: MessageRecipient[];
  previewByRecipient: Map<string, RecipientPreview>;
}) {
  if (recipients.length === 0) return null;

  return (
    <section aria-label="선택된 수신처">
      <h4 className="mb-2 text-xs font-bold text-t2">선택된 수신처</h4>
      <div className="flex flex-wrap gap-2">
        {recipients.map((recipient, index) => {
          const preview = previewByRecipient.get(recipientKey(recipient));
          const channelLabel =
            preview?.channel === "alimtalk"
              ? "예상 알림톡"
              : preview?.channel === "sms"
                ? "예상 SMS"
                : "예상 제외";

          return (
            <div
              key={`${recipientKey(recipient)}:${index}`}
              className="rounded-lg bg-bg px-2.5 py-2 text-xs text-t2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {recipient.unitNo ? `${recipient.unitNo} · ` : ""}
                  {recipient.name ?? "이름 없음"}
                  {recipient.phone ? ` · ${recipient.phone}` : " · 연락처 없음"}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 font-bold ${
                    preview?.channel === null || !preview
                      ? "bg-danger/10 text-danger"
                      : "bg-brand/10 text-brand"
                  }`}
                >
                  {channelLabel}
                </span>
              </div>
              {preview && (
                <p className="mt-1 max-w-xl whitespace-pre-wrap text-t3">
                  {preview.renderedBody}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

const MessageBodyEditor = memo(function MessageBodyEditor({
  body,
  quickMessageId,
  quickMessages,
  onBodyChange,
  onQuickMessageChange,
}: {
  body: string;
  quickMessageId: string;
  quickMessages: QuickMessage[];
  onBodyChange: (body: string) => void;
  onQuickMessageChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
      <label>
        <span className="mb-1.5 block text-xs font-bold text-t2">본문</span>
        <Textarea
          aria-label="본문"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="발송할 문자 내용을 입력해 주세요."
          className="min-h-36 py-[16px]"
        />
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-bold text-t2">자주 보내는 문자</span>
        <Select
          aria-label="자주 보내는 문자"
          value={quickMessageId}
          onChange={(event) => onQuickMessageChange(event.target.value)}
          options={[
            { value: "", label: "문구를 선택해 주세요" },
            ...quickMessages.map((message) => ({
              value: String(message.id),
              label: message.title,
            })),
          ]}
        />
      </label>
    </div>
  );
});
export function MessagingComposer({
  preset,
  initialMode,
  onSent,
  onFailed,
  presentation = "default",
  itemCount,
}: MessagingComposerProps) {
  const confirm = useConfirm();
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    preset?.buildingId ?? preset?.recipients?.[0]?.ref?.buildingId ?? 0,
  );
  const [recipients, setRecipients] = useState<MessageRecipient[]>(() => [
    ...(preset?.recipients ?? []),
  ]);
  const [mode, setMode] = useState<SendMode>(
    initialMode ?? preset?.mode ?? "auto",
  );
  const [templateId, setTemplateId] = useState<number | null>(
    preset?.templateId ?? null,
  );
  const [body, setBody] = useState(preset?.body ?? "");
  const [bodyTouched, setBodyTouched] = useState(false);
  const [quickMessageId, setQuickMessageId] = useState("");
  const [sendTiming, setSendTiming] = useState<"now" | "scheduled">(
    preset?.scheduledAt ? "scheduled" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(() =>
    toLocalDateTimeInput(preset?.scheduledAt),
  );

  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const { data: tenants = [], isLoading: isTenantsLoading } =
    useTenantList(selectedBuildingId);
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts();
  const { data: quickMessages = [] } = useQuickMessages();
  const { data: templates = [], isLoading: isTemplatesLoading } =
    useMessageTemplates();
  const { data: tenantConsents = [] } =
    useTenantAlimtalkConsent(selectedBuildingId);
  const sendMessages = useSendMessages();

  const presetTemplate = useMemo(() => {
    const title = preset?.templateTitle?.trim();
    if (!title) return undefined;
    return templates.find((template) => template.title === title);
  }, [preset?.templateTitle, templates]);
  const effectiveTemplateId = templateId ?? presetTemplate?.id ?? null;
  const effectiveBody = bodyTouched ? body : (body || presetTemplate?.body || "");
  const quotedBody = useDebouncedValue(effectiveBody, 400);

  const selectedBuilding = buildings.find(
    (building) => building.id === selectedBuildingId,
  );
  const selectedKeys = useMemo(
    () => new Set(recipients.map(recipientKey)),
    [recipients],
  );
  const consentByOccupancy = useMemo(
    () =>
      new Map(
        tenantConsents.map((consent) => [
          consent.occupancyId,
          consent.alimtalkOptIn,
        ]),
      ),
    [tenantConsents],
  );
  const validRecipientList = useMemo(
    () => validRecipients(dedupeRecipients(recipients)),
    [recipients],
  );
  const recipientRoutes = useMemo(
    () =>
      validRecipientList.map((recipient) => {
        const occupancyId = recipient.ref?.occupancyId;
        const hasAlimtalkConsent =
          recipient.alimtalkOptIn ??
          (occupancyId !== undefined &&
            consentByOccupancy.get(occupancyId) === true);
        const channel: MessageChannel | null =
          mode === "sms"
            ? "sms"
            : hasAlimtalkConsent
              ? "alimtalk"
              : mode === "alimtalk"
                ? null
                : "sms";
        return { recipient, channel };
      }),
    [
      consentByOccupancy,
      mode,
      validRecipientList,
    ],
  );
  const renderRecipientPreviews = useCallback(
    (renderBody: string): RecipientPreview[] =>
      recipientRoutes.map(({ recipient, channel }) => ({
        recipient,
        channel,
        renderedBody: renderTemplate(
          renderBody,
          buildRecipientRenderVariables(
            recipient,
            preset?.commonVariables,
            selectedBuilding?.name,
          ),
        ),
      })),
    [preset?.commonVariables, recipientRoutes, selectedBuilding?.name],
  );
  const recipientPreviews = useMemo(
    () => renderRecipientPreviews(quotedBody),
    [quotedBody, renderRecipientPreviews],
  );
  const sendRecipients = useMemo<ResolvedRecipient[]>(
    () =>
      recipientPreviews.flatMap(({ recipient, channel, renderedBody }) =>
        channel === null
          ? []
          : [{ ...recipient, channel, renderedBody }],
      ),
    [recipientPreviews],
  );
  const submissionRecipients = useMemo<ResolvedRecipient[]>(
    () =>
      recipientPreviews.map(({ recipient, channel, renderedBody }) => ({
        ...recipient,
        channel: channel ?? (mode === "sms" ? "sms" : "alimtalk"),
        renderedBody,
      })),
    [mode, recipientPreviews],
  );
  // 견적 입력은 수신자별 최종 렌더 본문(renderedBody)을 담는다. 서버가 이 본문으로 SMS/LMS를 판정해야
  // 견적 건수·포인트가 예약·정산과 일치한다(공통 body 하나로 분류하면 개인화 시 어긋난다).
  const quoteInput = useMemo(
    () =>
      validRecipientList.length > 0 &&
      (mode === "sms" || effectiveTemplateId !== null)
        ? {
            mode,
            recipients: submissionRecipients,
            templateId: mode === "sms" ? null : effectiveTemplateId,
            body: quotedBody,
          }
        : null,
    [effectiveTemplateId, mode, quotedBody, submissionRecipients, validRecipientList.length],
  );
  const pointQuote = useMessagePointQuote(quoteInput);
  // 멱등 키: 한 논리적 발송 시도를 식별한다. 초안이 실질적으로 바뀌면 서명이 달라져 회전하고,
  // 같은 초안의 중복 클릭·재시도는 같은 키를 재사용한다. 성공 후에는 idemRef를 비워 회전한다.
  // 초안 서명은 모든 material 필드(mode·body·context·effective templateId·완전한 수신자)를 담는다.
  // 수신자 identity/ref가 바뀌면 서명이 달라져 키가 회전하므로, 대상이 바뀐 발송이 stale 키를 재사용하지 않는다.
  const idempotencyRef = useRef<IdempotencyState | null>(null);
  const previewByRecipient = useMemo(
    () =>
      new Map(
        recipientPreviews.map((preview) => [
          recipientKey(preview.recipient),
          preview,
        ]),
      ),
    [recipientPreviews],
  );
  const validCount = pointQuote.data?.recipientCount ?? sendRecipients.length;
  const excludedCount =
    pointQuote.data?.excludedCount ?? validRecipientList.length - sendRecipients.length;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const occupiedTenants = useMemo(
    () => tenants.filter((tenant) => !tenant.isVacant && tenant.occupancyId !== null),
    [tenants],
  );
  const quoteAllowsSend =
    effectiveBody === quotedBody &&
    pointQuote.data !== undefined &&
    !pointQuote.isFetching &&
    pointQuote.data.sufficient;
  const canSend =
    validCount > 0 &&
    effectiveBody.trim().length > 0 &&
    (mode === "sms" || effectiveTemplateId !== null) &&
    (sendTiming === "now" || scheduledAt.length > 0) &&
    quoteAllowsSend;

  const toggleRecipient = useCallback((recipient: MessageRecipient) => {
    const key = recipientKey(recipient);
    setRecipients((current) =>
      current.some((item) => recipientKey(item) === key)
        ? current.filter((item) => recipientKey(item) !== key)
        : [...current, recipient],
    );
  }, []);

  const changeBody = useCallback((nextBody: string) => {
    setBody(nextBody);
    setBodyTouched(true);
  }, []);

  const insertQuickMessage = useCallback((id: string) => {
    setQuickMessageId(id);
    const message = quickMessages.find((item) => String(item.id) === id);
    if (!message) return;
    setBody((current) =>
      current.trim().length > 0 ? `${current}\n${message.body}` : message.body,
    );
    setBodyTouched(true);
    setQuickMessageId("");
  }, [quickMessages]);

  const selectTemplate = (value: string) => {
    const nextTemplateId = Number(value) || null;
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (template) {
      setBody(template.body);
      setBodyTouched(true);
    }
  };

  const send = async () => {
    if (validRecipientList.length === 0) {
      toast.info("수신처를 선택해 주세요.");
      return;
    }
    if (effectiveBody.trim().length === 0) {
      toast.info("본문을 입력해 주세요.");
      return;
    }
    if (mode !== "sms" && effectiveTemplateId === null) {
      toast.info("알림톡 템플릿을 선택해 주세요.");
      return;
    }
    if (mode === "alimtalk" && validCount === 0) {
      toast.info("알림톡 수신에 동의한 수신처가 없습니다.");
      return;
    }
    if (effectiveBody !== quotedBody || pointQuote.isPending || pointQuote.isFetching) {
      toast.info("포인트 견적을 계산하고 있습니다.");
      return;
    }
    if (pointQuote.error || !pointQuote.data) {
      toast.error(
        pointQuote.error instanceof Error
          ? pointQuote.error.message
          : "포인트 견적을 확인해 주세요.",
      );
      return;
    }
    if (!pointQuote.data.sufficient) {
      toast.error("가용 포인트가 부족합니다.");
      return;
    }
    let scheduledIso: string | null = null;
    if (sendTiming === "scheduled") {
      const scheduledTime = new Date(scheduledAt);
      if (!scheduledAt || Number.isNaN(scheduledTime.getTime()) || scheduledTime.getTime() <= Date.now()) {
        toast.info("현재 이후의 예약 일시를 선택해 주세요.");
        return;
      }
      scheduledIso = scheduledTime.toISOString();
    }
    const actionLabel = sendTiming === "scheduled" ? "예약 발송" : "발송";
    const pointNotice = `${validCount}명 · 예상 ${formatNumber(pointQuote.data.estimatedPoints)} P (성공 발송분만 차감)`;
    const ok = await confirm({
      title: "문자 발송",
      description: `${pointNotice}\n${actionLabel}하시겠습니까?`,
      confirmLabel: actionLabel,
    });
    if (!ok) return;

    const currentSubmissionRecipients = renderRecipientPreviews(effectiveBody).map(
      ({ recipient, channel, renderedBody }) => ({
        ...recipient,
        channel: channel ?? (mode === "sms" ? "sms" : "alimtalk"),
        renderedBody,
      }),
    );
    const draftSignature = canonicalSendPayload({
      mode,
      body: effectiveBody,
      context: preset?.context ?? "manual",
      templateId: mode === "sms" ? null : effectiveTemplateId,
      recipients: currentSubmissionRecipients,
    });
    // 같은 초안이면 같은 키(중복 클릭·재시도 안전), 초안이 바뀌면 회전한다.
    const idempotency = resolveIdempotencyKey(idempotencyRef.current, draftSignature, newUuid);
    idempotencyRef.current = idempotency;

    try {
      const result = await sendMessages.mutateAsync({
        mode,
        body: effectiveBody,
        context: preset?.context ?? "manual",
        templateId: mode === "sms" ? null : effectiveTemplateId,
        recipients: currentSubmissionRecipients,
        scheduledAt: scheduledIso,
        idempotencyKey: idempotency.key,
      });
      // 성공 접수 후에는 키를 회전해 다음 논리적 발송이 새 키를 쓰게 한다.
      idempotencyRef.current = null;
      if (sendTiming === "scheduled") {
        toast.success(`예약이 등록되었습니다(${scheduledAt.replace("T", " ")})`);
      } else if (preset?.context === "고지서") {
        toast.success("발송을 접수했습니다. 결과 확인 중입니다.");
      } else {
        // 접수 완료(결과는 재조회로 확정). 성공 확정 토스트를 표시하지 않는다.
        toast.success(`발송을 접수했습니다 · ${result.queuedCount ?? result.count}건 · 결과 확인 중`);
      }
      await onSent?.(result);
    } catch (error) {
      const code = error instanceof MessageSendError ? error.code : null;
      // 비종결(진행 중/결과 불명확) 응답은 성공도 확정 실패도 아니다. onSent/onFailed 어느 것도 부르지
      // 않고(특히 고지서 흐름의 record_bill_delivery(queued) 기록 금지), 멱등 키를 유지해 같은 초안으로
      // 안전하게 재시도할 수 있게 한다. 정보성 토스트만 띄운다.
      if (code === "SEND_IN_PROGRESS" || code === "SEND_UNCONFIRMED") {
        idempotencyRef.current = idempotency; // 성공 시에만 회전. 비종결은 키 유지.
        toast.info(
          code === "SEND_IN_PROGRESS"
            ? "발송이 처리 중입니다. 잠시 후 결과를 확인해 주세요."
            : "발송 접수 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요.",
        );
        return;
      }
      // 확정 실패(SEND_REJECTED 등)만 종결 콜백을 호출한다.
      await onFailed?.(error);
      const message =
        code === "INSUFFICIENT_POINTS"
          ? "포인트가 부족합니다."
          : code === "PROVIDER_NOT_CONFIGURED"
            ? "발송 공급자가 설정되지 않아 발송할 수 없습니다."
            : preset?.context === "고지서"
              ? "발송에 실패했습니다. 다시 시도해 주세요."
              : error instanceof Error
                ? error.message
                : "발송하지 못했습니다.";
      toast.error(message);
    }
  };

  if (presentation === "workspace") {
    return (
      <MessagingWorkspaceView
        mode={mode}
        onModeChange={setMode}
        senderPhone={preset?.commonVariables?.관리사무소연락처 || "대표번호 미등록"}
        recipients={recipients}
        onClearRecipients={() => setRecipients([])}
        recipientLabel={preset?.context === "독촉" ? "미납 독촉 대상" : "선택 수신자"}
        itemCount={itemCount ?? validRecipientList.length}
        templates={templates}
        effectiveTemplateId={effectiveTemplateId}
        isTemplatesLoading={isTemplatesLoading}
        onTemplateChange={selectTemplate}
        body={effectiveBody}
        previewBody={recipientPreviews[0]?.renderedBody ?? effectiveBody}
        onBodyChange={changeBody}
        sendTiming={sendTiming}
        onSendTimingChange={setSendTiming}
        scheduledAt={scheduledAt}
        onScheduledAtChange={setScheduledAt}
        onSend={() => void send()}
        sending={sendMessages.isPending}
        canSend={canSend}
      />
    );
  }

  return (
    <Panel
      title="문자 발송"
      action={
        <span className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          {validCount}명
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              발송 모드
            </span>
            <Select
              aria-label="발송 모드"
              value={mode}
              onChange={(event) => setMode(event.target.value as SendMode)}
              options={[
                { value: "auto", label: "자동" },
                { value: "sms", label: "SMS" },
                { value: "alimtalk", label: "알림톡" },
              ]}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              건물 선택
            </span>
            <Select
              aria-label="건물 선택"
              value={String(selectedBuildingId || "")}
              disabled={isBuildingsLoading}
              onChange={(event) =>
                setSelectedBuildingId(Number(event.target.value) || 0)
              }
              options={[
                { value: "", label: "건물을 선택해 주세요" },
                ...buildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
          </label>
        </div>

        {mode !== "sms" && (
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              알림톡 템플릿
            </span>
            <Select
              aria-label="알림톡 템플릿"
              value={effectiveTemplateId === null ? "" : String(effectiveTemplateId)}
              disabled={isTemplatesLoading}
              onChange={(event) => selectTemplate(event.target.value)}
              options={[
                { value: "", label: "템플릿을 선택해 주세요" },
                ...templates.map((template) => ({
                  value: String(template.id),
                  label: template.title,
                })),
              ]}
            />
          </label>
        )}

        <RecipientLists
          selectedBuildingId={selectedBuildingId}
          selectedBuilding={selectedBuilding}
          occupiedTenants={occupiedTenants}
          activeAccounts={activeAccounts}
          selectedKeys={selectedKeys}
          isTenantsLoading={isTenantsLoading}
          isAccountsLoading={isAccountsLoading}
          onToggle={toggleRecipient}
        />

        <SelectedRecipientList
          recipients={recipients}
          previewByRecipient={previewByRecipient}
        />

        {mode === "alimtalk" && excludedCount > 0 && (
          <p
            role="alert"
            className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
          >
            알림톡 미동의 수신처 {excludedCount}명은 제외됩니다.
          </p>
        )}

        <MessagePointQuoteCard
          quote={pointQuote.data}
          isLoading={
            quoteInput !== null && (
              effectiveBody !== quotedBody || pointQuote.isPending || pointQuote.isFetching
            )
          }
          error={pointQuote.error}
        />

        <MessageBodyEditor
          body={effectiveBody}
          quickMessageId={quickMessageId}
          quickMessages={quickMessages}
          onBodyChange={changeBody}
          onQuickMessageChange={insertQuickMessage}
        />

        <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">발송 시점</span>
            <Select
              aria-label="발송 시점"
              value={sendTiming}
              onChange={(event) => setSendTiming(event.target.value as "now" | "scheduled")}
              options={[
                { value: "now", label: "즉시 발송" },
                { value: "scheduled", label: "예약 발송" },
              ]}
            />
          </label>
          {sendTiming === "scheduled" && (
            <label>
              <span className="mb-1.5 block text-xs font-bold text-t2">예약 발송 일시</span>
              <input
                type="datetime-local"
                aria-label="예약 발송 일시"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1 focus:border-brand focus:outline-none"
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-sm text-t3">
            발송 가능한 수신처 <strong className="text-t1">{validCount}명</strong>
          </p>
          <Button
            type="button"
            onClick={send}
            disabled={sendMessages.isPending}
            aria-disabled={!canSend || sendMessages.isPending}
            className={!canSend ? "opacity-70" : ""}
          >
            {sendMessages.isPending ? "발송 중…" : sendTiming === "scheduled" ? "예약 발송" : "발송"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
