export interface SenderDefaults {
  smsSender: string | null;
  faxSender: string | null;
}

export async function getSenderDefaults(): Promise<SenderDefaults> {
  const res = await fetch("/api/messaging/sender-defaults");
  const data = (await res.json().catch(() => null)) as (Partial<SenderDefaults> & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? "기본 발신번호를 불러오지 못했습니다.");
  return { smsSender: data?.smsSender ?? null, faxSender: data?.faxSender ?? null };
}
