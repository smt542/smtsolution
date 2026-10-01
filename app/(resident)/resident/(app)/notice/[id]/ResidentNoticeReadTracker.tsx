"use client";

import { useEffect } from "react";

import { useResidentMarkNoticeRead } from "@/hooks/reactquery/residentNotices";

export default function ResidentNoticeReadTracker({
  noticeId,
}: {
  noticeId: number;
}) {
  const { mutate } = useResidentMarkNoticeRead();

  useEffect(() => {
    mutate(noticeId);
  }, [mutate, noticeId]);

  return null;
}
