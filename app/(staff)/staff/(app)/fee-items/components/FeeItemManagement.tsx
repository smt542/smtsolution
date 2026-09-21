"use client";

import { useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  useBuildingTypes,
  useCreateBuildingType,
  useDeleteBuildingType,
  useRenameBuildingType,
  type BuildingType,
} from "@/hooks/reactquery/buildingTypes";
import {
  useAllFeeItems,
  useCreateFeeItem,
  useDeleteFeeItem,
  useReorderFeeItems,
  useUpdateFeeItem,
  type FeeItem,
} from "@/hooks/reactquery/feeItems";
import { BuildingTypeTabs } from "./BuildingTypeTabs";
import { MAX_FEE_ITEMS, REQUIRED_ITEM_NAMES } from "./constants";
import { DeleteBuildingTypeDialog } from "./DeleteBuildingTypeDialog";
import { FeeItemCard } from "./FeeItemCard";
import { FeeItemFormDialog } from "./FeeItemFormDialog";
import type { BuildingTypeDraft, FeeItemDraft, FeeItemFormValue, RoundingRule } from "./types";

interface FeeItemManagementProps { orgId: number; }

interface PendingBuildingType {
  key: string;
  label: string;
}

function toTypeViews(types: BuildingType[], items: FeeItem[]): BuildingTypeDraft[] {
  return [...types]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((type, typeIndex) => {
      const remaining = items
        .filter((item) => item.typeId === type.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const required = REQUIRED_ITEM_NAMES.map((name, itemIndex) => {
        const existingIndex = remaining.findIndex((item) => item.name.trim() === name);
        if (existingIndex < 0) {
          return {
            key: `type-${type.id}-required-${itemIndex}`,
            name,
            rounding: "round" as const,
            dailyProration: true,
            carryOver: true,
            isRequired: true,
            sortOrder: itemIndex,
          } satisfies FeeItemDraft;
        }

        const [existing] = remaining.splice(existingIndex, 1);
        return {
          key: `item-${existing.id}`,
          id: existing.id,
          name,
          rounding: existing.rounding as RoundingRule,
          dailyProration: existing.dailyProration,
          carryOver: existing.carryOver,
          isRequired: true,
          sortOrder: itemIndex,
        } satisfies FeeItemDraft;
      });
      const optional = remaining.map((item, itemIndex) => ({
        key: `item-${item.id}`,
        id: item.id,
        name: item.name,
        rounding: item.rounding as RoundingRule,
        dailyProration: item.dailyProration,
        carryOver: item.carryOver,
        isRequired: item.isRequired,
        sortOrder: required.length + itemIndex,
      } satisfies FeeItemDraft));

      return {
        key: `type-${type.id}`,
        id: type.id,
        label: type.label,
        sortOrder: typeIndex,
        items: [...required, ...optional],
      };
    });
}

export function FeeItemManagement({ orgId }: FeeItemManagementProps) {
  const confirm = useConfirm();
  const buildingTypesQuery = useBuildingTypes();
  const feeItemsQuery = useAllFeeItems();
  const createBuildingTypeMutation = useCreateBuildingType();
  const renameBuildingTypeMutation = useRenameBuildingType();
  const deleteBuildingTypeMutation = useDeleteBuildingType();
  const createFeeItemMutation = useCreateFeeItem();
  const updateFeeItemMutation = useUpdateFeeItem();
  const deleteFeeItemMutation = useDeleteFeeItem();
  const reorderFeeItemsMutation = useReorderFeeItems();

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<PendingBuildingType | null>(null);
  const [editingTypeKey, setEditingTypeKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  const persistedTypes = useMemo(
    () => toTypeViews(buildingTypesQuery.data ?? [], feeItemsQuery.data ?? []),
    [buildingTypesQuery.data, feeItemsQuery.data],
  );
  const types = pendingType
    ? [
        ...persistedTypes,
        {
          key: pendingType.key,
          label: pendingType.label,
          sortOrder: persistedTypes.length,
          items: [],
        } satisfies BuildingTypeDraft,
      ]
    : persistedTypes;
  const selectedKey = activeKey && types.some((type) => type.key === activeKey)
    ? activeKey
    : types[0]?.key ?? null;
  const activeType = types.find((type) => type.key === selectedKey) ?? null;
  const editingItem = activeType?.items.find((item) => item.key === editingItemKey) ?? null;
  const deleteTarget = types.find((type) => type.key === deleteTargetKey) ?? null;
  const isManagementDataLoading = buildingTypesQuery.isLoading || feeItemsQuery.isLoading;
  const isManagementDataRefreshing = [buildingTypesQuery, feeItemsQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const failed = buildingTypesQuery.isError || feeItemsQuery.isError;
  const isItemMutationPending = createFeeItemMutation.isPending
    || updateFeeItemMutation.isPending
    || deleteFeeItemMutation.isPending;

  const discardPendingType = () => {
    const discardedKey = pendingType?.key;
    setPendingType(null);
    if (editingTypeKey === discardedKey) setEditingTypeKey(null);
    if (activeKey === discardedKey) setActiveKey(null);
  };

  const addType = () => {
    if (pendingType || createBuildingTypeMutation.isPending) return;
    sequenceRef.current += 1;
    const key = `pending-type-${Date.now()}-${sequenceRef.current}`;
    setPendingType({ key, label: "" });
    setActiveKey(key);
    setEditingTypeKey(key);
  };

  const commitPendingType = async (key: string) => {
    if (!pendingType || pendingType.key !== key || createBuildingTypeMutation.isPending) return;
    const label = pendingType.label.trim();
    if (!label) {
      discardPendingType();
      return;
    }

    try {
      const created = await createBuildingTypeMutation.mutateAsync({
        orgId,
        label,
        sortOrder: persistedTypes.length,
      });
      setPendingType(null);
      setEditingTypeKey(null);
      setActiveKey(`type-${created.id}`);
      toast.success("유형이 추가되었습니다.");
    } catch (error) {
      toast.error(error, "건물 유형을 추가하지 못했습니다.");
    }
  };

  const renameType = async (id: number, label: string): Promise<boolean> => {
    const persisted = buildingTypesQuery.data?.find((type) => type.id === id);
    const trimmed = label.trim();
    if (!persisted || !trimmed || trimmed === persisted.label.trim()) return true;
    if (renameBuildingTypeMutation.isPending) return false;

    try {
      await renameBuildingTypeMutation.mutateAsync({ id, label: trimmed });
      toast.success("유형명이 수정되었습니다.");
      return true;
    } catch (error) {
      toast.error(error, "건물 유형명을 수정하지 못했습니다.");
      return false;
    }
  };

  const openAddItem = () => {
    if (!activeType || activeType.id == null) return;
    if (activeType.items.length >= MAX_FEE_ITEMS) {
      toast.error(`관리 항목은 최대 ${MAX_FEE_ITEMS}개까지 등록할 수 있어요`);
      return;
    }
    setEditingItemKey(null);
    setFormOpen(true);
  };

  const submitItem = async (value: FeeItemFormValue) => {
    if (!activeType?.id || isItemMutationPending) return;
    const item = editingItem;
    const input = {
      ...value,
      orgId,
      typeId: activeType.id,
      isRequired: item?.isRequired ?? false,
      sortOrder: item?.sortOrder ?? activeType.items.length,
    };

    try {
      if (item?.id != null) {
        await updateFeeItemMutation.mutateAsync({ id: item.id, input });
        toast.success("항목이 수정되었습니다.");
      } else {
        await createFeeItemMutation.mutateAsync(input);
        toast.success("항목이 추가되었습니다.");
      }
      setFormOpen(false);
      setEditingItemKey(null);
    } catch (error) {
      toast.error(error, "관리 항목을 반영하지 못했습니다.");
      throw error;
    }
  };

  const deleteItem = async () => {
    if (!editingItem?.id || editingItem.isRequired || deleteFeeItemMutation.isPending) return;
    const ok = await confirm({
      title: "관리 항목 삭제",
      description: `‘${editingItem.name}’ 항목을 삭제할까요?`,
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (!ok || deleteFeeItemMutation.isPending) return;

    try {
      await deleteFeeItemMutation.mutateAsync({ id: editingItem.id, isRequired: editingItem.isRequired });
      setFormOpen(false);
      setEditingItemKey(null);
      toast.success("항목이 삭제되었습니다.");
    } catch (error) {
      toast.error(error, "관리 항목을 삭제하지 못했습니다.");
    }
  };

  const reorderItems = async (draggedKey: string, targetKey: string) => {
    if (!activeType || reorderFeeItemsMutation.isPending) return;
    const optional = activeType.items.filter((item) => !item.isRequired && item.id != null);
    const from = optional.findIndex((item) => item.key === draggedKey);
    const to = optional.findIndex((item) => item.key === targetKey);
    if (from < 0 || to < 0 || from === to) return;

    const moved = [...optional];
    const [item] = moved.splice(from, 1);
    moved.splice(to, 0, item);
    const requiredIds = activeType.items
      .filter((candidate) => candidate.isRequired && candidate.id != null)
      .map((candidate) => candidate.id as number);
    const orderedIds = [...requiredIds, ...moved.map((candidate) => candidate.id as number)];

    try {
      await reorderFeeItemsMutation.mutateAsync(orderedIds);
      toast.success("항목 순서가 변경되었습니다.");
    } catch (error) {
      toast.error(error, "항목 순서를 변경하지 못했습니다.");
    }
  };

  const requestDeleteType = () => {
    if (activeType) setDeleteTargetKey(activeType.key);
  };

  const removeTargetType = async () => {
    if (!deleteTarget || deleteBuildingTypeMutation.isPending) return;
    if (deleteTarget.id == null) {
      discardPendingType();
      setDeleteTargetKey(null);
      return;
    }

    try {
      await deleteBuildingTypeMutation.mutateAsync(deleteTarget.id);
      const index = types.findIndex((type) => type.key === deleteTarget.key);
      const next = types.filter((type) => type.key !== deleteTarget.key);
      if (selectedKey === deleteTarget.key) {
        setActiveKey(next[Math.min(index, next.length - 1)]?.key ?? null);
      }
      setDeleteTargetKey(null);
      toast.success("유형이 삭제되었습니다.");
    } catch (error) {
      toast.error(error, "건물 유형을 삭제하지 못했습니다.");
    }
  };

  if (failed) {
    return (
      <div className="p-6"><div role="alert" className="rounded-2xl bg-white p-10 text-center shadow-card">
        <p className="text-sm font-bold text-red">관리 항목을 불러오지 못했습니다.</p>
        <button type="button" className="mt-4 h-10 rounded-xl border border-line px-4 text-sm font-bold text-t2" onClick={() => { void buildingTypesQuery.refetch(); void feeItemsQuery.refetch(); }}>다시 시도</button>
      </div></div>
    );
  }
  if (isManagementDataLoading) return <div className="flex min-h-[420px] items-center justify-center"><Spinner label="관리 항목 불러오는 중" /></div>;

  return (
    <div className="relative min-h-[calc(100vh-62px)] bg-bg">
      {isManagementDataRefreshing ? (
        <div className="absolute right-6 top-3 z-10 rounded-lg bg-white/95 shadow-card">
          <Spinner label="관리 항목 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
      <BuildingTypeTabs
        types={types}
        activeKey={selectedKey}
        editingKey={editingTypeKey}
        editingValue={pendingType?.label ?? ""}
        isPending={createBuildingTypeMutation.isPending}
        canAdd={!pendingType && !createBuildingTypeMutation.isPending}
        onSelect={setActiveKey}
        onAdd={addType}
        onLabelChange={(key, label) => {
          if (pendingType?.key === key) setPendingType((current) => current ? { ...current, label } : current);
        }}
        onFinishEditing={(key) => { void commitPendingType(key); }}
        onCancelEditing={discardPendingType}
      />
      <main className="p-6 pt-[22px]">
        {activeType ? (
          <FeeItemCard
            key={activeType.key}
            type={activeType}
            isRenamePending={renameBuildingTypeMutation.isPending}
            isReorderPending={reorderFeeItemsMutation.isPending}
            onAddItem={openAddItem}
            onEditItem={(item) => { setEditingItemKey(item.key); setFormOpen(true); }}
            onReorder={(draggedKey, targetKey) => { void reorderItems(draggedKey, targetKey); }}
            onDeleteType={requestDeleteType}
            onRename={(label) => activeType.id == null ? Promise.resolve(false) : renameType(activeType.id, label)}
          />
        ) : (
          <div className="rounded-2xl bg-white p-10 shadow-card"><EmptyState message="등록된 건물 유형이 없습니다. 상단 + 버튼으로 유형을 추가해 주세요." /></div>
        )}
      </main>
      <FeeItemFormDialog
        key={`${formOpen}-${editingItem?.key ?? "new"}`}
        open={formOpen}
        item={editingItem}
        existingNames={(activeType?.items ?? []).filter((item) => item.key !== editingItem?.key).map((item) => item.name)}
        isPending={isItemMutationPending}
        onClose={() => { setFormOpen(false); setEditingItemKey(null); }}
        onSubmit={submitItem}
        onDelete={deleteItem}
      />
      <DeleteBuildingTypeDialog
        open={deleteTarget != null}
        label={deleteTarget?.label ?? ""}
        itemCount={deleteTarget?.items.filter((item) => item.id != null).length ?? 0}
        isPending={deleteBuildingTypeMutation.isPending}
        onClose={() => setDeleteTargetKey(null)}
        onConfirm={removeTargetType}
      />
    </div>
  );
}
