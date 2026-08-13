"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Modal, Button } from "@/components/common";
import { FeeItemList } from "./FeeItemList";
import { FeeItemFormModal } from "./FeeItemFormModal";
import {
  useFeeItems,
  useCreateFeeItem,
  useUpdateFeeItem,
  useDeleteFeeItem,
  useReorderFeeItems,
  type FeeItem,
} from "@/hooks/reactquery/feeItems";
import { feeItemSchema } from "@/components/forms/schema/feeItem";
import { z } from "zod";
type FeeItemFormValues = z.output<typeof feeItemSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: number;
  typeId: number;
  typeLabel: string;
}

export function ItemManageModal({ open, onClose, orgId, typeId, typeLabel }: Props) {
  const { data: feeItems = [], isLoading } = useFeeItems(typeId);
  const createItem = useCreateFeeItem();
  const updateItem = useUpdateFeeItem();
  const deleteItem = useDeleteFeeItem();
  const reorderItems = useReorderFeeItems();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeItem | null>(null);

  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

  const handleSubmit = async (values: FeeItemFormValues) => {
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, input: { ...values, orgId, typeId, isRequired: editing.isRequired } });
      } else {
        await createItem.mutateAsync({
          ...values,
          orgId,
          typeId,
          isRequired: false,
          rounding: values.rounding ?? "round",
          dailyProration: values.dailyProration ?? false,
          carryOver: values.carryOver ?? false,
        });
      }
    } catch (e) {
      err(e);
      throw e;
    }
  };

  const handleDelete = async (item: FeeItem) => {
    if (item.isRequired) { toast.error("필수 항목은 삭제할 수 없습니다"); return; }
    try { await deleteItem.mutateAsync({ id: item.id, isRequired: item.isRequired }); } catch (e) { err(e); }
  };

  const move = async (item: FeeItem, dir: -1 | 1) => {
    const group = feeItems.filter((i) => i.isRequired === item.isRequired);
    const idx = group.findIndex((i) => i.id === item.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= group.length) return;
    const ng = [...group];
    [ng[idx], ng[swap]] = [ng[swap], ng[idx]];
    const required = item.isRequired ? ng : feeItems.filter((i) => i.isRequired);
    const optional = item.isRequired ? feeItems.filter((i) => !i.isRequired) : ng;
    try { await reorderItems.mutateAsync([...required, ...optional].map((i) => i.id)); } catch (e) { err(e); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`관리비 항목 관리 · ${typeLabel}`}>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
          ＋ 항목 추가
        </Button>
      </div>
      <FeeItemList
        items={feeItems}
        isLoading={isLoading}
        onEdit={(i) => { setEditing(i); setFormOpen(true); }}
        onDelete={handleDelete}
        onMoveUp={(i) => move(i, -1)}
        onMoveDown={(i) => move(i, 1)}
      />
      <FeeItemFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        onSubmit={handleSubmit}
        isPending={createItem.isPending || updateItem.isPending}
      />
    </Modal>
  );
}
