import { type SendMode, type MessageChannel } from "./preset";
import { isNcpConfigured, sendSmsViaNcp } from "./ncp";
import { isAlimtalkConfigured, sendAlimtalkViaNcp, type AlimtalkButton } from "./alimtalk";

export interface DispatchResult {
  status: "success" | "failed";
  reason?: string;
  providerId?: string;
}

/** 실경로 진입 판단: 요청 채널(mode)에 해당하는 어댑터가 하나라도 설정됐는가. */
export function anyChannelConfigured(mode: SendMode): boolean {
  if (mode === "sms") return isNcpConfigured();
  if (mode === "alimtalk") return isAlimtalkConfigured();
  return isNcpConfigured() || isAlimtalkConfigured(); // auto
}

/** 수신자 1건을 해석된 채널로 실발송. 미설정 채널은 failed(unconfigured)로 스킵(실호출 없음). */
export async function dispatchOne(input: {
  channel: MessageChannel;
  phone: string;
  body: string;
  templateCode?: string | null;
  buttons?: AlimtalkButton[];
}): Promise<DispatchResult> {
  try {
    if (input.channel === "sms") {
      if (!isNcpConfigured()) return { status: "failed", reason: "unconfigured" };
      const r = await sendSmsViaNcp({ to: input.phone, content: input.body });
      return r.ok
        ? { status: "success", providerId: r.requestId ?? undefined }
        : { status: "failed", reason: `sms_${r.statusCode ?? "error"}` };
    }
    // alimtalk
    if (!isAlimtalkConfigured()) return { status: "failed", reason: "unconfigured" };
    if (!input.templateCode) return { status: "failed", reason: "no_template_code" };
    const r = await sendAlimtalkViaNcp({
      to: input.phone,
      templateCode: input.templateCode,
      content: input.body,
      buttons: input.buttons,
    });
    return r.ok
      ? { status: "success", providerId: r.requestId ?? undefined }
      : { status: "failed", reason: `alimtalk_${r.statusCode ?? "error"}` };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}
