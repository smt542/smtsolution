import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessages, type SendMessagesInput } from "./apis";
import { messagingKeys } from "./keys";

export function useSendMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessagesInput) => sendMessages(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  });
}
