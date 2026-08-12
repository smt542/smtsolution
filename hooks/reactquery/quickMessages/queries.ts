import { useQuery } from "@tanstack/react-query";
import { listQuickMessages } from "./apis";
import { quickMessageKeys } from "./keys";
export function useQuickMessages() {
  return useQuery({ queryKey: quickMessageKeys.list(), queryFn: listQuickMessages });
}
