"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useResidentMarkNoticeRead } from "@/hooks/reactquery/residentNotices";

export default function ResidentNoticeReadTracker({
  noticeId,
  refreshOnRead = false,
}: {
  noticeId: number;
  /** 목록 위 시트로 열었을 때: 읽음 처리 후 서버 목록(읽지 않음 점)을 다시 그린다. */
  refreshOnRead?: boolean;
}) {
  const { mutate } = useResidentMarkNoticeRead();
  const router = useRouter();

  useEffect(() => {
    mutate(noticeId, refreshOnRead ? { onSuccess: () => router.refresh() } : undefined);
  }, [mutate, noticeId, refreshOnRead, router]);

  return null;
}
