import { makeLabelMasterApis, type LabelMasterRow, type LabelMasterInput } from "@/hooks/reactquery/_shared/labelMaster";
import { makeLabelMasterHooks } from "@/hooks/reactquery/_shared/labelMasterHooks";

const api = makeLabelMasterApis("cleaning_teams");
const hooks = makeLabelMasterHooks("cleaningTeams", api);

export type CleaningTeam = LabelMasterRow;
export type CleaningTeamInput = LabelMasterInput;

export const listCleaningTeams = api.list;
export const createCleaningTeam = api.create;
export const renameCleaningTeam = api.rename;
export const deleteCleaningTeam = api.softDelete;

export const useCleaningTeams = hooks.useList;
export const useCreateCleaningTeam = hooks.useCreate;
export const useRenameCleaningTeam = hooks.useRename;
export const useDeleteCleaningTeam = hooks.useRemove;
