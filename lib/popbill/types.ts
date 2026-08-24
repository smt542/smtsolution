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
  }>;
}

/** 배치 공통 콘텐츠. 단일 최종 본문 모델(모든 수신자 동일 본문). */
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

/** 정제된 공급자 오류. 비밀키·전체 응답·개인정보를 담지 않는다. */
export class PopbillSubmitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PopbillSubmitError";
  }
}
