import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createComplaint,
  createComplaintResolution,
  deleteComplaint,
  deleteComplaintResolution,
  updateComplaint,
  updateComplaintResolution,
  updateComplaintStatus,
  type ComplaintInput,
  type ComplaintResolutionInput,
  type ComplaintStatus,
} from "./apis";
import { complaintKeys } from "./keys";

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ComplaintInput) => createComplaint(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

export function useUpdateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ComplaintInput> }) =>
      updateComplaint(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ComplaintStatus }) =>
      updateComplaintStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

export function useDeleteComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteComplaint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

function useInvalidateResolution() {
  const queryClient = useQueryClient();
  return (complaintId: number) => {
    void queryClient.invalidateQueries({ queryKey: complaintKeys.all });
    void queryClient.invalidateQueries({
      queryKey: complaintKeys.resolutions(complaintId),
    });
  };
}

export function useCreateComplaintResolution() {
  const invalidate = useInvalidateResolution();
  return useMutation({
    mutationFn: (input: ComplaintResolutionInput) => createComplaintResolution(input),
    onSuccess: (_data, input) => invalidate(input.complaintId),
  });
}

export function useUpdateComplaintResolution() {
  const invalidate = useInvalidateResolution();
  return useMutation({
    mutationFn: (variables: {
      id: number;
      complaintId: number;
      input: Partial<ComplaintResolutionInput>;
    }) => updateComplaintResolution(variables.id, variables.input),
    onSuccess: (_data, variables) => invalidate(variables.complaintId),
  });
}

export function useDeleteComplaintResolution() {
  const invalidate = useInvalidateResolution();
  return useMutation({
    mutationFn: ({ id }: { id: number; complaintId: number }) =>
      deleteComplaintResolution(id),
    onSuccess: (_data, variables) => invalidate(variables.complaintId),
  });
}
