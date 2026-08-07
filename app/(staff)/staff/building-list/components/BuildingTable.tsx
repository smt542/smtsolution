"use client";
import React from "react";
import { DataTable, SearchBar, EmptyState, Spinner } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import type { Building } from "@/hooks/reactquery/buildings";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: number | null;
  onSelect: (building: Building) => void;
}

const COLUMNS = [
  { key: "code", label: "코드" },
  { key: "name", label: "건물명" },
  { key: "type", label: "유형" },
  { key: "address", label: "주소" },
  { key: "ownerName", label: "건물주명" },
];

export function BuildingTable({ search, onSearchChange, selectedId, onSelect }: Props) {
  const { data: buildings = [], isLoading } = useBuildings(search || undefined);
  const { data: buildingTypes = [] } = useBuildingTypes();

  const typeMap = React.useMemo(
    () => Object.fromEntries(buildingTypes.map((t) => [t.id, t.label])),
    [buildingTypes]
  );

  const buildingById = React.useMemo(
    () => Object.fromEntries(buildings.map((b) => [b.id, b])),
    [buildings]
  );

  const rows: Record<string, React.ReactNode>[] = buildings.map((b) => ({
    _id: b.id,
    code: b.code,
    name: b.name,
    type: b.typeId ? (typeMap[b.typeId] ?? "-") : "-",
    address: b.address ?? "-",
    ownerName: b.ownerName ?? "-",
  }));

  return (
    <div className="flex flex-col gap-2">
      <SearchBar value={search} onChange={onSearchChange} placeholder="건물명 또는 주소 검색" />
      {isLoading ? (
        <Spinner />
      ) : buildings.length === 0 ? (
        <EmptyState message="등록된 건물이 없습니다." />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          onRowClick={(row) => {
            const b = buildingById[row._id as number];
            if (b) onSelect(b);
          }}
        />
      )}
    </div>
  );
}
