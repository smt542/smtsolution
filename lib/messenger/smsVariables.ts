import type { MessageRecipient } from "@/lib/messaging/preset";
import { buildRecipientRenderVariables } from "@/lib/messaging/preset";
import { renderTemplate } from "@/lib/messaging/render";

/**
 * 문자 템플릿(0311 기본 10종 등) 변수 — 수신자별 자동 치환 값.
 * 원본 Messenger.dc.html: TVARS = 건물명·입주자명·호실·건물주명·청소담당자명, 미리보기는 선택 수신자 값, 없으면 예시 값.
 */
export const SMS_PREVIEW_SAMPLE: Record<string, string> = {
  건물명: "그린빌라",
  입주자명: "김민준",
  호실: "101호",
  호수: "101호",
  건물주명: "홍길동",
  청소담당자명: "문청소",
};

export interface SmsVariableBuilding {
  name: string;
  ownerName: string | null;
  /** 건물 청소 담당자 이름(배정·조회된 경우) */
  cleanerName?: string | null;
}

/**
 * 수신자 건물 정보로 채우는 변수. 건물주·청소 담당 수신자는 본인 이름이 그 변수이고(buildRecipientRenderVariables),
 * 입주자 등 다른 수신자에게는 건물의 건물주·청소 담당자 이름을 넣는다.
 */
export function smsBuildingVariables(
  recipient: Pick<MessageRecipient, "kind">,
  building: SmsVariableBuilding | undefined,
): Record<string, string> {
  if (!building) return {};
  return {
    건물명: building.name,
    ...(recipient.kind !== "owner" && building.ownerName ? { 건물주명: building.ownerName } : {}),
    ...(recipient.kind !== "cleaner" && building.cleanerName ? { 청소담당자명: building.cleanerName } : {}),
  };
}

/** 미리보기 본문: 첫 수신자 값으로 치환하고, 비어 있는 변수는 예시 값으로 보여 준다. */
export function smsPreviewBody(body: string, recipient: MessageRecipient | undefined): string {
  const actual = recipient
    ? buildRecipientRenderVariables(recipient, undefined, recipient.variables?.건물명)
    : {};
  const merged: Record<string, string> = { ...SMS_PREVIEW_SAMPLE };
  for (const [key, value] of Object.entries(actual)) {
    if (value.trim()) merged[key] = value;
  }
  return renderTemplate(body, merged);
}
