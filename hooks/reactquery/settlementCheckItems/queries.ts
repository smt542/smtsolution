import { useQuery } from "@tanstack/react-query";
import { listSettlementCheckItems } from "./apis";
import { settlementCheckItemKeys } from "./keys";

export function useSettlementCheckItems() {
  return useQuery({ queryKey: settlementCheckItemKeys.list(), queryFn: listSettlementCheckItems });
}
