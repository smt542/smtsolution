import type { PopbillKakaoButton } from "popbill";

/** 공급자 중립 제품 구분. UI 채널이 아니라 실제 과금 제품이다. */
export type ProviderProduct = "sms" | "lms" | "alimtalk";

/** 한 배치(=하나의 requestNum) 접수 입력. 본문/제목/템플릿은 MessageContent로 분리 전달한다. */
export interface MessageBatchInput {
  product: ProviderProduct;
  requestNum: string;
  recipients: Array<{
    recipientKey: string;
    providerRefKey: string;
    phone: string;
    name?: string | null;
    /** 수신자별 최종 렌더 본문. 없으면 MessageContent.body(공통)로 대체된다. */
    renderedBody?: string | null;
  }>;
}

/** 배치 콘텐츠. body/subject는 공통 기본값이며, 수신자별 본문은 각 recipient.renderedBody가 우선한다. */
export interface MessageContent {
  body: string;
  subject?: string | null;
  templateCode?: string | null;
  buttons?: PopbillKakaoButton[];
}

/** 접수 성공 결과. receiptNum은 "접수됨"을 의미하며 성공 결과가 아니다. */
export interface ProviderSubmission {
  requestNum: string;
  receiptNum: string;
  product: ProviderProduct;
  recipients: Array<{ recipientKey: string; providerRefKey: string }>;
}

/**
 * 정제된 공급자 확정 거절 오류. 비밀키·전체 응답·개인정보를 담지 않는다.
 * SDK 오류 콜백과 로컬 검증(템플릿/변수/설정)은 **확정 실패**를 의미한다(unknown 아님).
 */
export class PopbillSubmitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PopbillSubmitError";
  }
}

/**
 * 접수 응답이 없는(전송/무응답 타임아웃) **불명확** 상태. 확정 실패가 아니다.
 * 접수 여부를 알 수 없으므로 즉시 재발송하지 않고 reconcile_required로 남긴다.
 */
export class PopbillTimeoutError extends Error {
  readonly code = "PROVIDER_TIMEOUT" as const;
  constructor(message = "공급자 접수 응답이 없습니다(타임아웃).") {
    super(message);
    this.name = "PopbillTimeoutError";
  }
}

/** 접수 어댑터 기본 타임아웃(ms). 네트워크 침묵으로 무한 대기하지 않도록 상한을 둔다. */
export const DEFAULT_POPBILL_SUBMIT_TIMEOUT_MS = 30_000;

/**
 * Popbill SDK의 (success, error) 콜백을 Promise로 감싼다.
 *  - bounded timeout으로 응답 없는 호출이 무한 대기하지 않게 한다(타임아웃=PopbillTimeoutError).
 *  - settled 가드로 늦게 도착한 콜백이 이미 정산된 Promise를 이중 정산하지 못하게 한다.
 */
export function submitWithTimeout<T>(
  executor: (resolve: (value: T) => void, reject: (error: unknown) => void) => void,
  timeoutMs: number = DEFAULT_POPBILL_SUBMIT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new PopbillTimeoutError());
    }, timeoutMs);
    const safeResolve = (value: T): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const safeReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    // executor가 동기적으로 throw하면 safeReject로 넘겨 타이머를 정리한다.
    // (Promise 생성자만으로는 reject되지만 setTimeout이 정리되지 않아 누수된다.)
    try {
      executor(safeResolve, safeReject);
    } catch (error) {
      safeReject(error);
    }
  });
}
