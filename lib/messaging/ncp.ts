import { createHmac } from "node:crypto";

/**
 * NCP(Naver Cloud Platform) SENS SMS 실발송 어댑터 — **서버 전용**.
 *
 * ⚠️ 이 모듈은 자격증명(NCP_SENS_* env)이 있을 때만 실제 발송한다. 없으면 isNcpConfigured()가
 * false를 반환하고, 호출부는 반드시 이 게이트로 stub 유지 여부를 판단해야 한다. (실발송 = Track E)
 *
 * 활성화(잔여): message_schedules 소비 worker 또는 서비스롤 API 라우트가 이 어댑터를 호출하고,
 * 0037 reserve_message_points/settle_message_points 로 포인트를 예약·정산하도록 배선한다.
 * 필요한 env(.env.local): NCP_SENS_ACCESS_KEY, NCP_SENS_SECRET_KEY, NCP_SENS_SERVICE_ID,
 * NCP_SENS_CALLER_NUMBER, (선택)NCP_SENS_API_ENDPOINT.
 */
export interface NcpSensConfig {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  callerNumber: string;
  endpoint: string;
}

export function getNcpConfig(): NcpSensConfig | null {
  const accessKey = process.env.NCP_SENS_ACCESS_KEY;
  const secretKey = process.env.NCP_SENS_SECRET_KEY;
  const serviceId = process.env.NCP_SENS_SERVICE_ID;
  const callerNumber = process.env.NCP_SENS_CALLER_NUMBER;
  if (!accessKey || !secretKey || !serviceId || !callerNumber) return null;
  return {
    accessKey,
    secretKey,
    serviceId,
    callerNumber,
    endpoint: process.env.NCP_SENS_API_ENDPOINT ?? "https://sens.apigw.ntruss.com",
  };
}

/** 실발송 가능 여부(자격증명 존재). false면 호출부는 stub를 유지해야 한다. */
export function isNcpConfigured(): boolean {
  return getNcpConfig() !== null;
}

/**
 * NCP API Gateway signature v2:
 * base64(HMAC-SHA256(secretKey, `${method} ${uri}\n${timestamp}\n${accessKey}`)).
 */
export function makeNcpSignature(params: {
  method: string;
  uri: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
}): string {
  const { method, uri, timestamp, accessKey, secretKey } = params;
  const message = `${method} ${uri}\n${timestamp}\n${accessKey}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export interface NcpSmsResult {
  requestId: string | null;
  statusCode: string | null;
  ok: boolean;
}

/**
 * NCP SENS SMS/LMS 단건 실발송. 자격증명 미설정이면 예외를 던진다(실발송 방지 게이팅).
 * 호출부는 반드시 isNcpConfigured()로 먼저 확인할 것.
 */
export async function sendSmsViaNcp(input: {
  to: string;
  content: string;
  subject?: string;
}): Promise<NcpSmsResult> {
  const config = getNcpConfig();
  if (!config) {
    throw new Error("NCP SENS 미설정: NCP_SENS_* 환경변수가 필요합니다.");
  }

  const uri = `/sms/v2/services/${config.serviceId}/messages`;
  const timestamp = String(Date.now());
  const signature = makeNcpSignature({
    method: "POST",
    uri,
    timestamp,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  // 45자 초과 또는 제목 있으면 LMS.
  const isLong = [...input.content].length > 45 || Boolean(input.subject);
  const body: Record<string, unknown> = {
    type: isLong ? "LMS" : "SMS",
    contentType: "COMM",
    countryCode: "82",
    from: config.callerNumber,
    content: input.content,
    messages: [{ to: input.to.replace(/[^0-9]/g, "") }],
  };
  if (input.subject) body.subject = input.subject;

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
