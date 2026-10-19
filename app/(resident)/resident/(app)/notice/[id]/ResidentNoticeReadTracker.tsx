"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useResidentMarkNoticeRead } from "@/hooks/reactquery/residentNotices";

export default function ResidentNoticeReadTracker({ noticeId }: { noticeId: number }) {
  const { mutate } = useResidentMarkNoticeRead();
  const router = useRouter();

  useEffect(() => {
    // 읽음 처리 후 라우터 캐시를 비워, 목록으로 돌아가면 읽지 않음 점이 갱신되게 한다.
    mutate(noticeId, { onSuccess: () => router.refresh() });
  }, [mutate, noticeId, router]);

  return null;
}
