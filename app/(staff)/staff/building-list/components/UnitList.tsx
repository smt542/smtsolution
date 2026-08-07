"use client";
import React, { useState } from "react";
import { Panel, Button, DataTable, EmptyState, Spinner } from "@/components/common";
import { useUnits } from "@/hooks/reactquery/units";
import type { Unit } from "@/hooks/reactquery/units";
import { UnitFormModal } from "./UnitFormModal";
import { OccupancyList } from "./OccupancyList";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

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

  const rows: Record<string, React.ReactNode>[] = units.map((u) => ({
    _id: u.id,
    unitNo: u.unitNo,
    dong: u.dong ?? "-",
    areaPyeong: u.areaPyeong ?? "-",
    roomCount: u.roomCount != null ? String(u.roomCount) : "-",
    actions: (
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
    </div>
  );
}
