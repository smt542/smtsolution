import { useQuery } from "@tanstack/react-query";
import { listMessageLogs } from "./apis";
import { messagingKeys } from "./keys";

export function useMessageLogs(limit?: number) {
  return useQuery({
    queryKey: messagingKeys.logs(limit),
    queryFn: () => listMessageLogs(limit),
  });
}
