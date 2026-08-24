"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common";

interface DrainScheduledResult {
  claimed: number;
  sent: number;
  failed: number;
  unconfigured: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDrainScheduledResult(value: unknown): value is DrainScheduledResult {
  return isRecord(value)
    && typeof value.claimed === "number"
    && typeof value.sent === "number"
    && typeof value.failed === "number"
    && typeof value.unconfigured === "number";
}

export function DrainScheduledButton() {
  const [isPending, setIsPending] = useState(false);

  const handleDrain = async () => {
    setIsPending(true);
    try {
      const response = await fetch("/api/messaging/dispatch-scheduled", {
        method: "POST",
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(
          isRecord(result) && result.error === "forbidden"
            ? "권한이 없습니다."
            : "처리에 실패했습니다.",
        );
        return;
      }

      if (!isDrainScheduledResult(result)) {
        toast.error("처리에 실패했습니다.");
        return;
      }

      toast.success(
        `처리 ${result.claimed} · 발송 ${result.sent} · 실패 ${result.failed} · 미설정 ${result.unconfigured}`,
      );
    } catch {
      toast.error("네트워크 오류로 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => void handleDrain()}
    >
      {isPending ? "처리 중…" : "예약분 지금 처리"}
    </Button>
  );
}
