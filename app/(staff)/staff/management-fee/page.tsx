"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { BuildingTypeTabs } from "./components/BuildingTypeTabs";
import { FeeItemList } from "./components/FeeItemList";
import { FeeItemFormModal } from "./components/FeeItemFormModal";
import { useBuildingTypes, useCreateBuildingType, useRenameBuildingType, useDeleteBuildingType } from "@/hooks/reactquery/buildingTypes";
import { useFeeItems, useCreateFeeItem, useUpdateFeeItem, useDeleteFeeItem, useReorderFeeItems } from "@/hooks/reactquery/feeItems";
import { useMe } from "@/hooks/reactquery/auth";
import type { FeeItem } from "@/hooks/reactquery/feeItems";
import { feeItemSchema } from "@/components/forms/schema/feeItem";
import { z } from "zod";
type FeeItemFormValues = z.output<typeof feeItemSchema>;

export default function FeeItemPage() {
  const { data: me } = useMe();
  const orgId = me?.orgId;

  const { data: buildingTypes = [], isLoading: typesLoading } = useBuildingTypes();
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);

  // Resolve active type: use state if valid, else first type
  const resolvedTypeId =
    activeTypeId && buildingTypes.some((t) => t.id === activeTypeId)
      ? activeTypeId
      : (buildingTypes[0]?.id ?? null);

  const { data: feeItems = [], isLoading: itemsLoading } = useFeeItems(resolvedTypeId ?? 0);

  const createType = useCreateBuildingType();
  const renameType = useRenameBuildingType();
  const deleteType = useDeleteBuildingType();
  const createItem = useCreateFeeItem();
  const updateItem = useUpdateFeeItem();
  const deleteItem = useDeleteFeeItem();
  const reorderItems = useReorderFeeItems();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeeItem | null>(null);

  const openCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item: FeeItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleAddType = async (label: string) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await createType.mutateAsync({ orgId, label });
    } catch (e: any) {
      toast.error(e.message ?? "유형 추가 실패");
    }
  };

  const handleRenameType = async (id: number, label: string) => {
    try {
      await renameType.mutateAsync({ id, label });
    } catch (e: any) {
      toast.error(e.message ?? "유형 이름 변경 실패");
    }
  };

  const handleDeleteType = async (id: number) => {
    if (buildingTypes.length <= 1) {
      toast.error("최소 1개의 유형이 필요합니다");
      return;
    }
    try {
      await deleteType.mutateAsync(id);
      // If deleted active tab, reset to first remaining
      if (id === resolvedTypeId) setActiveTypeId(null);
    } catch (e: any) {
      toast.error(e.message ?? "유형 삭제 실패");
    }
  };

  const handleDeleteItem = async (item: FeeItem) => {
    if (item.isRequired) {
      toast.error("필수 항목은 삭제할 수 없습니다");
      return;
    }
    try {
      await deleteItem.mutateAsync({ id: item.id, isRequired: item.isRequired });
    } catch (e: any) {
      toast.error(e.message ?? "항목 삭제 실패");
    }
  };

  const handleMoveUp = async (item: FeeItem) => {
    const group = item.isRequired
      ? feeItems.filter((i) => i.isRequired)
      : feeItems.filter((i) => !i.isRequired);
    const idx = group.findIndex((i) => i.id === item.id);
    if (idx <= 0) return;
    const newGroup = [...group];
    [newGroup[idx - 1], newGroup[idx]] = [newGroup[idx], newGroup[idx - 1]];
    const required = item.isRequired ? newGroup : feeItems.filter((i) => i.isRequired);
    const optional = item.isRequired ? feeItems.filter((i) => !i.isRequired) : newGroup;
    const orderedIds = [...required, ...optional].map((i) => i.id);
    try {
      await reorderItems.mutateAsync(orderedIds);
    } catch (e: any) {
      toast.error(e.message ?? "순서 변경 실패");
    }
  };

  const handleMoveDown = async (item: FeeItem) => {
    const group = item.isRequired
      ? feeItems.filter((i) => i.isRequired)
      : feeItems.filter((i) => !i.isRequired);
    const idx = group.findIndex((i) => i.id === item.id);
    if (idx >= group.length - 1) return;
    const newGroup = [...group];
    [newGroup[idx], newGroup[idx + 1]] = [newGroup[idx + 1], newGroup[idx]];
    const required = item.isRequired ? newGroup : feeItems.filter((i) => i.isRequired);
    const optional = item.isRequired ? feeItems.filter((i) => !i.isRequired) : newGroup;
    const orderedIds = [...required, ...optional].map((i) => i.id);
    try {
      await reorderItems.mutateAsync(orderedIds);
    } catch (e: any) {
      toast.error(e.message ?? "순서 변경 실패");
    }
  };

  const handleSubmit = async (values: FeeItemFormValues) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    if (!resolvedTypeId) { toast.error("유형을 선택해 주세요"); return; }
    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          input: { ...values, orgId, typeId: resolvedTypeId, isRequired: editingItem.isRequired },
        });
      } else {
        await createItem.mutateAsync({
          ...values,
          orgId,
          typeId: resolvedTypeId,
          isRequired: false,
          rounding: values.rounding ?? "round",
          dailyProration: values.dailyProration ?? false,
          carryOver: values.carryOver ?? false,
        });
      }
    } catch (e: any) {
      toast.error(e.message ?? "저장 실패");
      throw e;
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-0 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">부과항목 관리</h1>
        <Button variant="primary" onClick={openCreate} disabled={!resolvedTypeId}>
          ＋ 항목 추가
        </Button>
      </div>

      <BuildingTypeTabs
        types={buildingTypes}
        activeId={resolvedTypeId}
        onChange={setActiveTypeId}
        onAdd={handleAddType}
        onRename={handleRenameType}
        onDelete={handleDeleteType}
      />

      <div className="mt-4">
        <FeeItemList
          items={feeItems}
          isLoading={itemsLoading || typesLoading}
          onEdit={openEdit}
          onDelete={handleDeleteItem}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>

      <FeeItemFormModal
        open={modalOpen}
        onClose={closeModal}
        editing={editingItem}
        onSubmit={handleSubmit}
        isPending={createItem.isPending || updateItem.isPending}
      />
    </div>
  );
}
