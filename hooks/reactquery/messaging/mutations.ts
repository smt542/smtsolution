import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelScheduledMessage,
  drainScheduledMessages,
  sendMessages,
  setMessageScheduleRecurrence,
  type SendMessagesInput,
} from "./apis";
import { messagingKeys } from "./keys";

export function useSendMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessagesInput) => sendMessages(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  });
}

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: number) => cancelScheduledMessage(scheduleId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  });
}

export function useSetMessageScheduleRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMessageScheduleRecurrence,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  });
}

export function useDrainScheduledMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: drainScheduledMessages,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  });
}
