"use client";

import { useRouter } from "next/navigation";

import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicSettlementRetryState() {
  const router = useRouter();

  return (
    <ResidentAsyncState
      variant="public"
      role="alert"
      message={<b>이사정산 내역을 불러오지 못했어요.</b>}
      retryLabel="다시 시도"
      onRetry={() => router.refresh()}
    />
  );
}
