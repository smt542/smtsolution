import { hasUnresolvedVariables } from "@/lib/messaging/render";
import type { PopbillError, PopbillKakaoButton } from "popbill";
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

/** 대체문자 LMS 제목 기본값(알림톡 제목이 없을 때). 90byte 초과 대체문자에만 적용된다. */
const ALT_DEFAULT_SUBJECT = "안내";

/** 팝빌 대체문자 한도(byte). 문자 규격(EUC-KR)처럼 한글 등 비ASCII는 2byte로 센다. */
const ALT_CONTENT_MAX_BYTES = 2000;
const ALT_SUBJECT_MAX_BYTES = 64;

export function altByteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.codePointAt(0)! > 0x7f ? 2 : 1;
  return n;
}

export function truncateAltBytes(text: string, max: number): string {
  let n = 0;
  let out = "";
  for (const ch of text) {
    const w = ch.codePointAt(0)! > 0x7f ? 2 : 1;
    if (n + w > max) break;
    n += w;
    out += ch;
  }
  return out;
}

/**
 * 대체문자 본문: 알림톡 본문 + 버튼 링크(URL). 팝빌은 대체문자에 버튼 링크를 싣지 않으므로
 * (altSendType "A"에서만 링크를 직접 작성 가능) 웹링크 버튼의 URL을 본문 끝에 텍스트로 붙인다.
 */
export function buildAltMessage(body: string, buttons?: PopbillKakaoButton[] | null): string {
  const urls: string[] = [];
  for (const b of buttons ?? []) {
    const url = (b.u1 || b.u2 || "").trim();
    if (url && !body.includes(url) && !urls.includes(url)) urls.push(url);
  }
  return urls.length > 0 ? `${body}\n\n${urls.join("\n")}` : body;
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
    // 대체문자(altSendType "A"): 알림톡이 실패하면 같은 내용(+버튼 링크 URL)을 팝빌이 문자로 대신 보낸다.
    // 문자 발신번호가 팝빌에 등록되어 있지 않으면 아래에서 altSendType을 비워 기존처럼 알림톡만 접수한다.
    altmsg: buildAltMessage(r.renderedBody ?? content.body, r.buttons ?? content.buttons),
    altsjt: truncateAltBytes(content.subject?.trim() || ALT_DEFAULT_SUBJECT, ALT_SUBJECT_MAX_BYTES),
    interOPRefKey: r.providerRefKey,
    btns: r.buttons ?? content.buttons,
    // 강조표기형 템플릿만 타이틀을 싣는다(아래 sendATS_multi 가 내부에서 sendATS_same 을 호출하며 msgs[].emphasizeTitle 을
    // 그대로 직렬화 — popbill KakaoService.js). 그 외 발송은 필드 자체를 넣지 않는다.
    ...(content.emphasizeTitle ? { emphasizeTitle: content.emphasizeTitle } : {}),
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
  // 대체문자는 알림톡 발신번호가 문자 발신번호로도 등록돼 있어야 나간다. 미등록이면 대체문자 없이 접수한다.
  const altSendType = (await checkSenderRegistered("sms", sender, config)) ? "A" : "";
  if (altSendType === "") {
    console.warn("[popbill] 알림톡 발신번호가 문자 발신번호로 등록되어 있지 않아 대체문자 없이 접수합니다.");
    for (const m of msgs) {
      m.altmsg = "";
      m.altsjt = "";
    }
  }
  // 2000byte를 넘는 대체문자는 팝빌이 거절하므로 그 수신자만 대체문자를 끈다(알림톡 접수는 유지).
  for (const m of msgs) {
    if (altByteLength(m.altmsg) > ALT_CONTENT_MAX_BYTES) {
      m.altmsg = "";
      m.altsjt = "";
    }
  }
  return submitWithTimeout<string>((resolve, reject) => {
    service.sendATS_multi(
      config.corpNum,
      templateCode,
      sender,
      altSendType,
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
