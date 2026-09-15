import { useQuery } from "@tanstack/react-query";
import {
  getComplaint,
  getPartnerComplaintEditor,
  listComplaintResolutions,
  listComplaints,
  listPartnerUnits,
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

export function usePartnerComplaintEditor(complaintId: number | null) {
  return useQuery({
    queryKey: complaintKeys.partnerDetail(complaintId),
    queryFn: () => getPartnerComplaintEditor(complaintId as number),
    enabled: complaintId !== null,
  });
}

export function usePartnerUnits(buildingId: number | null) {
  return useQuery({
    queryKey: complaintKeys.partnerUnits(buildingId),
    queryFn: () => listPartnerUnits(buildingId as number),
    enabled: buildingId !== null,
  });
}
