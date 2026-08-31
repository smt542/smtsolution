import { useQuery } from "@tanstack/react-query";
import { getTodayMoveIns, getUpcomingLeaseExpiries } from "./apis";
import { entryAlertKeys } from "./keys";

export function useTodayMoveIns(today: string) {
  return useQuery({
    queryKey: entryAlertKeys.todayMoveIns(today),
    queryFn: () => getTodayMoveIns(today),
    staleTime: 60_000,
  });
}

export function useUpcomingLeaseExpiries(today: string, withinDays = 30) {
  return useQuery({
    queryKey: entryAlertKeys.leaseExpiries(today, withinDays),
    queryFn: () => getUpcomingLeaseExpiries(today, withinDays),
    staleTime: 60_000,
  });
}
