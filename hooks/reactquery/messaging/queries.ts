import { useQuery } from "@tanstack/react-query";
import {
  listMessageLogs,
  listScheduledMessages,
  listTenantAlimtalkConsent,
  quoteMessagePoints,
  type MessagePointQuoteInput,
} from "./apis";
import { messagingKeys } from "./keys";

export function useMessageLogs(limit?: number) {
  return useQuery({
    queryKey: messagingKeys.logs(limit),
    queryFn: () => listMessageLogs(limit),
  });
}

export function useScheduledMessages() {
  return useQuery({
    queryKey: messagingKeys.scheduledMessages(),
    queryFn: listScheduledMessages,
  });
}

export function useTenantAlimtalkConsent(buildingId: number) {
  return useQuery({
    queryKey: messagingKeys.consent(buildingId),
    queryFn: () => listTenantAlimtalkConsent(buildingId),
    enabled: buildingId > 0,
  });
}

export function useMessagePointQuote(input: MessagePointQuoteInput | null) {
  return useQuery({
    queryKey: messagingKeys.pointQuote(input),
    queryFn: () => quoteMessagePoints(input as MessagePointQuoteInput),
    enabled: input !== null,
  });
}
