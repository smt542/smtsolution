import { makeNcpSignature, type NcpSmsResult } from "./ncp";

/**
 * NCP SENS 알림톡(AlimTalk) 실발송 어댑터 — **서버 전용**.
 *
 * ⚠️ SMS와 동일하게 자격증명이 있을 때만 실발송한다. 없으면 isAlimtalkConfigured()가 false를 반환하고
 * 호출부(dispatch)는 미설정 채널로 취급한다. 실발송은 추가로 **카카오 발신프로필·템플릿 사전등록(카카오 심사)**이
 * 있어야 실제로 나간다. 필요한 env: NCP_SENS_ACCESS_KEY, NCP_SENS_SECRET_KEY,
 * NCP_ALIMTALK_SERVICE_ID, NCP_ALIMTALK_CHANNEL_ID(plusFriendId), (선택)NCP_SENS_API_ENDPOINT.
 */
export interface NcpAlimtalkConfig {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  channelId: string;
  endpoint: string;
}

export function getAlimtalkConfig(): NcpAlimtalkConfig | null {
  const accessKey = process.env.NCP_SENS_ACCESS_KEY;
  const secretKey = process.env.NCP_SENS_SECRET_KEY;
  const serviceId = process.env.NCP_ALIMTALK_SERVICE_ID;
  const channelId = process.env.NCP_ALIMTALK_CHANNEL_ID;
  if (!accessKey || !secretKey || !serviceId || !channelId) return null;
  return {
    accessKey,
    secretKey,
    serviceId,
    channelId,
    endpoint: process.env.NCP_SENS_API_ENDPOINT ?? "https://sens.apigw.ntruss.com",
  };
}

/** 실발송 가능 여부(자격증명 존재). false면 dispatch는 미설정 채널로 처리한다. */
export function isAlimtalkConfigured(): boolean {
  return getAlimtalkConfig() !== null;
}

export interface AlimtalkButton {
  name: string;
  /** NCP 버튼 타입: WL(웹링크)·AL(앱링크)·DS(배송조회)·BK(봇키워드)·MD(메시지전달) 등 */
  type: string;
  url?: string;
}

/**
 * NCP SENS 알림톡 단건 실발송. 자격증명 미설정이면 예외(실발송 방지). 호출부는 isAlimtalkConfigured()로 먼저 확인.
 */
export async function sendAlimtalkViaNcp(input: {
  to: string;
  templateCode: string;
  content: string;
  buttons?: AlimtalkButton[];
}): Promise<NcpSmsResult> {
  const config = getAlimtalkConfig();
  if (!config) {
    throw new Error("알림톡 미설정: NCP_SENS_*/NCP_ALIMTALK_* 환경변수가 필요합니다.");
  }

  const uri = `/alimtalk/v2/services/${config.serviceId}/messages`;
  const timestamp = String(Date.now());
  const signature = makeNcpSignature({
    method: "POST",
    uri,
    timestamp,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  const message: Record<string, unknown> = {
    to: input.to.replace(/[^0-9]/g, ""),
    content: input.content,
  };
  if (input.buttons && input.buttons.length > 0) {
    message.buttons = input.buttons.map((b) => ({
      type: b.type,
      name: b.name,
      ...(b.url ? { linkMobile: b.url, linkPc: b.url } : {}),
    }));
  }

  const body = {
    plusFriendId: config.channelId,
    templateCode: input.templateCode,
    messages: [message],
  };

  const res = await fetch(`${config.endpoint}${uri}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": config.accessKey,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | { requestId?: string; statusCode?: string }
    | null;
  return {
    requestId: data?.requestId ?? null,
    statusCode: data?.statusCode ?? null,
    ok: res.ok && (res.status === 202 || data?.statusCode === "202"),
  };
}
