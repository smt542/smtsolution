import { useQuery } from "@tanstack/react-query";
import { getMyContext } from "./apis";
import { authKeys } from "./keys";

export function useMe() {
  return useQuery({ queryKey: authKeys.me(), queryFn: getMyContext, staleTime: 60_000 });
}
