import { hasUnresolvedVariables } from "@/lib/messaging/render";
import type { PopbillError } from "popbill";
import { assertLiveRecipientsAllowed } from "./allowlist";
import { readPopbillConfig, requirePopbillSender, type PopbillConfig } from "./config";
import { getKakaoService, getMessageService } from "./sdk";
import { checkSenderRegistered } from "./senders";
import {
  PopbillSubmitError,
  submitWithTimeout,
  type MessageBatchInput,
  type MessageContent,
  type ProviderSubmission,
} from "./types";

/** 접수 어댑터 옵션. timeoutMs로 응답 없는 접수의 무한 대기를 막는다(테스트에서 주입 가능). */
export interface SubmitOptions {
  timeoutMs?: number;
}

/**
 * Popbill 문자(SMS/LMS)·알림톡 접수 어댑터 — **서버 전용**.
 *
 * 각 배치를 하나의 requestNum으로 접수하고 receiptNum을 정규화한다. 접수 성공은 발송 성공이
 * 아니며, 최종 결과는 별도 재조회(results.ts/reconcile.ts)로 확정한다. 오류는 비밀값 없이 정제한다.
 */

function toSubmitError(err: PopbillError | undefined): PopbillSubmitError {
  const code = err?.code === undefined || err?.code === null ? "PROVIDER_ERROR" : String(err.code);
  return new PopbillSubmitError(code, err?.message ?? "공급자 접수 오류");
}

export async function submitMessageBatch(
  batch: MessageBatchInput,
  content: MessageContent,
  config: PopbillConfig = readPopbillConfig(),
  options: SubmitOptions = {},
): Promise<ProviderSubmission> {
  // 운영 모드 마지막 확인: 허용 목록 밖 번호가 있으면 SDK를 부르지 않는다(발송 단계 필터의 안전망).
  assertLiveRecipientsAllowed(batch.orgId, batch.recipients.map((r) => r.phone), config);
  const receiptNum =
    batch.product === "alimtalk"
      ? await submitAlimtalk(batch, content, config, options)
      : batch.product === "lms"
        ? await submitLms(batch, content, config, options)
        : await submitSms(batch, content, config, options);

  return {
    requestNum: batch.requestNum,
    receiptNum,
    product: batch.product,
    recipients: batch.recipients.map((r) => ({
      recipientKey: r.recipientKey,
      providerRefKey: r.providerRefKey,
    })),
  };
}

function submitSms(
  batch: MessageBatchInput,
  content: MessageContent,
  config: PopbillConfig,
  options: SubmitOptions,
): Promise<string> {
  const sender = requirePopbillSender(config, "sms");
  const service = getMessageService(config);
  const messages = batch.recipients.map((r) => ({
    Receiver: r.phone,
    ReceiverName: r.name ?? undefined,
    Contents: r.renderedBody ?? content.body,
    interOPRefKey: r.providerRefKey,
  }));
  return submitWithTimeout<string>((resolve, reject) => {
    service.sendSMS_multi(
      config.corpNum,
      sender,
      content.body,
      messages,
      null,
      false,
      batch.requestNum,
      "",
      config.userId ?? "",
      (receiptNum) => resolve(receiptNum),
      (err) => reject(toSubmitError(err)),
    );
  }, options.timeoutMs);
}

function submitLms(
  batch: MessageBatchInput,
  content: MessageContent,
  config: PopbillConfig,
  options: SubmitOptions,
): Promise<string> {
  const sender = requirePopbillSender(config, "lms");
  const service = getMessageService(config);
  const subject = content.subject ?? "";
  const messages = batch.recipients.map((r) => ({
    Receiver: r.phone,
    ReceiverName: r.name ?? undefined,
    Subject: subject,
    Contents: r.renderedBody ?? content.body,
    interOPRefKey: r.providerRefKey,
  }));
  return submitWithTimeout<string>((resolve, reject) => {
    service.sendLMS_multi(
      config.corpNum,
      sender,
      subject,
      content.body,
      messages,
      null,
      false,
      batch.requestNum,
      "",
      config.userId ?? "",
      (receiptNum) => resolve(receiptNum),
      (err) => reject(toSubmitError(err)),
    );
  }, options.timeoutMs);
}

async function submitAlimtalk(
  batch: MessageBatchInput,
  content: MessageContent,
  config: PopbillConfig,
  options: SubmitOptions,
): Promise<string> {
  if (!content.templateCode) {
    return Promise.reject(
      new PopbillSubmitError("NO_TEMPLATE_CODE", "알림톡 템플릿 코드가 필요합니다."),
    );
  }
  const sender = requirePopbillSender(config, "alimtalk");
  const service = getKakaoService(config);
  const templateCode = content.templateCode;
  const msgs = batch.recipients.map((r) => ({
    rcv: r.phone,
    rcvnm: r.name ?? undefined,
    msg: r.renderedBody ?? content.body,
    // 대체문자(altSendType/altmsg)는 비활성화한다. 실패 시 ERP가 임의로 SMS를 보내지 않는다.
    altmsg: "",
    interOPRefKey: r.providerRefKey,
    btns: r.buttons ?? content.buttons,
  }));
  // 렌더 후에도 본문이나 버튼 URL에 남은 #{변수}가 있으면 접수 전에 거절한다.
  if (
    msgs.some(
      (m) =>
        hasUnresolvedVariables(m.msg) ||
        (m.btns ?? []).some(
          (button) =>
            (typeof button.u1 === "string" && hasUnresolvedVariables(button.u1)) ||
            (typeof button.u2 === "string" && hasUnresolvedVariables(button.u2)),
        ),
    )
  ) {
    return Promise.reject(
      new PopbillSubmitError("UNRESOLVED_VARIABLES", "알림톡 본문 또는 버튼 URL에 치환되지 않은 변수가 있습니다."),
    );
  }
  const commonButtons = batch.recipients.some((recipient) => recipient.buttons !== undefined)
    ? null
    : (content.buttons ?? null);
  if (!(await checkSenderRegistered("alimtalk", sender, config))) {
    throw new PopbillSubmitError("SENDER_NOT_REGISTERED", "알림톡 발신번호가 등록되어 있지 않습니다.");
  }
  return submitWithTimeout<string>((resolve, reject) => {
    service.sendATS_multi(
      config.corpNum,
      templateCode,
      sender,
      "",
      null,
      msgs,
      config.userId ?? "",
      batch.requestNum,
      commonButtons,
      (receiptNum) => resolve(receiptNum),
      (err) => reject(toSubmitError(err)),
    );
  }, options.timeoutMs);
}
