import { makeLabelMasterApis, type LabelMasterRow, type LabelMasterInput } from "@/hooks/reactquery/_shared/labelMaster";
import { makeLabelMasterHooks } from "@/hooks/reactquery/_shared/labelMasterHooks";

const api = makeLabelMasterApis("as_categories");
const hooks = makeLabelMasterHooks("asCategories", api);

export type AsCategory = LabelMasterRow;
export type AsCategoryInput = LabelMasterInput;

export const listAsCategories = api.list;
export const createAsCategory = api.create;
export const renameAsCategory = api.rename;
export const deleteAsCategory = api.softDelete;

export const useAsCategories = hooks.useList;
export const useCreateAsCategory = hooks.useCreate;
export const useRenameAsCategory = hooks.useRename;
export const useDeleteAsCategory = hooks.useRemove;
