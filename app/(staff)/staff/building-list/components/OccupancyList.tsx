"use client";
import React, { useState } from "react";
import { Panel, Button, DataTable, EmptyState, Spinner } from "@/components/common";
import { useOccupancies } from "@/hooks/reactquery/occupancies";
import type { Occupancy } from "@/hooks/reactquery/occupancies";
import { OccupancyFormModal } from "./OccupancyFormModal";

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
];

export function OccupancyList({ unitId }: Props) {
  const { data: occupancies = [], isLoading } = useOccupancies(unitId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Occupancy | null>(null);

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
  }));

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, React.ReactNode>) => {
    setEditing(occupancyById[row._id as number] ?? null);
    setModalOpen(true);
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
    </>
  );
}
