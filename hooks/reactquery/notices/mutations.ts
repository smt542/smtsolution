import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  attachNoticeSendLog,
  createNotice,
  deleteNotice,
  updateNotice,
  type NoticeInput,
} from "./apis";
import { noticeKeys } from "./keys";

export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoticeInput) => createNotice(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticeKeys.all }),
  });
}

export function useUpdateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<NoticeInput> }) =>
      updateNotice(id, input),
    onSuccess: (notice) => {
      queryClient.setQueryData(noticeKeys.detail(notice.id), notice);
      return queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
}

export function useDeleteNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteNotice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticeKeys.all }),
  });
}

export function useAttachNoticeSendLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, noticeId }: { logId: number; noticeId: number }) =>
      attachNoticeSendLog(logId, noticeId),
    onSuccess: (_data, { noticeId }) =>
      queryClient.invalidateQueries({ queryKey: noticeKeys.sendSummary(noticeId) }),
  });
}
