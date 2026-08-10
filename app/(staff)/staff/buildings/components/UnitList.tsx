"use client";
import React, { useState } from "react";
import { Panel, Button, DataTable, EmptyState, Spinner } from "@/components/common";
import { Modal } from "@/components/common/Modal";
import { useUnits, useDeleteUnit } from "@/hooks/reactquery/units";
import type { Unit } from "@/hooks/reactquery/units";
import { UnitFormModal } from "./UnitFormModal";
import { OccupancyList } from "./OccupancyList";
import { toast } from "sonner";

interface Props {
  buildingId: number;
}

const COLUMNS = [
  { key: "unitNo", label: "호실" },
  { key: "dong", label: "동" },
  { key: "areaPyeong", label: "면적(평)" },
  { key: "roomCount", label: "방 수" },
  { key: "actions", label: "" },
];

export function UnitList({ buildingId }: Props) {
  const { data: units = [], isLoading } = useUnits(buildingId);
  const deleteUnit = useDeleteUnit();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  // Keep a separate lookup map keyed by row index so DataTable rows stay ReactNode-only
  const unitById = React.useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u])),
    [units]
  );

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setModalOpen(true);
  };

  // Row click selects the unit to reveal OccupancyList — does NOT open the modal
  const handleRowClick = (row: Record<string, React.ReactNode>) => {
    const unit = unitById[row._id as number] ?? null;
    setSelectedUnit(unit);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUnit.mutateAsync(deleteTarget.id);
      if (selectedUnit?.id === deleteTarget.id) setSelectedUnit(null);
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const rows: Record<string, React.ReactNode>[] = units.map((u) => ({
    _id: u.id,
    unitNo: u.unitNo,
    dong: u.dong ?? "-",
    areaPyeong: u.areaPyeong ?? "-",
    roomCount: u.roomCount != null ? String(u.roomCount) : "-",
    actions: (
      <div className="flex gap-1">
        <button
          className="rounded px-2 py-0.5 text-xs font-medium text-brand hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            openEdit(u);
          }}
          aria-label={`${u.unitNo} 수정`}
        >
          수정
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs font-medium text-red-500 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(u);
          }}
          aria-label={`${u.unitNo} 삭제`}
        >
          삭제
        </button>
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="호실 목록"
        action={
          <Button variant="primary" onClick={openCreate}>
            + 호수·입주민 등록
          </Button>
        }
      >
        {isLoading ? (
          <Spinner />
        ) : units.length === 0 ? (
          <EmptyState message="등록된 호실이 없습니다." />
        ) : (
          <DataTable columns={COLUMNS} rows={rows} onRowClick={handleRowClick} />
        )}
      </Panel>

      {selectedUnit && <OccupancyList unitId={selectedUnit.id} />}

      <UnitFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        buildingId={buildingId}
        editing={editing}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="호실 삭제"
      >
        <p className="text-sm text-t1">
          이 호실의 입주자 정보도 함께 삭제됩니다.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDeleteConfirm}
            disabled={deleteUnit.isPending}
          >
            확인
          </Button>
        </div>
      </Modal>
    </div>
  );
}
