// Edge Function(Deno)용 lib/popbill/sdk.ts 대체 구현.
//
// 팝빌 공식 npm SDK는 자기 자신을 file: 의존성으로 걸어 Supabase Edge 번들이 불가하다.
// scripts/build-edge-app.mjs가 이 파일을 _shared/app/lib/popbill/sdk.ts 자리에 복사해,
// 앱의 발송·재조회 코드(lib/messaging/*, lib/popbill/*)가 그대로 이 구현을 쓰게 한다.
// 공식 SDK(BaseService·MessageService·KakaoService·FaxService·linkhub TokenBuilder)와 같은
// REST 계약(Linkhub HMAC 토큰 → JSON API)을 fetch·WebCrypto로 호출한다. 콜백 시그니처도 SDK와 같다.
// 이 저장소가 Edge에서 쓰는 메서드만 구현한다(나머지는 호출 시 오류 콜백).
import type { PopbillConfig } from "./config";

type Err = { code: number; message: string };
type ErrCb = (error: Err) => void;
type Kind = "message" | "kakao" | "fax";

const SCOPES: Record<Kind, string[]> = {
  message: ["member", "150", "151", "152"],
  kakao: ["member", "153", "154", "155", "156", "157", "158"],
  fax: ["member", "160", "161"],
};

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** SDK _stringify: null·""·undefined 값은 직렬화에서 뺀다. */
function stringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    value === null || value === "" || value === undefined ? undefined : value,
  );
}

async function issueToken(config: PopbillConfig, kind: Kind): Promise<string> {
  const cacheKey = `${config.isTest ? "T" : "P"}:${config.corpNum}:${kind}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const serviceId = config.isTest ? "POPBILL_TEST" : "POPBILL";
  const forwardIp = config.ipRestrictOn ? null : "*";
  const uri = `/${serviceId}/Token`;
  const body = JSON.stringify({ access_id: config.corpNum, scope: SCOPES[kind] });
  const xDate = new Date().toISOString();
  const bodyDigest = b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const target = `POST\n${bodyDigest}\n${xDate}\n${forwardIp ? `${forwardIp}\n` : ""}2.0\n${uri}`;
  const keyBytes = Uint8Array.from(atob(config.secretKey), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(target)));
  const headers: Record<string, string> = {
    "x-lh-date": xDate,
    "x-lh-version": "2.0",
    Authorization: `LINKHUB ${config.linkId} ${signature}`,
    "Content-Type": "Application/json",
  };
  if (forwardIp) headers["x-lh-forwarded"] = forwardIp;
  const host = config.useStaticIp ? "static-auth.linkhub.co.kr" : "auth.linkhub.co.kr";
  const res = await fetch(`https://${host}${uri}`, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.session_token) {
    throw { code: Number(data?.code ?? -99999999), message: String(data?.message ?? "token issue failed") };
  }
  const expiresAt = Date.parse(data.expiration ?? "") || Date.now() + 10 * 60_000;
  tokenCache.set(cacheKey, { token: data.session_token, expiresAt });
  return data.session_token;
}

function call<T>(
  config: PopbillConfig,
  kind: Kind,
  method: "GET" | "POST",
  uri: string,
  userId: string | undefined,
  body: unknown,
  pick: (response: any) => T, // eslint-disable-line @typescript-eslint/no-explicit-any
  success: ((value: T) => void) | undefined,
  error: ErrCb | undefined,
): void {
  (async () => {
    const host = config.useStaticIp
      ? config.isTest ? "static-popbill-test.linkhub.co.kr" : "static-popbill.linkhub.co.kr"
      : config.isTest ? "popbill-test.linkhub.co.kr" : "popbill.linkhub.co.kr";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await issueToken(config, kind)}`,
      "Content-Type": "application/json;charset=utf-8",
    };
    if (userId) headers["x-pb-userid"] = userId;
    const res = await fetch(`https://${host}${uri}`, {
      method,
      headers,
      body: method === "POST" ? stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw { code: Number(data?.code ?? -99999999), message: String(data?.message ?? `HTTP ${res.status}`) };
    }
    success?.(pick(data));
  })().catch((e) => {
    const err: Err =
      e && typeof e === "object" && "code" in e
        ? { code: Number((e as Err).code), message: String((e as Err).message) }
        : { code: -99999999, message: String((e as Error)?.message ?? e) };
    error?.(err);
  });
}

function unsupported(name: string, error: ErrCb | undefined): void {
  error?.({ code: -99999999, message: `${name} is not supported in the edge runtime` });
}

// deno-lint-ignore no-explicit-any
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const identity = (value: Any) => value;

export function getMessageService(config: PopbillConfig) {
  const send = (type: "SMS" | "LMS") =>
    (corpNum: string, sender: string, subject: string, contents: string, messages: Any[], reserveDT: string | null,
      adsYN: boolean, requestNum: string, senderName: string, userId: string,
      success: (receiptNum: string) => void, error: ErrCb) => {
      const req = {
        snd: sender,
        sndnm: senderName,
        adsYN,
        content: contents,
        subject,
        sndDT: reserveDT,
        requestNum,
        msgs: messages.map((m) => ({
          snd: m.Sender,
          sndnm: m.SenderName,
          rcv: m.Receiver,
          rcvnm: m.ReceiverName,
          msg: m.Contents,
          sjt: m.Subject,
          interOPRefKey: m.interOPRefKey,
        })),
      };
      call(config, "message", "POST", `/${type}`, userId, req, (r) => r.receiptNum, success, error);
    };
  return {
    checkSenderNumber(corpNum: string, senderNumber: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "message", "GET", `/Message/CheckSenderNumber/${senderNumber}`, userId, null, identity, success, error);
    },
    sendSMS_multi(corpNum: string, sender: string, contents: string, messages: Any[], reserveDT: string | null,
      adsYN: boolean, requestNum: string, senderName: string, userId: string,
      success: (receiptNum: string) => void, error: ErrCb) {
      send("SMS")(corpNum, sender, "", contents, messages, reserveDT, adsYN, requestNum, senderName, userId, success, error);
    },
    sendLMS_multi(corpNum: string, sender: string, subject: string, contents: string, messages: Any[], reserveDT: string | null,
      adsYN: boolean, requestNum: string, senderName: string, userId: string,
      success: (receiptNum: string) => void, error: ErrCb) {
      send("LMS")(corpNum, sender, subject, contents, messages, reserveDT, adsYN, requestNum, senderName, userId, success, error);
    },
    getMessages(corpNum: string, receiptNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "message", "GET", `/Message/${receiptNum}`, userId, null, identity, success, error);
    },
    getMessagesRN(corpNum: string, requestNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "message", "GET", `/Message/Get/${requestNum}`, userId, null, identity, success, error);
    },
  };
}

export function getKakaoService(config: PopbillConfig) {
  return {
    checkSenderNumber(corpNum: string, senderNumber: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "kakao", "GET", `/KakaoTalk/CheckSenderNumber/${senderNumber}`, userId, null, identity, success, error);
    },
    sendATS_multi(corpNum: string, templateCode: string, sender: string, altSendType: string, sndDT: string | null,
      msgs: Any[], userId: string, requestNum: string, btns: Any[] | null,
      success: (receiptNum: string) => void, error: ErrCb) {
      const req = {
        templateCode,
        snd: sender,
        altSendType,
        sndDT,
        requestNum,
        msgs: msgs.map((m) => ({
          rcv: m.rcv,
          rcvnm: m.rcvnm,
          msg: m.msg,
          altsjt: m.altsjt,
          altmsg: m.altmsg,
          interOPRefKey: m.interOPRefKey,
          btns: m.btns,
          emphasizeTitle: m.emphasizeTitle,
        })),
        btns: (btns ?? []).map((b) => ({ t: b.t, n: b.n, u1: b.u1, u2: b.u2, tg: b.tg, telNum: b.telNum })),
      };
      call(config, "kakao", "POST", "/ATS", userId, req, (r) => r.receiptNum, success, error);
    },
    getMessages(corpNum: string, receiptNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "kakao", "GET", `/KakaoTalk/${receiptNum}`, userId, null, identity, success, error);
    },
    getMessagesRN(corpNum: string, requestNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "kakao", "GET", `/KakaoTalk/Get/${requestNum}`, userId, null, identity, success, error);
    },
    listATSTemplate(_corpNum: string, _userId: string, _success: unknown, error: ErrCb) {
      unsupported("listATSTemplate", error);
    },
    getATSTemplateMgtURL(_corpNum: string, _userId: string, _success: unknown, error: ErrCb) {
      unsupported("getATSTemplateMgtURL", error);
    },
    getPlusFriendMgtURL(_corpNum: string, _userId: string, _success: unknown, error: ErrCb) {
      unsupported("getPlusFriendMgtURL", error);
    },
  };
}

export function getFaxService(config: PopbillConfig) {
  return {
    checkSenderNumber(corpNum: string, senderNumber: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "fax", "GET", `/FAX/CheckSenderNumber/${senderNumber}`, userId, null, identity, success, error);
    },
    getFaxResult(corpNum: string, receiptNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "fax", "GET", `/FAX/${receiptNum}`, userId, null, identity, success, error);
    },
    getFaxResultRN(corpNum: string, requestNum: string, userId: string, success: (r: Any) => void, error: ErrCb) {
      call(config, "fax", "GET", `/FAX/Get/${requestNum}`, userId, null, identity, success, error);
    },
    sendFaxBinary(_corpNum: string, _options: unknown, _success: unknown, error: ErrCb) {
      unsupported("sendFaxBinary", error);
    },
  };
}
