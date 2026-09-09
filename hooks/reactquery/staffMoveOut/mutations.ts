import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmMoveOut } from "./apis";
import { staffMoveOutKeys } from "./keys";

export function useConfirmMoveOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => confirmMoveOut(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: staffMoveOutKeys.all }),
  });
}
