"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

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
