"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useBuildings } from "@/hooks/reactquery/buildings/queries";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import { useSendMessages } from "@/hooks/reactquery/messaging/mutations";
import {
  useMessagePointQuote,
  useTenantAlimtalkConsent,
} from "@/hooks/reactquery/messaging/queries";
import { MessageSendError } from "@/hooks/reactquery/messaging/apis";
import {
  buildRecipientRenderVariables,
  dedupeRecipients,
  validRecipients,
  type MessageRecipient,
  type ResolvedRecipient,
  type SendMode,
} from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";
import { subscribeMessengerHandoff } from "@/lib/messaging/messengerHandoff";
import {
  newUuid,
  resolveIdempotencyKey,
  type IdempotencyState,
} from "@/lib/messaging/idempotencyKey";
import { canonicalSendPayload } from "@/lib/messaging/sendSignature";
import { AlimtalkForm, AUTO_VARS, extractAlimtalkVariables } from "./AlimtalkForm";
import { MessageComposer } from "./MessageComposer";
import { MessengerPanel } from "./MessengerPanel";
import { PhonePreview } from "./PhonePreview";
import { RecipientCascade } from "./RecipientCascade";
import { SchedulePicker } from "./SchedulePicker";
import { SenderSelect } from "./SenderSelect";
import {
  CloseConfirmDialog,
  SendSummaryDialog,
} from "./SendSummaryDialog";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode } from "./types";
import { useMessengerState } from "./useMessengerState";
import { useDebouncedValue } from "@/hooks/common";

function formatPoints(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function resolveRecipients(
  recipients: MessageRecipient[],
  channel: ChannelMode,
  body: string,
): ResolvedRecipient[] {
  return recipients.map((recipient) => ({
    ...recipient,
    channel: channel === "alim" ? "alimtalk" : "sms",
    renderedBody: renderTemplate(
      body,
      buildRecipientRenderVariables(
        recipient,
        undefined,
        recipient.variables?.건물명,
      ),
    ),
  }));
}

interface SendFeedback {
  code: string | null;
  message: string;
}

function MessengerFabContent() {
  const { ui, openPanel, closePanel, toggleMin, setPos, setChannel } =
    useMessengerState();
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [alimtalkVars, setAlimtalkVars] = useState<Record<string, string>>({});
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [recurrenceMode, setRecurrenceMode] = useState<"monthly" | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<SendFeedback | null>(null);
  const [validationClock] = useState(() => Date.now());
  const idempotencyRef = useRef<IdempotencyState | null>(null);

  // 화면에서 openMessengerWith() 로 넘긴 수신자·본문을 받아 패널을 연다.
  // 정본의 `erp:dun` → `#fmpMsg` 채우기 → `fmpFab.click()` 과 같은 흐름이다.
  useEffect(
    () =>
      subscribeMessengerHandoff((handoff) => {
        setRecipients(handoff.recipients);
        if (handoff.body !== undefined) {
          setBody(handoff.body);
          setTemplateId(null);
        }
        if (handoff.channel) setChannel(handoff.channel);
        openPanel();
      }),
    [openPanel, setChannel],
  );

  const { data: templates = [] } = useMessageTemplates();
  const { data: buildings = [] } = useBuildings();
  const sendMessages = useSendMessages();
  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? null;
  const sendMode: SendMode = ui.channel === "alim" ? "alimtalk" : "sms";

  const clearTransientFeedback = () => {
    setSendFeedback((current) =>
      current &&
      current.code !== "PROVIDER_NOT_CONFIGURED" &&
      current.code !== "SENDER_NOT_REGISTERED"
        ? null
        : current,
    );
  };

  const buildingNames = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name])),
    [buildings],
  );
  const normalizedRecipients = useMemo(
    () => validRecipients(dedupeRecipients(recipients)),
    [recipients],
  );
  const enrichedRecipients = useMemo<MessageRecipient[]>(
    () =>
      normalizedRecipients.map((recipient) => {
        const buildingName = recipient.ref?.buildingId
          ? buildingNames.get(recipient.ref.buildingId)
          : undefined;
        return {
          ...recipient,
          variables: {
            ...(recipient.variables ?? {}),
            ...(buildingName ? { 건물명: buildingName } : {}),
            ...(ui.channel === "alim" ? alimtalkVars : {}),
          },
        };
      }),
    [alimtalkVars, buildingNames, normalizedRecipients, ui.channel],
  );

  const tenantsNeedingConsent = enrichedRecipients.filter(
    (recipient) =>
      recipient.kind === "tenant" &&
      recipient.alimtalkOptIn === undefined &&
      recipient.ref?.occupancyId !== undefined,
  );
  const consentBuildingId =
    ui.channel === "alim"
      ? (tenantsNeedingConsent[0]?.ref?.buildingId ?? 0)
      : 0;
  const consentQuery = useTenantAlimtalkConsent(consentBuildingId);
  const consentByOccupancy = useMemo(
    () =>
      new Map(
        (consentQuery.data ?? []).map((consent) => [
          consent.occupancyId,
          consent.alimtalkOptIn,
        ]),
      ),
    [consentQuery.data],
  );
  const consentLoading =
    ui.channel === "alim" &&
    tenantsNeedingConsent.length > 0 &&
    consentQuery.data === undefined &&
    !consentQuery.error;
  const eligibleRecipients = useMemo(
    () =>
      enrichedRecipients.filter((recipient) => {
        if (ui.channel !== "alim" || recipient.kind !== "tenant") return true;
        if (recipient.alimtalkOptIn !== undefined) return recipient.alimtalkOptIn;
        const occupancyId = recipient.ref?.occupancyId;
        return occupancyId !== undefined && consentByOccupancy.get(occupancyId) === true;
      }),
    [consentByOccupancy, enrichedRecipients, ui.channel],
  );
  const excludedCount =
    ui.channel === "alim" && !consentLoading
      ? enrichedRecipients.length - eligibleRecipients.length
      : 0;

  const quotedBody = useDebouncedValue(body, 350);
  const quotedRecipients = useMemo(
    () => resolveRecipients(eligibleRecipients, ui.channel, quotedBody),
    [eligibleRecipients, quotedBody, ui.channel],
  );
  const sendRecipients = useMemo(
    () => resolveRecipients(eligibleRecipients, ui.channel, body),
    [body, eligibleRecipients, ui.channel],
  );
  const quoteInput = useMemo(
    () =>
      !consentLoading &&
      eligibleRecipients.length > 0 &&
      quotedBody.trim().length > 0 &&
      (ui.channel === "sms" || templateId !== null)
        ? {
            mode: sendMode,
            recipients: quotedRecipients,
            templateId: ui.channel === "alim" ? templateId : null,
            body: quotedBody,
          }
        : null,
    [
      consentLoading,
      eligibleRecipients.length,
      quotedBody,
      quotedRecipients,
      sendMode,
      templateId,
      ui.channel,
    ],
  );
  const pointQuote = useMessagePointQuote(quoteInput);

  const providerGated = sendFeedback?.code === "PROVIDER_NOT_CONFIGURED";
  const senderGated =
    ui.channel === "alim" && sendFeedback?.code === "SENDER_NOT_REGISTERED";
  const pointsInsufficient =
    sendFeedback?.code === "INSUFFICIENT_POINTS" ||
    (pointQuote.data !== undefined && !pointQuote.data.sufficient);
  const quotePending =
    quoteInput !== null &&
    (body !== quotedBody || pointQuote.isPending || pointQuote.isFetching);
  const scheduledInvalid =
    scheduledAt !== null &&
    (Number.isNaN(Date.parse(scheduledAt)) ||
      Date.parse(scheduledAt) <= validationClock);

  let confirmationBlocker: string | null = null;
  if (providerGated) confirmationBlocker = "발송 설정 준비 중";
  else if (senderGated) confirmationBlocker = "알림톡 발신 설정 준비 중";
  else if (sendFeedback?.code === "INVALID_SCHEDULE") {
    confirmationBlocker = sendFeedback.message;
  }
  else if (consentQuery.error && tenantsNeedingConsent.length > 0) {
    confirmationBlocker = "알림톡 수신 동의를 확인하지 못했어요.";
  } else if (consentLoading) confirmationBlocker = "알림톡 수신 동의를 확인하고 있어요.";
  else if (eligibleRecipients.length === 0 && enrichedRecipients.length > 0) {
    confirmationBlocker = "알림톡 수신에 동의한 대상이 없어요.";
  } else if (scheduledInvalid) confirmationBlocker = "현재 이후의 예약 일시를 선택해 주세요.";
  else if (quotePending) confirmationBlocker = "예상 포인트를 계산하고 있어요.";
  else if (pointQuote.error) {
    confirmationBlocker =
      pointQuote.error instanceof Error
        ? pointQuote.error.message
        : "예상 포인트를 확인하지 못했어요.";
  } else if (pointsInsufficient) {
    confirmationBlocker = `포인트가 부족해요${pointQuote.data ? ` · 예상 ${formatPoints(pointQuote.data.estimatedPoints)} P / 가용 ${formatPoints(pointQuote.data.availablePoints)} P` : ""}`;
  }

  const footerDisabled =
    sendMessages.isPending ||
    enrichedRecipients.length === 0 ||
    providerGated ||
    senderGated ||
    pointsInsufficient ||
    (!consentLoading && enrichedRecipients.length > 0 && eligibleRecipients.length === 0);
  const footerLabel = providerGated
    ? "발송 설정 준비 중"
    : senderGated
      ? "알림톡 발신 설정 준비 중"
      : pointsInsufficient
        ? "포인트가 부족해요"
        : enrichedRecipients.length === 0
          ? "수신자를 선택해 주세요"
          : !consentLoading && eligibleRecipients.length === 0
            ? "알림톡 수신 동의 대상 없음"
            : `${eligibleRecipients.length}명에게 ${scheduledAt ? "예약 발송" : "발송"}`;

  const changeChannel = (channel: ChannelMode) => {
    if (channel === ui.channel) return;
    setChannel(channel);
    setRecipients([]);
    setBody("");
    setTemplateId(null);
    setAlimtalkVars({});
    setSummaryOpen(false);
    setSendFeedback((current) =>
      current?.code === "PROVIDER_NOT_CONFIGURED" ? current : null,
    );
    idempotencyRef.current = null;
  };

  const changeRecipients = (next: MessageRecipient[]) => {
    setRecipients(next);
    clearTransientFeedback();
  };

  const changeBody = (next: string) => {
    setBody(next);
    clearTransientFeedback();
  };

  const changeAlimtalkTemplate = (nextTemplateId: number | null) => {
    const template = templates.find((candidate) => candidate.id === nextTemplateId);
    setTemplateId(nextTemplateId);
    setBody(template?.body ?? "");
    setAlimtalkVars({});
    clearTransientFeedback();
  };

  const changeSchedule = (next: {
    scheduledAt: string | null;
    recurrenceMode: "monthly" | null;
  }) => {
    setScheduledAt(next.scheduledAt);
    setRecurrenceMode(next.recurrenceMode);
    clearTransientFeedback();
  };

  const manualUnresolved = extractAlimtalkVariables(body).filter(
    (name) =>
      !AUTO_VARS.has(name) &&
      !alimtalkVars[name]?.trim() &&
      !eligibleRecipients.some((recipient) => recipient.variables?.[name]?.trim()),
  );

  const confirmSend = async () => {
    if (
      scheduledAt &&
      (Number.isNaN(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.now())
    ) {
      const message = "현재 이후의 예약 일시를 선택해 주세요.";
      setSendFeedback({ code: "INVALID_SCHEDULE", message });
      toast.info(message);
      return;
    }
    if (
      confirmationBlocker ||
      !body.trim() ||
      eligibleRecipients.length === 0 ||
      (ui.channel === "alim" && templateId === null) ||
      manualUnresolved.length > 0 ||
      !pointQuote.data
    ) {
      return;
    }

    const effectiveTemplateId = ui.channel === "alim" ? templateId : null;
    const signature = canonicalSendPayload({
      mode: sendMode,
      body,
      context: "빠른발송",
      templateId: effectiveTemplateId,
      recipients: sendRecipients,
    });
    const idempotency = resolveIdempotencyKey(
      idempotencyRef.current,
      signature,
      newUuid,
    );
    idempotencyRef.current = idempotency;

    try {
      const recurrenceAnchorDay = scheduledAt && recurrenceMode === "monthly"
        ? Number(
            new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Seoul",
              day: "numeric",
            }).format(new Date(scheduledAt)),
          )
        : null;
      const result = await sendMessages.mutateAsync({
        mode: sendMode,
        body,
        context: "빠른발송",
        templateId: effectiveTemplateId,
        recipients: sendRecipients,
        scheduledAt,
        recurrenceMode,
        recurrenceAnchorDay,
        idempotencyKey: idempotency.key,
      });
      idempotencyRef.current = null;
      setSummaryOpen(false);
      setSendFeedback(null);
      toast.success(
        result.status === "scheduled"
          ? `예약 발송이 등록되었습니다 · ${result.count}건`
          : `발송을 접수했습니다 · ${result.queuedCount ?? result.count}건 · 결과 확인 중`,
      );
    } catch (error) {
      const code = error instanceof MessageSendError ? error.code : null;
      const message =
        code === "PROVIDER_NOT_CONFIGURED"
          ? "발송 설정 준비 중"
          : code === "INSUFFICIENT_POINTS"
            ? "포인트가 부족해 발송할 수 없어요."
            : code === "SENDER_NOT_REGISTERED"
              ? "알림톡 발신 설정 준비 중"
              : "메시지를 발송하지 못했습니다.";
      setSendFeedback({ code, message });
      toast.error(message);
    }
  };

  const confirmClose = () => {
    setRecipients([]);
    setSender("");
    setBody("");
    setTemplateId(null);
    setAlimtalkVars({});
    setScheduledAt(null);
    setRecurrenceMode(null);
    setSummaryOpen(false);
    setCloseConfirmOpen(false);
    setSendFeedback(null);
    idempotencyRef.current = null;
    closePanel();
  };

  return (
    <>
      {!ui.open && (
        <button
          type="button"
          aria-label="문자·알림톡 발송"
          className={styles["fmp-fab"]}
          onClick={openPanel}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        </button>
      )}
      {ui.open && (
        <MessengerPanel
          channel={ui.channel}
          minimized={ui.minimized}
          pos={ui.pos}
          onChannel={changeChannel}
          onMin={toggleMin}
          onClose={() => setCloseConfirmOpen(true)}
          onPos={setPos}
          onSend={() => setSummaryOpen(true)}
          sendLabel={footerLabel}
          sendDisabled={footerDisabled}
          sending={sendMessages.isPending}
          recipientCount={eligibleRecipients.length}
        >
          <div className={styles["fmp-top2"]}>
            {ui.channel === "sms" && (
              <div>
                <div className={styles["fmp-lbl"]}>발신 번호</div>
                <SenderSelect value={sender} onChange={setSender} />
              </div>
            )}
            <div>
              <div className={styles["fmp-lbl"]}>수신자</div>
              <RecipientCascade
                channel={ui.channel}
                onChange={changeRecipients}
              />
            </div>
          </div>

          {/* 정본: 예약전송은 수신자 아래·메시지 영역 위(full-width) */}
          <SchedulePicker
            value={{ scheduledAt, recurrenceMode }}
            onChange={changeSchedule}
          />

          <div className={styles["fmp-msg2col"]}>
            <div className={styles["fmp-msgL"]}>
              {ui.channel === "sms" ? (
                <MessageComposer
                  body={body}
                  onBody={changeBody}
                  templateId={templateId}
                  onTemplate={setTemplateId}
                />
              ) : (
                <AlimtalkForm
                  templateId={templateId}
                  onTemplate={changeAlimtalkTemplate}
                  vars={alimtalkVars}
                  onVars={(next) => {
                    setAlimtalkVars(next);
                    clearTransientFeedback();
                  }}
                />
              )}
            </div>
            <PhonePreview
              channel={ui.channel}
              body={body}
              template={ui.channel === "alim" ? selectedTemplate : null}
              sender={sender}
            />
          </div>
          {sendMessages.isPending && (
            <div className={styles["fmp-prog"]}>
              <i style={{ width: "100%" }} />
            </div>
          )}
        </MessengerPanel>
      )}

      {summaryOpen && (
        <SendSummaryDialog
          recipients={eligibleRecipients}
          channel={ui.channel}
          body={body}
          templateId={ui.channel === "alim" ? templateId : null}
          scheduledAt={scheduledAt}
          recurrenceMode={recurrenceMode}
          sender={sender}
          template={ui.channel === "alim" ? selectedTemplate : null}
          vars={alimtalkVars}
          estimatedPoints={pointQuote.data?.estimatedPoints ?? null}
          excludedCount={excludedCount}
          disabledReason={confirmationBlocker}
          isSending={sendMessages.isPending}
          onCancel={() => setSummaryOpen(false)}
          onConfirm={confirmSend}
        />
      )}

      {closeConfirmOpen && (
        <CloseConfirmDialog
          onCancel={() => setCloseConfirmOpen(false)}
          onConfirm={confirmClose}
        />
      )}
    </>
  );
}

export function MessengerFab() {
  const pathname = usePathname();
  if (!pathname.startsWith("/staff")) return null;
  return <MessengerFabContent />;
}
