"use client";

import { useMutation } from "@tanstack/react-query";

import { mintNoticeShareToken } from "./apis";

export function useMintNoticeShareToken() {
  return useMutation({
    mutationFn: (noticeId: number) => mintNoticeShareToken(noticeId),
  });
}
