import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messageTemplateKeys } from "./keys";

export interface SyncAlimtalkResult {
  synced: number;
  approved: number;
}

export interface PopbillConsoleUrls {
  templateUrl: string;
  channelUrl: string;
}

/** 팝빌 승인 알림톡 템플릿을 우리 DB로 동기화한다. */
export async function syncAlimtalkTemplates(): Promise<SyncAlimtalkResult> {
  const res = await fetch("/api/messaging/templates", { method: "POST" });
  const data = (await res.json().catch(() => null)) as
    | { synced?: number; approved?: number; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(
      data?.error === "PROVIDER_NOT_CONFIGURED"
        ? "팝빌 발송 설정이 없어 동기화할 수 없습니다."
        : data?.error ?? "동기화에 실패했습니다.",
    );
  }
  return { synced: data?.synced ?? 0, approved: data?.approved ?? 0 };
}

/** 팝빌 콘솔(템플릿 관리 · 카카오 채널) 일회성 로그인 URL. 클릭 시점에 조회한다. */
export async function fetchPopbillConsoleUrls(): Promise<PopbillConsoleUrls> {
  const res = await fetch("/api/messaging/templates");
  const data = (await res.json().catch(() => null)) as
    | { templateUrl?: string; channelUrl?: string; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(
      data?.error === "PROVIDER_NOT_CONFIGURED"
        ? "팝빌 발송 설정이 없습니다."
        : data?.error ?? "콘솔 주소를 불러오지 못했습니다.",
    );
  }
  return { templateUrl: data?.templateUrl ?? "", channelUrl: data?.channelUrl ?? "" };
}

export function useSyncAlimtalkTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncAlimtalkTemplates,
    onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }),
  });
}
