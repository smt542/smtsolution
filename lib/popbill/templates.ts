import type { PopbillATSTemplate, PopbillError } from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";
import { getKakaoService } from "./sdk";
import { PopbillSubmitError, submitWithTimeout } from "./types";

/**
 * 팝빌 알림톡 템플릿 조회·콘솔 딥링크 어댑터 — **서버 전용**.
 *
 * 팝빌 SDK엔 템플릿 "등록" API가 없다. 등록·심사는 팝빌/카카오 콘솔에서 하고,
 * 여기서는 승인된 템플릿을 조회(listATSTemplate)하거나 콘솔 관리 URL을 받는다.
 */

export interface AlimtalkTemplate {
  templateCode: string;
  name: string;
  body: string;
  /** 팝빌 원문 형식({t,n,u1,u2}) 그대로 — message_templates.buttons 에 이 형식으로 저장한다(toPopbillButtons 가 그대로 받는다). */
  buttons: Array<{ t: string; n: string; u1?: string; u2?: string }>;
  /** 강조표기 타이틀(강조표기형 템플릿만). 없으면 null. */
  emphasizeTitle: string | null;
  approved: boolean;
  stateName: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeButton(raw: Record<string, unknown>): { t: string; n: string; u1?: string; u2?: string } {
  const n = str(raw.n ?? raw.name);
  const t = str(raw.t ?? raw.type) || "WL";
  const u1 = str(raw.u1 ?? raw.url) || undefined;
  // 웹링크(WL)·앱링크(AL)는 u1·u2 가 모두 필요하다(팝빌 SendATS). 승인본의 u2 를 그대로 보존한다.
  const u2 = str(raw.u2) || undefined;
  return { t, n, ...(u1 ? { u1 } : {}), ...(u2 ? { u2 } : {}) };
}

function normalize(raw: PopbillATSTemplate): AlimtalkTemplate {
  const record = raw as unknown as Record<string, unknown>;
  // 팝빌 ListATSTemplate 응답은 상태를 `state`("3" = 승인), 버튼을 `btns` 로 준다(문서 기준).
  // 예전 필드명(stateName·buttons)도 받아 둔다.
  const state = str(record.state);
  const stateName = str(raw.stateName) || (state === "3" ? "승인" : state);
  const rawButtons = Array.isArray(record.btns) ? record.btns : Array.isArray(raw.buttons) ? raw.buttons : [];
  return {
    templateCode: str(raw.templateCode).trim(),
    name: str(raw.templateName).trim(),
    body: str(raw.template),
    buttons: rawButtons.map((b) => normalizeButton(b as unknown as Record<string, unknown>)),
    emphasizeTitle: str(record.emphasizeTitle).trim() || null,
    approved: state === "3" || (/승인/.test(stateName) && !/미승인|반려/.test(stateName)),
    stateName,
  };
}

function toError(err: PopbillError | undefined): PopbillSubmitError {
  const code = err?.code == null ? "PROVIDER_ERROR" : String(err.code);
  return new PopbillSubmitError(code, err?.message ?? "팝빌 조회 오류");
}

/** 팝빌에 등록된 알림톡 템플릿을 조회해 정규화한다(코드 없는 항목 제외). */
export async function listAlimtalkTemplates(
  config: PopbillConfig = readPopbillConfig(),
  timeoutMs?: number,
): Promise<AlimtalkTemplate[]> {
  const service = getKakaoService(config);
  const raw = await submitWithTimeout<PopbillATSTemplate[]>((resolve, reject) => {
    service.listATSTemplate(
      config.corpNum,
      config.userId ?? "",
      (list) => resolve(Array.isArray(list) ? list : []),
      (err) => reject(toError(err)),
    );
  }, timeoutMs);
  return raw.map(normalize).filter((t) => t.templateCode !== "");
}

/** 팝빌 알림톡 템플릿 관리 콘솔 URL(일회성 로그인 URL). */
export async function getTemplateConsoleUrl(
  config: PopbillConfig = readPopbillConfig(),
  timeoutMs?: number,
): Promise<string> {
  const service = getKakaoService(config);
  return submitWithTimeout<string>((resolve, reject) => {
    service.getATSTemplateMgtURL(
      config.corpNum,
      config.userId ?? "",
      (url) => resolve(str(url)),
      (err) => reject(toError(err)),
    );
  }, timeoutMs);
}

/** 팝빌 카카오 채널(발신프로필) 관리 콘솔 URL(일회성 로그인 URL). */
export async function getChannelConsoleUrl(
  config: PopbillConfig = readPopbillConfig(),
  timeoutMs?: number,
): Promise<string> {
  const service = getKakaoService(config);
  return submitWithTimeout<string>((resolve, reject) => {
    service.getPlusFriendMgtURL(
      config.corpNum,
      config.userId ?? "",
      (url) => resolve(str(url)),
      (err) => reject(toError(err)),
    );
  }, timeoutMs);
}
