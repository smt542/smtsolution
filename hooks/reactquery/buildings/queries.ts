import { useQuery } from "@tanstack/react-query"; import { listBuildings } from "./apis"; import { buildingKeys } from "./keys";
export function useBuildings(search?: string){ return useQuery({ queryKey: buildingKeys.list(search), queryFn: ()=>listBuildings(search) }); }
