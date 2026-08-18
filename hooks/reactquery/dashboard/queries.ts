import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "./apis";
import { dashboardKeys } from "./keys";

export function useDashboardOverview(today: string) {
  return useQuery({
    queryKey: dashboardKeys.overview(today),
    queryFn: () => getDashboardOverview(today),
    staleTime: 60_000,
  });
}
