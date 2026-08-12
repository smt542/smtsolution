import { useQuery } from "@tanstack/react-query";
import {
  getComplaint,
  listComplaintResolutions,
  listComplaints,
  type ComplaintFilters,
} from "./apis";
import { complaintKeys } from "./keys";

export function useComplaints(filters: ComplaintFilters = {}) {
  return useQuery({
    queryKey: complaintKeys.list(filters),
    queryFn: () => listComplaints(filters),
  });
}

export function useComplaint(id: number) {
  return useQuery({
    queryKey: complaintKeys.one(id),
    queryFn: () => getComplaint(id),
    enabled: id > 0,
  });
}

export function useComplaintResolutions(complaintId: number) {
  return useQuery({
    queryKey: complaintKeys.resolutions(complaintId),
    queryFn: () => listComplaintResolutions(complaintId),
    enabled: complaintId > 0,
  });
}
