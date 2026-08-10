"use client";
import React, { useState } from "react";
import { Panel, Button, DataTable, EmptyState, Spinner } from "@/components/common";
import { Modal } from "@/components/common/Modal";
import { useOccupancies, useDeleteOccupancy } from "@/hooks/reactquery/occupancies";
import type { Occupancy } from "@/hooks/reactquery/occupancies";
import { OccupancyFormModal } from "./OccupancyFormModal";
import { toast } from "sonner";

interface Props {
  unitId: number;
}

const STATUS_LABEL: Record<string, string> = {
  occupied: "입주중",
  vacant: "공실",
  moving_out: "퇴거예정",
};

const COLUMNS = [
  { key: "tenantName", label: "입주자명" },
  { key: "phone", label: "연락처" },
  { key: "status", label: "상태" },
  { key: "moveInDate", label: "입주일" },
  { key: "moveOutDate", label: "퇴거일" },
  { key: "actions", label: "" },
];

export function OccupancyList({ unitId }: Props) {
  const { data: occupancies = [], isLoading } = useOccupancies(unitId);
  const deleteOccupancy = useDeleteOccupancy();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Occupancy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Occupancy | null>(null);

  // Keep lookup map so rows stay ReactNode-only
  const occupancyById = React.useMemo(
    () => Object.fromEntries(occupancies.map((o) => [o.id, o])),
    [occupancies]
  );

  const rows: Record<string, React.ReactNode>[] = occupancies.map((o) => ({
    _id: o.id,
    tenantName: o.tenantName ?? "-",
    phone: o.phone ?? "-",
    status: STATUS_LABEL[o.status] ?? o.status,
    moveInDate: o.moveInDate ?? "-",
    moveOutDate: o.moveOutDate ?? "-",
    actions: (
      <button
        className="rounded px-2 py-0.5 text-xs font-medium text-red-500 hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          setDeleteTarget(o);
        }}
        aria-label={`${o.tenantName ?? o.id} 삭제`}
      >
        삭제
      </button>
    ),
  }));

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, React.ReactNode>) => {
    setEditing(occupancyById[row._id as number] ?? null);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOccupancy.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  return (
    <>
      <Panel
        title="입주 정보"
        action={
          <Button variant="primary" onClick={openCreate}>
            + 입주 등록
          </Button>
        }
      >
        {isLoading ? (
          <Spinner />
        ) : occupancies.length === 0 ? (
          <EmptyState message="등록된 입주 정보가 없습니다." />
        ) : (
          <DataTable columns={COLUMNS} rows={rows} onRowClick={openEdit} />
        )}
      </Panel>

      <OccupancyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        unitId={unitId}
        editing={editing}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="입주 정보 삭제"
      >
        <p className="text-sm text-t1">
          이 입주자 정보를 삭제할까요?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDeleteConfirm}
            disabled={deleteOccupancy.isPending}
          >
            확인
          </Button>
        </div>
      </Modal>
    </>
  );
}
