import { makeLabelMasterApis, type LabelMasterRow, type LabelMasterInput } from "@/hooks/reactquery/_shared/labelMaster";
import { makeLabelMasterHooks } from "@/hooks/reactquery/_shared/labelMasterHooks";

const api = makeLabelMasterApis("room_types");
const hooks = makeLabelMasterHooks("roomTypes", api);

export type RoomType = LabelMasterRow;
export type RoomTypeInput = LabelMasterInput;

export const listRoomTypes = api.list;
export const createRoomType = api.create;
export const renameRoomType = api.rename;
export const deleteRoomType = api.softDelete;

export const useRoomTypes = hooks.useList;
export const useCreateRoomType = hooks.useCreate;
export const useRenameRoomType = hooks.useRename;
export const useDeleteRoomType = hooks.useRemove;
