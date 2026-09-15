"use client";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useMe } from "@/hooks/reactquery/auth";
import { MasterListEditor } from "./MasterListEditor";
import { QuickMessageEditor } from "./QuickMessageEditor";
import { useRoomTypes, useCreateRoomType, useRenameRoomType, useDeleteRoomType } from "@/hooks/reactquery/roomTypes";
import { useSepticVendors, useCreateSepticVendor, useRenameSepticVendor, useDeleteSepticVendor } from "@/hooks/reactquery/septicVendors";
import { useAsCategories, useCreateAsCategory, useRenameAsCategory, useDeleteAsCategory } from "@/hooks/reactquery/asCategories";
import { useCleaningTeams, useCreateCleaningTeam, useRenameCleaningTeam, useDeleteCleaningTeam } from "@/hooks/reactquery/cleaningTeams";

type ListHook = () => { data?: { id: number; label: string }[] };
type CreateHook = () => { mutateAsync: (a: { orgId: number; label: string }) => Promise<unknown> };
type RenameHook = () => { mutateAsync: (a: { id: number; label: string }) => Promise<unknown> };
type RemoveHook = () => { mutateAsync: (id: number) => Promise<unknown> };

function ConnectedMasterEditor({ title, useList, useCreate, useRename, useRemove }: {
  title: string; useList: ListHook; useCreate: CreateHook; useRename: RenameHook; useRemove: RemoveHook;
}) {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: items = [] } = useList();
  const create = useCreate();
  const rename = useRename();
  const remove = useRemove();
  return (
    <MasterListEditor
      title={title}
      items={items.map((i) => ({ id: i.id, label: i.label }))}
      onAdd={async (label) => { if (!orgId) return; try { await create.mutateAsync({ orgId, label }); } catch (e) { toast.error(e, `${title} 항목을 추가하지 못했습니다.`); } }}
      onRename={async (id, label) => { try { await rename.mutateAsync({ id, label }); } catch (e) { toast.error(e, `${title} 항목을 변경하지 못했습니다.`); } }}
      onDelete={async (id) => { try { await remove.mutateAsync(id); } catch (e) { toast.error(e, `${title} 항목을 삭제하지 못했습니다.`); } }}
    />
  );
}

export function SystemSettingsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ConnectedMasterEditor title="룸타입" useList={useRoomTypes} useCreate={useCreateRoomType} useRename={useRenameRoomType} useRemove={useDeleteRoomType} />
        <ConnectedMasterEditor title="정화조 업체" useList={useSepticVendors} useCreate={useCreateSepticVendor} useRename={useRenameSepticVendor} useRemove={useDeleteSepticVendor} />
        <ConnectedMasterEditor title="AS 구분" useList={useAsCategories} useCreate={useCreateAsCategory} useRename={useRenameAsCategory} useRemove={useDeleteAsCategory} />
        <ConnectedMasterEditor title="청소팀" useList={useCleaningTeams} useCreate={useCreateCleaningTeam} useRename={useRenameCleaningTeam} useRemove={useDeleteCleaningTeam} />
      </div>
      <QuickMessageEditor />
    </div>
  );
}
