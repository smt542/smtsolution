"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LONG_STALE_TIME = 15 * 60_000;
const TRANSACTION_STALE_TIME = 15_000;

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });

  const masterDataPrefixes = [
    ["buildings"],
    ["buildingTypes"],
    ["feeItems"],
    ["roomTypes"],
    ["asCategories"],
    ["vendors"],
    ["accounts"],
    ["utilities", "prices"],
    ["utilities", "scoped-prices"],
    ["utilities", "fixed-usages"],
    ["utilities", "supplier"],
    ["utilities", "billing-period"],
    ["billing", "period-setting"],
  ] as const;
  masterDataPrefixes.forEach((queryKey) => {
    client.setQueryDefaults(queryKey, {
      staleTime: LONG_STALE_TIME,
      refetchOnWindowFocus: false,
    });
  });

  const transactionalPrefixes = [
    ["billing", "list"],
    ["billing", "history"],
    ["billing", "new-occ"],
    ["utilities", "rows"],
    ["utilities", "history"],
    ["utilities", "confirmation"],
    ["notices"],
  ] as const;
  transactionalPrefixes.forEach((queryKey) => {
    client.setQueryDefaults(queryKey, {
      staleTime: TRANSACTION_STALE_TIME,
      refetchOnWindowFocus: true,
    });
  });

  return client;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  // 로그인 사용자가 바뀌면(로그아웃·계정 전환) 이전 사용자의 캐시를 비운다.
  // 같은 사용자의 TOKEN_REFRESHED·USER_UPDATED 등은 user id가 같으므로 비우지 않는다.
  useEffect(() => {
    let lastUserId: string | null | undefined;
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (lastUserId !== undefined && lastUserId !== nextUserId) {
        queryClient.clear();
      }
      lastUserId = nextUserId;
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* devtools는 dev에서만 렌더되지만, 그 dev에서 인쇄 미리보기에 끼어들지 않도록 제외한다. */}
      <div className="contents print:hidden">
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </QueryClientProvider>
  );
}
