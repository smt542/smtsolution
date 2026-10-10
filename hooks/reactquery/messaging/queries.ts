import { useQueries, useQuery } from "@tanstack/react-query";
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

/** 여러 건물의 입주자 알림톡 동의(건물별 캐시는 useTenantAlimtalkConsent 와 같은 키를 공유). */
export function useTenantAlimtalkConsents(buildingIds: number[]) {
  const ids = [...new Set(buildingIds)].filter((id) => id > 0);
  const queries = useQueries({
    queries: ids.map((buildingId) => ({
      queryKey: messagingKeys.consent(buildingId),
      queryFn: () => listTenantAlimtalkConsent(buildingId),
    })),
  });
  return {
    data: queries.flatMap((query) => query.data ?? []),
    isLoading: queries.some((query) => query.isLoading),
  };
}

export function useMessagePointQuote(input: MessagePointQuoteInput | null) {
  return useQuery({
    queryKey: messagingKeys.pointQuote(input),
    queryFn: () => quoteMessagePoints(input as MessagePointQuoteInput),
    enabled: input !== null,
  });
}
