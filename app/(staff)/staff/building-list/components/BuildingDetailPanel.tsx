"use client";
import React from "react";
import { Panel, Button } from "@/components/common";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import type { Building } from "@/hooks/reactquery/buildings";

interface Props {
  building: Building;
  onEdit: () => void;
}

export function BuildingDetailPanel({ building, onEdit }: Props) {
  const { data: buildingTypes = [] } = useBuildingTypes();
  const typeLabel = building.typeId
    ? (buildingTypes.find((t) => t.id === building.typeId)?.label ?? "-")
    : "-";

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "코드", value: building.code },
    { label: "건물명", value: building.name },
    { label: "유형", value: typeLabel },
    { label: "주소", value: building.address },
    { label: "건물주명", value: building.ownerName },
    { label: "건물주 연락처", value: building.ownerPhone },
    { label: "관리자", value: building.managerName },
    { label: "메모", value: building.memo },
  ];

  return (
    <Panel
      title="건물 상세"
      action={
        <Button variant="ghost" onClick={onEdit}>
          수정
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {fields.map((f) => (
          <React.Fragment key={f.label}>
            <dt className="font-semibold text-t2">{f.label}</dt>
            <dd className="text-t1">{f.value ?? "-"}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Panel>
  );
}
