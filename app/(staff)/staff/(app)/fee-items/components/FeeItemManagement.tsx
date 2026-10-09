"use client";

import { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  DUPLICATE_BUILDING_TYPE_LABEL,
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
import type { FeeItemDropPosition } from "./FeeItemRow";
import type { BuildingTypeDraft, FeeItemDraft, FeeItemFormValue, RoundingRule } from "./types";

interface FeeItemManagementProps { orgId: number; }

// 아직 DB에 없는 필수 항목은 화면에만 놓는다. 유형을 만들면 DB 트리거가 실제 행을 채운다.
function requiredPlaceholder(keyPrefix: string, name: string, index: number): FeeItemDraft {
  return {
    key: `${keyPrefix}-required-${index}`,
    name,
    rounding: "round",
    dailyProration: false,
    carryOver: true,
    isRequired: true,
    sortOrder: index,
  };
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
        if (existingIndex < 0) return requiredPlaceholder(`type-${type.id}`, name, itemIndex);

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

const TEMPORARY_BUILDING_TYPE_LABEL = "새 유형";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "23505";
}

function nextTemporaryBuildingTypeLabel(types: BuildingType[], reservedLabels: Set<string>): string {
  const labels = new Set(types.map((type) => type.label.trim()));
  reservedLabels.forEach((label) => labels.add(label));
  if (!labels.has(TEMPORARY_BUILDING_TYPE_LABEL)) return TEMPORARY_BUILDING_TYPE_LABEL;

  let suffix = 2;
  while (labels.has(`${TEMPORARY_BUILDING_TYPE_LABEL} ${suffix}`)) suffix += 1;
  return `${TEMPORARY_BUILDING_TYPE_LABEL} ${suffix}`;
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
  const [editingTypeKey, setEditingTypeKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [initialNamingTypeKey, setInitialNamingTypeKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  // 저장에 실패해 편집 상태로 되돌릴 때 인풋을 다시 마운트해 포커스를 되돌린다.
  const [typeNameRetryToken, setTypeNameRetryToken] = useState(0);

  const persistedTypes = useMemo(
    () => toTypeViews(buildingTypesQuery.data ?? [], feeItemsQuery.data ?? []),
    [buildingTypesQuery.data, feeItemsQuery.data],
  );
  const types = persistedTypes;
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

  const keepTypeNameEditing = (key: string) => {
    setEditingTypeKey(key);
    setTypeNameRetryToken((token) => token + 1);
  };

  const addType = async () => {
    if (initialNamingTypeKey || createBuildingTypeMutation.isPending) return;

    const loadedTypes = buildingTypesQuery.data ?? [];
    const reservedLabels = new Set<string>();
    let created: BuildingType | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const label = nextTemporaryBuildingTypeLabel(loadedTypes, reservedLabels);
      reservedLabels.add(label);

      try {
        created = await createBuildingTypeMutation.mutateAsync({
          orgId,
          label,
          sortOrder: loadedTypes.length,
        });
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 4) {
          toast.error(error, "건물 유형을 추가하지 못했습니다.");
          return;
        }
      }
    }

    if (!created) return;
    const key = `type-${created.id}`;
    setActiveKey(key);
    setEditingTypeKey(key);
    setEditingValue("");
    setInitialNamingTypeKey(key);
  };

  const deleteInitialNamingType = async (key: string) => {
    if (initialNamingTypeKey !== key || deleteBuildingTypeMutation.isPending) return;
    const target = types.find((type) => type.key === key);
    if (!target) {
      setInitialNamingTypeKey(null);
      setEditingTypeKey(null);
      setEditingValue("");
      return;
    }

    try {
      await deleteBuildingTypeMutation.mutateAsync(target.id);
      const index = types.findIndex((type) => type.key === key);
      const next = types.filter((type) => type.key !== key);
      if (selectedKey === key) {
        setActiveKey((index > 0 ? next[index - 1] : next[0])?.key ?? null);
      }
      setInitialNamingTypeKey(null);
      setEditingTypeKey(null);
      setEditingValue("");
    } catch (error) {
      toast.error(error, "건물 유형을 삭제하지 못했습니다.");
      keepTypeNameEditing(key);
    }
  };

  const finishTypeEditing = async (key: string) => {
    if (key !== editingTypeKey || createBuildingTypeMutation.isPending) return;
    const label = editingValue.trim();

    if (!label) {
      if (initialNamingTypeKey === key) {
        await deleteInitialNamingType(key);
      } else {
        setEditingTypeKey(null);
        setEditingValue("");
      }
      return;
    }

    const type = types.find((candidate) => candidate.key === key);
    if (!type) return;
    const updated = await renameType(type.id, label);
    if (updated) {
      setInitialNamingTypeKey(null);
      setEditingTypeKey(null);
      setEditingValue("");
    } else {
      keepTypeNameEditing(key);
    }
  };

  const cancelTypeEditing = async (key: string) => {
    if (initialNamingTypeKey === key) {
      await deleteInitialNamingType(key);
      return;
    }
    setEditingTypeKey(null);
    setEditingValue("");
  };

  const renameType = async (id: number, label: string): Promise<boolean> => {
    const persisted = buildingTypesQuery.data?.find((type) => type.id === id);
    const trimmed = label.trim();
    if (!persisted || !trimmed || trimmed === persisted.label.trim()) return true;
    if (renameBuildingTypeMutation.isPending) return false;
    if ((buildingTypesQuery.data ?? []).some((type) => type.id !== id && type.label.trim() === trimmed)) {
      toast.error(DUPLICATE_BUILDING_TYPE_LABEL);
      return false;
    }

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
    if (!activeType) return;
    if (activeType.items.length >= MAX_FEE_ITEMS) {
      toast.error(`관리 항목은 최대 ${MAX_FEE_ITEMS}개까지 등록할 수 있어요`);
      return;
    }
    setEditingItemKey(null);
    setFormOpen(true);
  };

  const submitItem = async (value: FeeItemFormValue) => {
    if (!activeType || isItemMutationPending) return;
    const item = editingItem;
    const input = {
      ...value,
      // 필수 항목 명칭은 잠겨 있으므로 폼 값이 아니라 원래 이름을 그대로 보낸다.
      name: item?.isRequired ? item.name : value.name,
      // 필수 공과금은 일수 안분 없음(정책) — 폼에서 바꿔도 false로 고정한다.
      dailyProration: item?.isRequired ? false : value.dailyProration,
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
      description: <>‘<b>{editingItem.name}</b>’ 항목을 삭제합니다. 삭제하면 되돌릴 수 없어요.</>,
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

  const reorderItems = async (draggedKey: string, targetKey: string, position: FeeItemDropPosition) => {
    if (!activeType || reorderFeeItemsMutation.isPending) return;
    const optional = activeType.items.filter((item) => !item.isRequired && item.id != null);
    const draggedItem = optional.find((item) => item.key === draggedKey);
    if (!draggedItem) return;
    const rest = optional.filter((item) => item.key !== draggedKey);
    const targetIndex = rest.findIndex((item) => item.key === targetKey);
    if (targetIndex < 0) return;
    const insertAt = position === "before" ? targetIndex : targetIndex + 1;
    rest.splice(insertAt, 0, draggedItem);
    const requiredIds = activeType.items
      .filter((candidate) => candidate.isRequired && candidate.id != null)
      .map((candidate) => candidate.id as number);
    const orderedIds = [...requiredIds, ...rest.map((candidate) => candidate.id as number)];

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

    try {
      await deleteBuildingTypeMutation.mutateAsync(deleteTarget.id);
      const index = types.findIndex((type) => type.key === deleteTarget.key);
      const next = types.filter((type) => type.key !== deleteTarget.key);
      if (selectedKey === deleteTarget.key) {
        setActiveKey((index > 0 ? next[index - 1] : next[0])?.key ?? null);
      }
      if (initialNamingTypeKey === deleteTarget.key) {
        setInitialNamingTypeKey(null);
        setEditingTypeKey(null);
        setEditingValue("");
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
        editingValue={editingValue}
        isPending={createBuildingTypeMutation.isPending}
        refocusToken={typeNameRetryToken}
        canAdd={!initialNamingTypeKey && !createBuildingTypeMutation.isPending}
        onSelect={setActiveKey}
        onAdd={addType}
        onLabelChange={(key, label) => {
          if (editingTypeKey === key) setEditingValue(label);
        }}
        onFinishEditing={(key) => { void finishTypeEditing(key); }}
        onCancelEditing={(key) => { void cancelTypeEditing(key); }}
      />
      <main className="p-6 pt-[22px]">
        {activeType ? (
          <FeeItemCard
            key={activeType.key}
            // 이름 입력 중에는 내부용 임시 이름 대신 탭에 치고 있는 이름을 보여준다.
            type={initialNamingTypeKey === activeType.key ? { ...activeType, label: editingValue } : activeType}
            isRenamePending={renameBuildingTypeMutation.isPending}
            isReorderPending={reorderFeeItemsMutation.isPending}
            onAddItem={openAddItem}
            onEditItem={(item) => { setEditingItemKey(item.key); setFormOpen(true); }}
            onReorder={(draggedKey, targetKey, position) => { void reorderItems(draggedKey, targetKey, position); }}
            onDeleteType={requestDeleteType}
            onRename={(label) => renameType(activeType.id, label)}
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
