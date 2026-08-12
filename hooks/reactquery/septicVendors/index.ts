import { makeLabelMasterApis, type LabelMasterRow, type LabelMasterInput } from "@/hooks/reactquery/_shared/labelMaster";
import { makeLabelMasterHooks } from "@/hooks/reactquery/_shared/labelMasterHooks";

const api = makeLabelMasterApis("septic_vendors");
const hooks = makeLabelMasterHooks("septicVendors", api);

export type SepticVendor = LabelMasterRow;
export type SepticVendorInput = LabelMasterInput;

export const listSepticVendors = api.list;
export const createSepticVendor = api.create;
export const renameSepticVendor = api.rename;
export const deleteSepticVendor = api.softDelete;

export const useSepticVendors = hooks.useList;
export const useCreateSepticVendor = hooks.useCreate;
export const useRenameSepticVendor = hooks.useRename;
export const useDeleteSepticVendor = hooks.useRemove;
