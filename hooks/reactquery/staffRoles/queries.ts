import { useQuery } from "@tanstack/react-query";
import { listStaffRoles } from "./apis";
import { staffRoleKeys } from "./keys";
export function useStaffRoles() {
  return useQuery({ queryKey: staffRoleKeys.all, queryFn: listStaffRoles });
}
