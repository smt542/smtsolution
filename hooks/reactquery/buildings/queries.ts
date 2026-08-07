import { useQuery } from "@tanstack/react-query"; import { listBuildings, getBuilding } from "./apis"; import { buildingKeys } from "./keys";
export function useBuildings(search?: string){ return useQuery({ queryKey: buildingKeys.list(search), queryFn: ()=>listBuildings(search) }); }
export function useBuilding(id: number) {
  return useQuery({ queryKey: buildingKeys.one(id), queryFn: () => getBuilding(id), enabled: !!id });
}
