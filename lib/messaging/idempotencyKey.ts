/**
 * 발송 멱등 키 관리(공급자 중립, 순수 함수).
 *
 * 한 논리적 발송 시도는 하나의 키를 가진다. 같은 초안(서명 동일)에서의 중복 클릭·재시도는 같은 키를
 * 재사용해 서버(reserve_message_points)가 replay로 판정하게 하고, 초안이 실질적으로 바뀌면(서명 변경)
 * 새 키로 회전한다. 성공 후 회전은 호출부가 이전 값을 null로 비우는 방식으로 처리한다.
 */

export interface IdempotencyState {
  signature: string;
  key: string;
}

/**
 * @param prev      직전 상태(없으면 null)
 * @param signature 현재 초안의 실질 필드로 만든 서명 문자열
 * @param generate  새 UUID 생성기(테스트 주입 가능)
 */
export function resolveIdempotencyKey(
  prev: IdempotencyState | null,
  signature: string,
  generate: () => string,
): IdempotencyState {
  if (prev && prev.signature === signature) {
    return prev;
  }
  return { signature, key: generate() };
}

/** 표준 UUID(v4) 생성. crypto.randomUUID가 없으면 getRandomValues로 대체한다(브라우저·jsdom 안전). */
export function newUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}` +
    `-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  );
}
