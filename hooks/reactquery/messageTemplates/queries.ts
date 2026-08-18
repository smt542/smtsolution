import { useQuery } from "@tanstack/react-query";
import { listMessageTemplates } from "./apis";
import { messageTemplateKeys } from "./keys";
export function useMessageTemplates() {
  return useQuery({ queryKey: messageTemplateKeys.list(), queryFn: listMessageTemplates });
}
