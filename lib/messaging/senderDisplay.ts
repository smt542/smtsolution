/**
 * 화면 표시용 발신번호(숫자). 실제 발송과 같은 순서로 고른다: 조직 번호(setup_config) → 운영사 기본 번호(env).
 * undefined = 아직 모름(조회 중), null = 둘 다 없음.
 */
export type SenderProduct = "sms" | "fax";

type SenderNumbers = { smsSender: string | null; faxSender: string | null };

export function resolveDisplaySender(
  orgConfig: SenderNumbers | null | undefined,
  defaults: SenderNumbers | null | undefined,
  product: SenderProduct,
): string | null | undefined {
  if (orgConfig === undefined) return undefined;
  const own = (product === "fax" ? orgConfig?.faxSender : orgConfig?.smsSender)?.trim();
  if (own) return own;
  if (defaults === undefined) return undefined;
  const fallback = (product === "fax" ? defaults?.faxSender : defaults?.smsSender)?.trim();
  return fallback || null;
}
