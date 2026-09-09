"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import {
  createBuildingType,
  deleteBuildingType,
  getBuildingTypeUsage,
  renameBuildingType,
  reorderBuildingTypes,
  useBuildingTypes,
  buildingTypeKeys,
  type BuildingType,
} from "@/hooks/reactquery/buildingTypes";
import {
  createFeeItem,
  deleteFeeItem,
  listFeeItems,
  reorderFeeItems,
  updateFeeItem,
  useAllFeeItems,
  feeItemKeys,
  type FeeItem,
} from "@/hooks/reactquery/feeItems";
import { BuildingTypeTabs } from "./BuildingTypeTabs";
import {
  createRequiredItems,
  DEFAULT_FORM_VALUE,
  ensureRequiredItems,
  MAX_FEE_ITEMS,
  REQUIRED_ITEM_NAMES,
} from "./constants";
import { DeleteBuildingTypeDialog } from "./DeleteBuildingTypeDialog";
import { FeeItemCard } from "./FeeItemCard";
import { FeeItemFormDialog } from "./FeeItemFormDialog";
import { FeeItemRightRail } from "./FeeItemRightRail";
import type { BuildingTypeDraft, FeeItemDraft, FeeItemFormValue, RoundingRule } from "./types";

interface FeeItemManagementProps { orgId: number; }

function toDrafts(types: BuildingType[], items: FeeItem[]): BuildingTypeDraft[] {
  return [...types].sort((a, b) => a.sortOrder - b.sortOrder).map((type, typeIndex) => ({
    key: `type-${type.id}`,
    id: type.id,
    label: type.label,
    sortOrder: typeIndex,
    items: items.filter((item) => item.typeId === type.id).sort((a, b) => a.sortOrder - b.sortOrder).map((item, itemIndex) => ({
      key: `item-${item.id}`,
      id: item.id,
      name: item.name,
      rounding: item.rounding as RoundingRule,
      dailyProration: item.dailyProration,
      carryOver: item.carryOver,
      isRequired: item.isRequired,
      sortOrder: itemIndex,
    })),
  }));
}

function cloneDrafts(types: BuildingTypeDraft[]): BuildingTypeDraft[] {
  return types.map((type) => ({ ...type, items: type.items.map((item) => ({ ...item })) }));
}

function ensureRequiredItemsByType(types: BuildingTypeDraft[]): BuildingTypeDraft[] {
  return types.map((type) => ({
    ...type,
    items: ensureRequiredItems(type.key, type.items),
  }));
}

function comparable(types: BuildingTypeDraft[]) {
  return types.map((type, typeIndex) => ({
    id: type.id,
    label: type.label.trim(),
    sortOrder: typeIndex,
    items: type.items.map((item, itemIndex) => ({
      id: item.id,
      name: item.name.trim(),
      rounding: item.rounding,
      dailyProration: item.dailyProration,
      carryOver: item.carryOver,
      isRequired: item.isRequired,
      sortOrder: itemIndex,
    })),
  }));
}

function feeItemChanged(current: FeeItemDraft, baseline: FeeItemDraft) {
  return current.name.trim() !== baseline.name.trim()
    || current.rounding !== baseline.rounding
    || current.dailyProration !== baseline.dailyProration
    || current.carryOver !== baseline.carryOver
    || current.isRequired !== baseline.isRequired
    || current.sortOrder !== baseline.sortOrder;
}

export function FeeItemManagement({ orgId }: FeeItemManagementProps) {
  const queryClient = useQueryClient();
  const buildingTypesQuery = useBuildingTypes();
  const feeItemsQuery = useAllFeeItems();
  const [drafts, setDrafts] = useState<BuildingTypeDraft[] | null>(null);
  const [baseline, setBaseline] = useState<BuildingTypeDraft[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [editingTypeKey, setEditingTypeKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeeItemDraft | null>(null);
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const localSequence = useRef(0);

  if (drafts === null && buildingTypesQuery.data && feeItemsQuery.data) {
    const persisted = toDrafts(buildingTypesQuery.data, feeItemsQuery.data);
    const repaired = ensureRequiredItemsByType(persisted);
    setDrafts(repaired);
    setBaseline(cloneDrafts(persisted));
    setActiveKey(repaired[0]?.key ?? null);
  }

  const activeType = drafts?.find((type) => type.key === activeKey) ?? null;
  const deleteTarget = drafts?.find((type) => type.key === deleteTargetKey) ?? null;
  const dirty = useMemo(() => drafts !== null && JSON.stringify(comparable(drafts)) !== JSON.stringify(comparable(baseline)), [baseline, drafts]);
  const loading = buildingTypesQuery.isLoading || feeItemsQuery.isLoading || drafts === null;
  const failed = buildingTypesQuery.isError || feeItemsQuery.isError;

  const updateActiveType = (update: (type: BuildingTypeDraft) => BuildingTypeDraft) => {
    if (!activeKey) return;
    setDrafts((current) => current?.map((type) => (type.key === activeKey ? update(type) : type)) ?? current);
  };

  const addType = () => {
    const sequence = ++localSequence.current;
    const key = `local-type-${Date.now()}-${sequence}`;
    const nextType: BuildingTypeDraft = { key, label: "", sortOrder: drafts?.length ?? 0, items: createRequiredItems(key) };
    setDrafts((current) => [...(current ?? []), nextType]);
    setActiveKey(key);
    setEditingTypeKey(key); // + 클릭 즉시 탭에서 이름 편집(원본 동작)
  };

  const openAddItem = () => {
    if (!activeType) return;
    if (activeType.items.length >= MAX_FEE_ITEMS) {
      toast.error(`관리 항목은 최대 ${MAX_FEE_ITEMS}개까지 등록할 수 있어요`);
      return;
    }
    setEditingItem(null);
    setFormOpen(true);
  };

  const submitItem = (value: FeeItemFormValue) => {
    if (editingItem) {
      updateActiveType((type) => ({ ...type, items: type.items.map((item) => item.key === editingItem.key ? { ...item, ...value } : item) }));
    } else {
      const sequence = ++localSequence.current;
      updateActiveType((type) => ({
        ...type,
        items: [...type.items, { key: `local-item-${Date.now()}-${sequence}`, ...DEFAULT_FORM_VALUE, ...value, isRequired: false, sortOrder: type.items.length }],
      }));
    }
    setFormOpen(false);
  };

  const deleteItem = () => {
    if (!editingItem || !activeType) return;
    if (!window.confirm(`‘${editingItem.name}’ 항목을 삭제할까요?`)) return;
    const removed = editingItem;
    updateActiveType((type) => ({ ...type, items: type.items.filter((item) => item.key !== removed.key).map((item, index) => ({ ...item, sortOrder: index })) }));
    setFormOpen(false);
  };

  const reorderItems = (draggedKey: string, targetKey: string) => {
    updateActiveType((type) => {
      const required = type.items.filter((item) => item.isRequired);
      const optional = type.items.filter((item) => !item.isRequired);
      const from = optional.findIndex((item) => item.key === draggedKey);
      const to = optional.findIndex((item) => item.key === targetKey);
      if (from < 0 || to < 0) return type;
      const moved = [...optional];
      const [item] = moved.splice(from, 1);
      moved.splice(to, 0, item);
      return { ...type, items: [...required, ...moved].map((candidate, index) => ({ ...candidate, sortOrder: index })) };
    });
  };

  const requestDeleteType = async () => {
    if (!activeType) return;
    if (activeType.id != null) {
      try {
        const usage = await getBuildingTypeUsage(activeType.id);
        if (usage.buildings || usage.billing) {
          toast.error("건물 또는 부과 내역에 사용 중인 유형은 삭제할 수 없습니다.");
          return;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "유형의 사용 여부를 확인하지 못했습니다.");
        return;
      }
    }
    setDeleteTargetKey(activeType.key);
  };

  const removeTargetType = () => {
    if (!deleteTarget || !drafts) return;
    const index = drafts.findIndex((type) => type.key === deleteTarget.key);
    const next = drafts.filter((type) => type.key !== deleteTarget.key);
    setDrafts(next.map((type, typeIndex) => ({ ...type, sortOrder: typeIndex })));
    if (activeKey === deleteTarget.key) setActiveKey(next[Math.min(index, next.length - 1)]?.key ?? null);
    setDeleteTargetKey(null);
    toast.success("유형이 삭제되었습니다");
  };

  const validate = () => {
    if (!drafts?.length) return "최소 1개 유형은 있어야 해요";
    const typeNames = drafts.map((type) => type.label.trim());
    if (typeNames.some((name) => !name)) return "건물 유형명을 입력해 주세요.";
    if (new Set(typeNames).size !== typeNames.length) return "건물 유형명은 중복될 수 없습니다.";
    for (const type of drafts) {
      if (type.items.length > MAX_FEE_ITEMS) return `${type.label} 유형은 항목을 ${MAX_FEE_ITEMS}개까지만 등록할 수 있습니다.`;
      const itemNames = type.items.map((item) => item.name.trim());
      if (itemNames.some((name) => !name)) return "항목 명칭을 입력해 주세요";
      if (new Set(itemNames).size !== itemNames.length) return `${type.label} 유형에 중복된 항목 명칭이 있습니다.`;
      const requiredNames = new Set(type.items.filter((item) => item.isRequired).map((item) => item.name.trim()));
      if (REQUIRED_ITEM_NAMES.some((name) => !requiredNames.has(name))) {
        return `${type.label} 유형에는 전기·수도료·가스 필수 항목이 모두 필요합니다.`;
      }
    }
    return null;
  };

  const save = async () => {
    if (!drafts || saving) return;
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const currentPersistedIds = new Set(drafts.flatMap((type) => type.id == null ? [] : [type.id]));
      for (const previousType of baseline) {
        if (previousType.id != null && !currentPersistedIds.has(previousType.id)) await deleteBuildingType(previousType.id);
      }

      const savedTypeIds: number[] = [];
      const savedTypeIdByKey = new Map<string, number>();
      for (const [typeIndex, draftType] of drafts.entries()) {
        const previousType = baseline.find((type) => type.id === draftType.id);
        const savedType = draftType.id == null
          ? await createBuildingType({ orgId, label: draftType.label.trim(), sortOrder: typeIndex })
          : previousType && previousType.label.trim() !== draftType.label.trim()
            ? await renameBuildingType(draftType.id, draftType.label.trim())
            : { id: draftType.id };
        const typeId = savedType.id;
        savedTypeIds.push(typeId);
        savedTypeIdByKey.set(draftType.key, typeId);
        const seededItems = draftType.id == null ? await listFeeItems(typeId) : [];

        const currentItemIds = new Set(draftType.items.flatMap((item) => item.id == null ? [] : [item.id]));
        for (const previousItem of previousType?.items ?? []) {
          if (previousItem.id != null && !currentItemIds.has(previousItem.id)) await deleteFeeItem({ id: previousItem.id, isRequired: previousItem.isRequired });
        }

        const savedItemIds: number[] = [];
        for (const [itemIndex, draftItem] of draftType.items.entries()) {
          const input = { orgId, typeId, name: draftItem.name.trim(), rounding: draftItem.rounding, dailyProration: draftItem.dailyProration, carryOver: draftItem.carryOver, isRequired: draftItem.isRequired, sortOrder: itemIndex };
          if (draftItem.id == null) {
            const seededItem = seededItems.find((item) => item.name.trim() === input.name);
            if (seededItem) {
              await updateFeeItem(seededItem.id, input);
              savedItemIds.push(seededItem.id);
            } else {
              const created = await createFeeItem(input);
              savedItemIds.push(created.id);
            }
          } else {
            const previousItem = previousType?.items.find((item) => item.id === draftItem.id);
            if (previousItem && feeItemChanged({ ...draftItem, sortOrder: itemIndex }, previousItem)) await updateFeeItem(draftItem.id, input);
            savedItemIds.push(draftItem.id);
          }
        }
        if (savedItemIds.length) await reorderFeeItems(savedItemIds);
      }
      if (savedTypeIds.length) await reorderBuildingTypes(savedTypeIds);

      const [typesResult, itemsResult] = await Promise.all([buildingTypesQuery.refetch(), feeItemsQuery.refetch()]);
      if (!typesResult.data || !itemsResult.data) throw new Error("저장된 데이터를 다시 불러오지 못했습니다.");
      const persisted = toDrafts(typesResult.data, itemsResult.data);
      const refreshed = ensureRequiredItemsByType(persisted);
      const previousActiveId = activeType?.id ?? (activeType ? savedTypeIdByKey.get(activeType.key) : undefined);
      setDrafts(refreshed);
      setBaseline(cloneDrafts(persisted));
      setActiveKey(refreshed.find((type) => type.id === previousActiveId)?.key ?? refreshed[0]?.key ?? null);
      toast.success("변경 내용을 저장했습니다.");
    } catch (error) {
      const [typesResult, itemsResult] = await Promise.all([
        buildingTypesQuery.refetch(),
        feeItemsQuery.refetch(),
      ]);
      if (typesResult.data && itemsResult.data) {
        const persisted = toDrafts(typesResult.data, itemsResult.data);
        const refreshed = ensureRequiredItemsByType(persisted);
        setDrafts(refreshed);
        setBaseline(cloneDrafts(persisted));
        setActiveKey(refreshed[0]?.key ?? null);
      }
      toast.error(error instanceof Error ? error.message : "변경 내용을 저장하지 못했습니다.");
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: buildingTypeKeys.all, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: feeItemKeys.all, refetchType: "none" }),
      ]);
      setSaving(false);
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
  if (loading) return <div role="status" aria-label="관리 항목 불러오는 중" className="flex min-h-[420px] items-center justify-center"><Spinner /></div>;

  return (
    <div className="min-h-[calc(100vh-62px)] bg-bg">
      <BuildingTypeTabs
        types={drafts ?? []}
        activeKey={activeKey}
        editingKey={editingTypeKey}
        onSelect={setActiveKey}
        onAdd={addType}
        onLabelChange={(key, label) => setDrafts((current) => current?.map((type) => type.key === key ? { ...type, label } : type) ?? current)}
        onFinishEditing={() => {
          if (editingTypeKey) {
            setDrafts((current) => current?.map((type) => type.key === editingTypeKey ? { ...type, label: type.label.trim() || baseline.find((item) => item.id === type.id)?.label || "유형명" } : type) ?? current);
          }
          setEditingTypeKey(null);
        }}
      />
      <main className="p-6 pt-[22px]">
        {activeType ? (
          <FeeItemCard
            type={activeType}
            dirty={dirty}
            saving={saving}
            onAddItem={openAddItem}
            onEditItem={(item) => { setEditingItem(item); setFormOpen(true); }}
            onReorder={reorderItems}
            onDeleteType={() => void requestDeleteType()}
            onSave={() => void save()}
            onLabelChange={(key, label) => setDrafts((current) => current?.map((type) => (type.key === key ? { ...type, label } : type)) ?? current)}
            onFinishEditing={() => setDrafts((current) => current?.map((type) => (type.key === activeType.key ? { ...type, label: type.label.trim() || baseline.find((item) => item.id === type.id)?.label || "유형명" } : type)) ?? current)}
          />
        ) : (
          <div className="rounded-2xl bg-white p-10 shadow-card"><EmptyState message="등록된 건물 유형이 없습니다. 상단 + 버튼으로 유형을 추가해 주세요." /></div>
        )}
      </main>
      <FeeItemRightRail />
      <FeeItemFormDialog
        key={`${formOpen}-${editingItem?.key ?? "new"}`}
        open={formOpen}
        item={editingItem}
        existingNames={(activeType?.items ?? []).filter((item) => item.key !== editingItem?.key).map((item) => item.name)}
        onClose={() => setFormOpen(false)}
        onSubmit={submitItem}
        onDelete={deleteItem}
      />
      <DeleteBuildingTypeDialog
        open={deleteTarget != null}
        label={deleteTarget?.label ?? ""}
        itemCount={deleteTarget?.items.length ?? 0}
        onClose={() => setDeleteTargetKey(null)}
        onConfirm={removeTargetType}
      />
    </div>
  );
}
