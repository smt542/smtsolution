import { useQuery } from "@tanstack/react-query";
import { getSenderDefaults } from "./apis";
import { senderDefaultsKeys } from "./keys";

/** 운영사 기본 발신번호. 서버 env라 세션 중 바뀌지 않으므로 다시 조회하지 않는다. */
export function useSenderDefaults() {
  return useQuery({
    queryKey: senderDefaultsKeys.all,
    queryFn: getSenderDefaults,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
