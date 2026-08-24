import { createHash } from "node:crypto";

/**
 * 제품별 배치 조립 — 공급자 중립.
 *
 * 수신자를 제품(sms/lms/alimtalk)별로 묶고 1,000명씩 청크로 나눈다. 각 청크는 독립 job으로 저장할 수
 * 있도록 결정적 requestNum(<=36자)과 수신자별 provider ref(<=20자, 영숫자)를 부여한다.
 * 결정적이므로 같은 입력의 재시도는 같은 키를 만들어 중복 접수를 막는다.
 */

export type PlanProduct = "sms" | "lms" | "alimtalk";

export interface PlanRecipient {
  recipientKey: string;
  phone: string;
  name?: string | null;
  product: PlanProduct;
}

export interface SubmissionBatch {
  product: PlanProduct;
  chunkIndex: number;
  requestNum: string;
  recipients: Array<{
    recipientKey: string;
    providerRefKey: string;
    phone: string;
    name: string | null;
  }>;
}

const CHUNK_SIZE = 1000;
const PRODUCT_ORDER: PlanProduct[] = ["sms", "lms", "alimtalk"];

/** 배치 내 인덱스 + 수신자 키로 결정적인 20자 이하 영숫자 ref를 만든다. */
export function makeProviderRef(index: number, recipientKey: string): string {
  const hash = createHash("sha1").update(recipientKey).digest("hex").slice(0, 12);
  return `r${index}x${hash}`.slice(0, 20);
}

/** scope+id+청크로 결정적인 36자 이하 요청번호를 만든다. 재시도 중복 접수 방지 기준 키. */
export function makeRequestNum(scope: string, id: number, chunkIndex: number): string {
  const value = `${scope}${id}c${chunkIndex}`;
  if (value.length > 36) {
    throw new Error(`requestNum exceeds 36 chars: ${value}`);
  }
  return value;
}

function assertNoRefCollisions(refs: string[]): void {
  if (new Set(refs).size !== refs.length) {
    throw new Error("provider ref collision within batch");
  }
}

export function buildSubmissionPlan(params: {
  scope: string;
  id: number;
  recipients: PlanRecipient[];
  chunkSize?: number;
}): SubmissionBatch[] {
  const chunkSize = params.chunkSize ?? CHUNK_SIZE;
  const batches: SubmissionBatch[] = [];
  let chunkIndex = 0;

  for (const product of PRODUCT_ORDER) {
    const group = params.recipients.filter((r) => r.product === product);
    for (let start = 0; start < group.length; start += chunkSize) {
      const slice = group.slice(start, start + chunkSize);
      const recipients = slice.map((r, indexInChunk) => ({
        recipientKey: r.recipientKey,
        providerRefKey: makeProviderRef(indexInChunk, r.recipientKey),
        phone: r.phone,
        name: r.name ?? null,
      }));
      assertNoRefCollisions(recipients.map((r) => r.providerRefKey));
      batches.push({
        product,
        chunkIndex,
        requestNum: makeRequestNum(params.scope, params.id, chunkIndex),
        recipients,
      });
      chunkIndex += 1;
    }
  }

  return batches;
}
