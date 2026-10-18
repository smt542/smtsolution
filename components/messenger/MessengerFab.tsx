"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useAccounts } from "@/hooks/reactquery/accounts/queries";
import { useBuildings } from "@/hooks/reactquery/buildings/queries";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import { useSendMessages } from "@/hooks/reactquery/messaging/mutations";
import { useRecordBillDelivery } from "@/hooks/reactquery/bill";
import { useAttachNoticeSendLog } from "@/hooks/reactquery/notices";
import {
  useMessagePointQuote,
  useTenantAlimtalkConsent,
} from "@/hooks/reactquery/messaging/queries";
import { MessageSendError, type RecurrenceMode } from "@/hooks/reactquery/messaging/apis";
import {
  buildRecipientRenderVariables,
  dedupeRecipients,
  validRecipients,
  type MessageRecipient,
  type ResolvedRecipient,
  type SendMode,
} from "@/lib/messaging/preset";
import { extractVariables, renderTemplate } from "@/lib/messaging/render";
import { currentPeriod } from "@/lib/billing/period";
import {
  subscribeMessengerHandoff,
  type RecipientCascadePreset,
} from "@/lib/messaging/messengerHandoff";
import {
  newUuid,
  resolveIdempotencyKey,
  shouldRotateAfterSendError,
  type IdempotencyState,
} from "@/lib/messaging/idempotencyKey";
import { canonicalSendPayload } from "@/lib/messaging/sendSignature";
import { smsBuildingVariables, smsPreviewBody, type SmsVariableBuilding } from "@/lib/messenger/smsVariables";
import { AlimtalkForm } from "./AlimtalkForm";
import { MessageComposer } from "./MessageComposer";
import { MessengerPanel } from "./MessengerPanel";
import { PhonePreview } from "./PhonePreview";
import { RecipientCascade } from "./RecipientCascade";
import { SchedulePicker, type ScheduleValue } from "./SchedulePicker";
import { SenderSelect } from "./SenderSelect";
import {
  CloseConfirmDialog,
  SendSummaryDialog,
} from "./SendSummaryDialog";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode } from "./types";
import { useMessengerState } from "./useMessengerState";
import { useAlimtalkDynamicVariables } from "./useAlimtalkDynamicVariables";
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

/**
 * 알림톡: 값이 없는 #{변수}는 빈 값으로 채워 보낸다(2026-10-15 결정 — 값 유무와 관계없이 발송).
 * 본문은 렌더 결과에 남은 #{}를 지우고, 버튼 URL 변수는 서버가 수신자 변수로 렌더하므로 빈 값을 넣어 둔다.
 */
function fillMissingVariables(
  recipients: ResolvedRecipient[],
  buttonVariableNames: string[],
): ResolvedRecipient[] {
  return recipients.map((recipient) => {
    const variables = { ...(recipient.variables ?? {}) };
    for (const name of buttonVariableNames) {
      if (!Object.prototype.hasOwnProperty.call(variables, name)) variables[name] = "";
    }
    return {
      ...recipient,
      variables,
      renderedBody: recipient.renderedBody?.replace(/#\{[^}]+\}/g, "") ?? recipient.renderedBody,
    };
  });
}

interface SendFeedback {
  code: string | null;
  message: string;
}

function MessengerFabContent() {
  const { ui, openPanel, closePanel, toggleMin, setPos, setChannel } =
    useMessengerState();
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [cascadeSeed, setCascadeSeed] = useState<{
    seq: number;
    preset: RecipientCascadePreset | null;
    /** 화면이 직접 넘긴 수신자 — 캐스케이드가 유형·건물·입주자 칸에 요약으로 보여준다. */
    handed: MessageRecipient[];
  }>({ seq: 0, preset: null, handed: [] });
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [alimtalkVars, setAlimtalkVars] = useState<Record<string, string>>({});
  // 승인 템플릿 자동 채움(관리비 고지 부과월·공지 선택, useAlimtalkDynamicVariables).
  const [billPeriod, setBillPeriod] = useState(() => currentPeriod());
  const [noticeId, setNoticeId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode | null>(null);
  const [recurrenceEndCount, setRecurrenceEndCount] = useState<number | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<SendFeedback | null>(null);
  const [validationClock] = useState(() => Date.now());
  const idempotencyRef = useRef<IdempotencyState | null>(null);
  // 닫기를 확인하면 패널은 0.2초 닫힘 전환을 마친 뒤에 내리고, 그때 작성 내용을 비운다.
  const [closing, setClosing] = useState(false);
  const [draftSeq, setDraftSeq] = useState(0);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const finishClose = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
    setClosing(false);
    // 닫히는 도중 다시 열면 패널이 내려가지 않으므로 key 를 바꿔 새 작성으로 다시 마운트한다.
    setDraftSeq((seq) => seq + 1);
    setRecipients([]);
    setCascadeSeed((current) => ({ ...current, preset: null, handed: [] }));
    setSender("");
    setBody("");
    setTemplateId(null);
    setAlimtalkVars({});
    setBillPeriod(currentPeriod());
    setNoticeId(null);
    setScheduledAt(null);
    setRecurrenceMode(null);
    setRecurrenceEndCount(null);
    setSummaryOpen(false);
    setSendFeedback(null);
    idempotencyRef.current = null;
  }, []);

  // 화면에서 openMessengerWith() 로 넘긴 수신자·본문을 받아 패널을 연다.
  // 정본의 `erp:dun` → `#fmpMsg` 채우기 → `fmpFab.click()` 과 같은 흐름이다.
  useEffect(
    () =>
      subscribeMessengerHandoff((handoff) => {
        if (closing) finishClose();
        setRecipients(handoff.cascade ? [] : (handoff.recipients ?? []));
        // 핸드오프마다 캐스케이드를 다시 마운트해 수신자 칸을 프리셋과 맞춘다.
        setCascadeSeed((current) => ({
          seq: current.seq + 1,
          preset: handoff.cascade ?? null,
          handed: handoff.cascade ? [] : (handoff.recipients ?? []),
        }));
        if (handoff.body !== undefined) {
          setBody(handoff.body);
          setTemplateId(handoff.channel === "alim" ? (handoff.templateId ?? null) : null);
          // 템플릿을 지정해 열면 이전 수동 알림톡 변수를 비워 수신자별 변수를 덮어쓰지 않게 한다.
          if (handoff.templateId !== undefined) setAlimtalkVars({});
        }
        if (handoff.channel) setChannel(handoff.channel);
        openPanel();
      }),
    [closing, finishClose, openPanel, setChannel],
  );

  const { data: templates = [] } = useMessageTemplates();
  const { data: buildings = [] } = useBuildings();
  const sendMessages = useSendMessages();
  const recordBillDelivery = useRecordBillDelivery();
  const attachNoticeSendLog = useAttachNoticeSendLog();
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

  const { data: accounts = [] } = useAccounts();
  // 문자 템플릿 변수(건물명·건물주명·청소담당자명)를 수신자 건물 기준으로 채우기 위한 건물 정보.
  const smsBuildings = useMemo(
    () => new Map<number, SmsVariableBuilding>(buildings.map((building) => [building.id, {
      name: building.name,
      ownerName: building.ownerName,
      cleanerName: building.cleaningUserId
        ? (accounts.find((account) => account.userId === building.cleaningUserId)?.fullName ?? null)
        : null,
    }])),
    [accounts, buildings],
  );
  const normalizedRecipients = useMemo(
    () => validRecipients(dedupeRecipients(recipients)),
    [recipients],
  );
  const dynamicBuildingNames = useMemo(
    () => new Map([...smsBuildings].map(([id, building]) => [id, building.name])),
    [smsBuildings],
  );
  const dynamic = useAlimtalkDynamicVariables({
    template: ui.channel === "alim" ? selectedTemplate : null,
    body,
    recipients: normalizedRecipients,
    buildingNames: dynamicBuildingNames,
    period: billPeriod,
    noticeId,
  });
  // 문자(수기 작성)도 본문에 관리비 변수(#{청구금액} 등)가 있으면 세대별 금액을 채운다(2026-10-18).
  const dynamicActive = dynamic.kind !== null && (ui.channel === "alim" || dynamic.kind.type === "bill");
  /** 승인 관리비 고지 템플릿(카카오 고지 기록 대상). 수기 작성·일반 템플릿은 고지 기록을 남기지 않는다. */
  const billNoticeTemplate = dynamic.kind?.type === "bill" && dynamic.kind.billKind !== null;
  const enrichedRecipients = useMemo<MessageRecipient[]>(
    () =>
      normalizedRecipients.map((recipient) => {
        const building = recipient.ref?.buildingId
          ? smsBuildings.get(recipient.ref.buildingId)
          : undefined;
        return {
          ...recipient,
          variables: {
            // 화면이 넘긴 수신자별 변수가 건물 기준 값보다 우선한다.
            ...smsBuildingVariables(recipient, building),
            ...(recipient.variables ?? {}),
            ...(building ? { 건물명: building.name } : {}),
            ...(ui.channel === "alim" ? alimtalkVars : {}),
            ...(dynamicActive ? dynamic.commonVariables : {}),
            ...(dynamicActive && recipient.ref?.unitId !== undefined
              ? (dynamic.variablesByUnit.get(recipient.ref.unitId) ?? {})
              : {}),
          },
        };
      }),
    [
      alimtalkVars,
      dynamic.commonVariables,
      dynamic.variablesByUnit,
      dynamicActive,
      normalizedRecipients,
      smsBuildings,
      ui.channel,
    ],
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
  const consentedRecipients = useMemo(
    () =>
      enrichedRecipients.filter((recipient) => {
        if (ui.channel !== "alim" || recipient.kind !== "tenant") return true;
        if (recipient.alimtalkOptIn !== undefined) return recipient.alimtalkOptIn;
        const occupancyId = recipient.ref?.occupancyId;
        return occupancyId !== undefined && consentByOccupancy.get(occupancyId) === true;
      }),
    [consentByOccupancy, enrichedRecipients, ui.channel],
  );
  // 관리비 고지 템플릿은 고른 부과월 고지 정보가 있는 입주 세대에만 보낸다(유형이 다르거나 부과 확정이 없으면 제외).
  const dynamicExcluded = useMemo(
    () =>
      dynamicActive && dynamic.kind?.type === "bill"
        ? consentedRecipients.filter((recipient) => {
            const unitId = recipient.ref?.unitId;
            return unitId === undefined || !dynamic.variablesByUnit.has(unitId);
          })
        : [],
    [consentedRecipients, dynamic.kind, dynamic.variablesByUnit, dynamicActive],
  );
  // 고지 정보가 없는 수신자도 제외하지 않고 빈 값으로 보낸다(2026-10-15 결정).
  const eligibleRecipients = consentedRecipients;
  const excludedCount =
    ui.channel === "alim" && !consentLoading
      ? enrichedRecipients.length - consentedRecipients.length
      : 0;
  // 자동 채움 제외 사유 요약(예: 「이 달 부과 확정 내역 없음 2명 · 고지 유형이 자동이체 세대 1명」).
  const dynamicHint = useMemo(() => {
    if (!dynamicActive) return null;
    if (dynamic.loading) return "수신자별 값을 불러오는 중이에요.";
    if (dynamicExcluded.length === 0) return null;
    const counts = new Map<string, number>();
    for (const recipient of dynamicExcluded) {
      const unitId = recipient.ref?.unitId;
      const reason = (unitId !== undefined ? dynamic.excludedByUnit.get(unitId) : undefined) ?? "입주 세대가 아님";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return `값이 없는 수신자 ${dynamicExcluded.length}명은 빈 값으로 보내요 — ${[...counts]
      .map(([reason, count]) => `${reason} ${count}명`)
      .join(" · ")}`;
  }, [dynamic.excludedByUnit, dynamic.loading, dynamicActive, dynamicExcluded]);

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
  else if (dynamicActive && dynamic.loading) confirmationBlocker = "수신자별 값을 불러오는 중이에요.";
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
    // 캐스케이드는 채널 전환 때 입주자·건물주 선택을 유지하고 선택이 그대로면 onChange를 다시 보내지 않으므로,
    // 부모 수신자를 비우면 칸에는 입주자가 선택돼 있는데 발송 인원이 0명이 된다.
    // 직원·청소담당은 알림톡 전환 때 캐스케이드가 선택을 지우고 []를 통지한다.
    setRecipients((current) =>
      channel === "alim"
        ? current.filter((recipient) => recipient.kind === "tenant" || recipient.kind === "owner")
        : current,
    );
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
    setNoticeId(null);
    clearTransientFeedback();
  };

  const changeSchedule = (next: ScheduleValue) => {
    setScheduledAt(next.scheduledAt);
    setRecurrenceMode(next.recurrenceMode);
    setRecurrenceEndCount(next.recurrenceEndCount);
    clearTransientFeedback();
  };

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
      !pointQuote.data
    ) {
      return;
    }

    const effectiveTemplateId = ui.channel === "alim" ? templateId : null;
    // 승인 템플릿 자동 채움: 발송 직전에 링크(고지서 상세·공지 버튼)를 발급해 수신자 변수에 넣는다.
    let finalRecipients = sendRecipients;
    if (dynamicActive) {
      try {
        // 고지서 링크는 고지 정보가 있는 세대만 발급한다(없는 세대는 빈 값으로 보낸다).
        const unitIds = [...new Set(eligibleRecipients
          .map((recipient) => recipient.ref?.unitId)
          .filter((unitId): unitId is number => unitId !== undefined)
          .filter((unitId) => dynamic.kind?.type !== "bill" || dynamic.variablesByUnit.has(unitId)))];
        const links = await dynamic.resolveLinks(unitIds).catch(() => {
          // 링크를 발급하지 못해도 빈 값으로 보낸다.
          toast.info(dynamic.kind?.type === "bill" ? "고지서 상세 링크 없이 보내요." : "공지 링크 없이 보내요.");
          return { common: {}, byUnit: new Map<number, Record<string, string>>() };
        });
        finalRecipients = resolveRecipients(
          eligibleRecipients.map((recipient) => ({
            ...recipient,
            variables: {
              ...(recipient.variables ?? {}),
              ...links.common,
              ...(recipient.ref?.unitId !== undefined ? (links.byUnit.get(recipient.ref.unitId) ?? {}) : {}),
            },
          })),
          ui.channel,
          body,
        );
      } catch {
        toast.error(dynamic.kind?.type === "bill" ? "고지서 상세 링크를 발급하지 못했어요." : "공지 링크를 발급하지 못했어요.");
        return;
      }
    }
    if (ui.channel === "alim") {
      const buttonVariableNames = [...new Set((selectedTemplate?.buttons ?? []).flatMap((button) =>
        [button.u1, button.u2].flatMap((url) => (typeof url === "string" ? extractVariables(url) : []))))];
      finalRecipients = fillMissingVariables(finalRecipients, buttonVariableNames);
    }
    const signature = canonicalSendPayload({
      mode: sendMode,
      body,
      context: "빠른발송",
      templateId: effectiveTemplateId,
      recipients: finalRecipients,
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
        recipients: finalRecipients,
        scheduledAt,
        recurrenceMode,
        recurrenceAnchorDay,
        recurrenceEndCount,
        idempotencyKey: idempotency.key,
      });
      idempotencyRef.current = null;
      // 발송 기록(비핵심 — 실패해도 발송은 접수됨): 공지는 발송 로그를 공지에 귀속, 관리비 고지는 세대별 카카오 고지 기록.
      if (result.logId && dynamicActive) {
        try {
          if (dynamic.kind?.type === "notice" && noticeId !== null) {
            await attachNoticeSendLog.mutateAsync({ logId: result.logId, noticeId });
          } else if (billNoticeTemplate && result.status !== "scheduled") {
            const unitsByBuilding = new Map<number, Set<number>>();
            for (const recipient of finalRecipients) {
              const { buildingId, unitId } = recipient.ref ?? {};
              if (buildingId === undefined || unitId === undefined) continue;
              unitsByBuilding.set(buildingId, (unitsByBuilding.get(buildingId) ?? new Set<number>()).add(unitId));
            }
            for (const [buildingId, unitIds] of unitsByBuilding) {
              await recordBillDelivery.mutateAsync({
                buildingId,
                period: billPeriod,
                unitIds: [...unitIds],
                issueType: "kakao",
                sendStatus: "queued",
                messageLogId: result.logId,
              });
            }
          }
        } catch {
          toast.info("발송은 접수됐지만 발송 기록 일부를 남기지 못했어요.");
        }
      }
      setSummaryOpen(false);
      setSendFeedback(null);
      const blocked = result.status === "scheduled" ? 0 : (result.blockedCount ?? 0);
      toast.success(
        result.status === "scheduled"
          ? `예약 발송이 등록되었습니다 · ${result.count}건`
          : `발송을 접수했습니다 · ${result.queuedCount ?? result.count}건 · 결과 확인 중${
              blocked > 0 ? ` · 발송 제한 번호 ${blocked}명 제외` : ""
            }`,
      );
    } catch (error) {
      const code = error instanceof MessageSendError ? error.code : null;
      // 확정 거절(예약 반환)이면 키를 바꿔, 충전·허용 목록 변경 뒤 같은 초안 재시도가 새 발송이 되게 한다.
      if (shouldRotateAfterSendError(code)) idempotencyRef.current = null;
      const message =
        code === "PROVIDER_NOT_CONFIGURED"
          ? "발송 설정 준비 중"
          : code === "INSUFFICIENT_POINTS"
            ? "포인트가 부족해 발송할 수 없어요."
            : code === "SENDER_NOT_REGISTERED"
              ? "알림톡 발신 설정 준비 중"
              : code === "RECIPIENT_NOT_ALLOWED"
                ? "발송 제한 번호라 보내지 않았어요."
                : code === "PROVIDER_INSUFFICIENT_BALANCE"
                  ? "팝빌 충전 잔액이 부족해 발송하지 못했어요. 운영사에 충전을 요청해 주세요."
                  : "메시지를 발송하지 못했습니다.";
      setSendFeedback({ code, message });
      toast.error(message);
    }
  };

  // 정본 closeFmp: 패널은 .show 가 빠지며 닫힘 전환을 타고, FAB 은 바로 다시 보인다.
  const confirmClose = () => {
    setCloseConfirmOpen(false);
    setClosing(true);
    closePanel();
    // transitionend 를 못 받는 경우(탭 전환 등)에도 패널이 남지 않게 전환 시간 뒤 내린다.
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(finishClose, 250);
  };

  const openFromFab = () => {
    if (closing) finishClose();
    openPanel();
  };

  return (
    <>
      {!ui.open && (
        <button
          type="button"
          aria-label="문자·알림톡 발송"
          className={styles["fmp-fab"]}
          onClick={openFromFab}
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
      {(ui.open || closing) && (
        <MessengerPanel
          key={draftSeq}
          channel={ui.channel}
          minimized={ui.minimized}
          closing={closing}
          onClosed={finishClose}
          pos={ui.pos}
          onChannel={changeChannel}
          onMin={toggleMin}
          onClose={() => setCloseConfirmOpen(true)}
          onPos={setPos}
          onSend={() => setSummaryOpen(true)}
          sendLabel={footerLabel}
          sendDisabled={footerDisabled}
          sending={sendMessages.isPending}
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
                key={cascadeSeed.seq}
                channel={ui.channel}
                preset={cascadeSeed.preset}
                handed={cascadeSeed.handed}
                onChange={changeRecipients}
              />
            </div>
          </div>

          {/* 정본: 예약전송은 수신자 아래·메시지 영역 위(full-width) */}
          <SchedulePicker
            value={{ scheduledAt, recurrenceMode, recurrenceEndCount }}
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
                  dynamic={dynamic.kind ? {
                    kind: dynamic.kind,
                    period: billPeriod,
                    onPeriod: (next) => {
                      setBillPeriod(next);
                      clearTransientFeedback();
                    },
                    noticeId,
                    onNotice: (next) => {
                      setNoticeId(next);
                      clearTransientFeedback();
                    },
                    notices: dynamic.notices,
                    hint: dynamicHint,
                  } : null}
                  onVars={(next) => {
                    setAlimtalkVars(next);
                    clearTransientFeedback();
                  }}
                />
              )}
            </div>
            <PhonePreview
              channel={ui.channel}
              // 문자: 첫 수신자 값으로 변수를 치환해 보여 준다(값이 없으면 예시 값).
              body={ui.channel === "sms" ? smsPreviewBody(body, eligibleRecipients[0] ?? enrichedRecipients[0]) : body}
              template={ui.channel === "alim" ? selectedTemplate : null}
              sender={sender}
            />
          </div>
          {sendMessages.isPending && (
            <div className={styles["fmp-prog"]}>
              <i className="w-full" />
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
          recurrenceEndCount={recurrenceEndCount}
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
