// 원본 SMS 변수(TVARS, Messenger.dc.html L825)
export const SMS_VARS = ["건물명", "입주자명", "호실", "건물주명", "청소담당자명"] as const;

export function toRealToken(label: string): string {
  return `#{${label}}`; // 서버 renderTemplate(#{key})와 정합
}

export function insertToken(body: string, caret: number, label: string): { body: string; caret: number } {
  const tok = toRealToken(label);
  const next = body.slice(0, caret) + tok + body.slice(caret);
  return { body: next, caret: caret + tok.length };
}
