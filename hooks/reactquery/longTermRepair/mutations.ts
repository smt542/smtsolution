import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveLedger, type SaveLongTermRepairLedgerInput } from "./apis";
import { longTermRepairKeys } from "./keys";

export function useSaveLongTermRepairLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveLongTermRepairLedgerInput) => saveLedger(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: longTermRepairKeys.all }),
  });
}
