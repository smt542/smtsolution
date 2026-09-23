"use client";

import { useRouter } from "next/navigation";

import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicBillRetryState() {
  const router = useRouter();

  return (
    <ResidentAsyncState
      variant="public"
      role="alert"
      message={<b>관리비 고지서를 불러오지 못했어요</b>}
      retryLabel="다시 시도"
      onRetry={() => router.refresh()}
    />
  );
}
