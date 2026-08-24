/**
 * Popbill 공통 설정 — **서버 전용**.
 *
 * 모든 비밀값은 `POPBILL_*` 서버 환경변수로만 읽는다. `NEXT_PUBLIC_` 접두사 금지.
 * 필수 설정이 없으면 PopbillNotConfiguredError(code=PROVIDER_NOT_CONFIGURED)를 던진다.
 * 오류 메시지·로그에 비밀값을 포함하지 않는다.
 */

export type PopbillConfig = {
  linkId: string;
  secretKey: string;
  corpNum: string;
  userId?: string;
  isTest: boolean;
  ipRestrictOn: boolean;
  useStaticIp: boolean;
  useLocalTime: boolean;
  smsSender: string;
  kakaoSender: string;
  faxSender: string;
};

export type PopbillSenderProduct = "sms" | "lms" | "alimtalk" | "fax";

/** 설정 누락을 나타내는 오류. 비밀값을 담지 않는다. */
export class PopbillNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED" as const;
  constructor(message = "Popbill 발송 설정이 없습니다.") {
    super(message);
    this.name = "PopbillNotConfiguredError";
  }
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on", "y"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", "n", ""]);

/** "true"/"1"/"yes"/"on"/"y"(대소문자·공백 무시)를 true로, 그 반대를 false로 파싱한다. */
export function parsePopbillBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return fallback;
}

type Env = Record<string, string | undefined>;

/**
 * 서버 환경변수에서 Popbill 설정을 읽는다. 필수(linkId/secretKey/corpNum)가 없으면 던진다.
 * IS_TEST 기본값은 true(테스트 모드)로 안전측에 둔다. 운영은 POPBILL_IS_TEST=false로 명시한다.
 */
export function readPopbillConfig(env: Env = process.env): PopbillConfig {
  const linkId = (env.POPBILL_LINK_ID ?? "").trim();
  const secretKey = (env.POPBILL_SECRET_KEY ?? "").trim();
  const corpNum = (env.POPBILL_CORP_NUM ?? "").replace(/[^0-9]/g, "");
  if (!linkId || !secretKey || !corpNum) {
    throw new PopbillNotConfiguredError();
  }
  return {
    linkId,
    secretKey,
    corpNum,
    userId: (env.POPBILL_USER_ID ?? "").trim() || undefined,
    isTest: parsePopbillBoolean(env.POPBILL_IS_TEST, true),
    ipRestrictOn: parsePopbillBoolean(env.POPBILL_IP_RESTRICT_ON, true),
    useStaticIp: parsePopbillBoolean(env.POPBILL_USE_STATIC_IP, false),
    useLocalTime: parsePopbillBoolean(env.POPBILL_USE_LOCAL_TIME, true),
    smsSender: (env.POPBILL_SMS_SENDER ?? "").replace(/[^0-9]/g, ""),
    kakaoSender: (env.POPBILL_KAKAO_SENDER ?? "").trim(),
    faxSender: (env.POPBILL_FAX_SENDER ?? "").replace(/[^0-9]/g, ""),
  };
}

/** 실제 발송 경로 진입 전 설정 유무만 확인한다(예외 없이 boolean). */
export function isPopbillConfigured(env: Env = process.env): boolean {
  try {
    readPopbillConfig(env);
    return true;
  } catch {
    return false;
  }
}

/** 제품별 등록 발신번호(또는 카카오 채널)를 반환한다. 없으면 던진다. */
export function requirePopbillSender(config: PopbillConfig, product: PopbillSenderProduct): string {
  const sender =
    product === "alimtalk"
      ? config.kakaoSender
      : product === "fax"
        ? config.faxSender
        : config.smsSender;
  if (!sender) {
    throw new PopbillNotConfiguredError(`Popbill ${product} 발신 설정이 없습니다.`);
  }
  return sender;
}
