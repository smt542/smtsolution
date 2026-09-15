"use client";

import { toast } from "sonner";
import { Button } from "@/components/common";
import {
  DrainScheduledError,
  useDrainScheduledMessages,
} from "@/hooks/reactquery/messaging";

export function DrainScheduledButton() {
  const drainMutation = useDrainScheduledMessages();

  const handleDrain = async () => {
    try {
      const result = await drainMutation.mutateAsync();
      toast.success(
        `처리 ${result.claimed} · 발송 ${result.sent} · 실패 ${result.failed} · 미설정 ${result.unconfigured}`,
      );
    } catch (error) {
      toast.error(
        error instanceof DrainScheduledError && error.code === "forbidden"
          ? "권한이 없습니다."
          : error instanceof DrainScheduledError && error.code === "network"
            ? "네트워크 오류로 처리하지 못했습니다."
            : "처리에 실패했습니다.",
      );
    }
  };

  return (
    <Button
      type="button"
      disabled={drainMutation.isPending}
      aria-busy={drainMutation.isPending}
      onClick={() => void handleDrain()}
    >
      {drainMutation.isPending ? "처리 중…" : "예약분 지금 처리"}
    </Button>
  );
}
