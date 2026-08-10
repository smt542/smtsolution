import { makeLabelMasterApis, type LabelMasterRow, type LabelMasterInput } from "@/hooks/reactquery/_shared/labelMaster";

export type SettlementCheckItem = LabelMasterRow;
export type SettlementCheckItemInput = LabelMasterInput;

const api = makeLabelMasterApis("settlement_check_items");
export const listSettlementCheckItems = api.list;
export const createSettlementCheckItem = api.create;
export const renameSettlementCheckItem = api.rename;
export const deleteSettlementCheckItem = api.softDelete;
