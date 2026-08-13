import { useMutation, useQueryClient } from "@tanstack/react-query";
import { issueBills, type IssueBillsPayload } from "./apis";
import { billKeys } from "./keys";

export function useIssueBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: IssueBillsPayload) => issueBills(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}
