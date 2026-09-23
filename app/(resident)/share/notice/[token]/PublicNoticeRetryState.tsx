"use client";

import { useRouter } from "next/navigation";

import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";

export default function PublicNoticeRetryState() {
  const router = useRouter();

  return (
    <ResidentAsyncState
      variant="public"
      role="alert"
      message={<b>공지사항을 불러오지 못했어요.</b>}
      retryLabel="다시 시도"
      onRetry={() => router.refresh()}
    />
  );
}
