import type { MessageRecipient } from "./preset";

/** 수신자 칸을 미리 고를 값 — 정본 `__fmpPrefill`(입주자 > 건물 > 호수). */
export interface RecipientCascadePreset {
  type: "tenant";
  buildingId: number;
  unitIds: number[];
}

/**
 * 화면에서 공용 메신저 FAB 패널을 열고 수신자·본문을 밀어 넣는 통로.
 *
 * 정본(`overdue-management.dc.html` 의 `#ovDunSend`)이 `document.__dunTargets` 에 대상을
 * 담고 `erp:dun` 커스텀 이벤트를 쏜 뒤 FAB 을 여는 것과 같은 구조다. FAB 은 `AppShell` 에
 * 한 번만 마운트돼 화면 컴포넌트와 부모-자식 관계가 없으므로, props 대신 이벤트로 잇는다.
 *
 * 모듈 전역 변수에 콜백을 두는 방식은 개발 중 fast refresh 로 리스너가 낡을 수 있어
 * `window` 이벤트를 쓴다.
 */
export interface MessengerHandoff {
  /** 바로 넣을 수신자. `cascade` 를 주면 쓰지 않고, 수신자 칸에서 고른 값이 수신자가 된다. */
  recipients?: MessageRecipient[];
  /** 본문 초안. `#{키}` 변수는 수신자별로 렌더된다. */
  body?: string;
  channel?: "sms" | "alim";
  /** 수신자 칸을 이 값으로 고른 채 연다. */
  cascade?: RecipientCascadePreset;
}

const HANDOFF_EVENT = "erp:messenger-handoff";

/** 패널을 열고 수신자·본문을 채운다. 브라우저에서만 동작한다. */
export function openMessengerWith(handoff: MessengerHandoff): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MessengerHandoff>(HANDOFF_EVENT, { detail: handoff }));
}

/** FAB 이 구독한다. 정리 함수를 반환한다. */
export function subscribeMessengerHandoff(
  handle: (handoff: MessengerHandoff) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<MessengerHandoff>).detail;
    if (detail) handle(detail);
  };
  window.addEventListener(HANDOFF_EVENT, listener);
  return () => window.removeEventListener(HANDOFF_EVENT, listener);
}
