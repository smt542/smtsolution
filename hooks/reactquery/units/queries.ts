import { useQuery } from "@tanstack/react-query";
import { getUnit } from "./apis";
import { unitKeys } from "./keys";

export function useUnit(id: number) {
  return useQuery({ queryKey: unitKeys.one(id), queryFn: () => getUnit(id), enabled: !!id });
}
