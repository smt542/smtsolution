import { useQuery } from "@tanstack/react-query";

import {
  listStaffMoveOutRequests,
  type StaffMoveOutFilters,
} from "./apis";
import { staffMoveOutKeys } from "./keys";

export function useStaffMoveOutRequests(filters: StaffMoveOutFilters = {}) {
  return useQuery({
    queryKey: staffMoveOutKeys.list(filters),
    queryFn: () => listStaffMoveOutRequests(filters),
  });
}
