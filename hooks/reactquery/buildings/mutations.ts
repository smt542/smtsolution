import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBuilding, updateBuilding, deleteBuilding, type BuildingInput } from "./apis"; import { buildingKeys } from "./keys";
export function useCreateBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:(i:BuildingInput)=>createBuilding(i), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
export function useUpdateBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:({id,input}:{id:number;input:Partial<BuildingInput>})=>updateBuilding(id,input), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
export function useDeleteBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:(id:number)=>deleteBuilding(id), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
