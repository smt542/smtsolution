"use client";
import React, { useState } from "react";
import { Panel, Button } from "@/components/common";
import { Modal } from "@/components/common/Modal";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useDeleteBuilding } from "@/hooks/reactquery/buildings";
import type { Building } from "@/hooks/reactquery/buildings";
import { toast } from "sonner";

interface Props {
  building: Building;
  onEdit: () => void;
  onDeleted: () => void;
}

export function BuildingDetailPanel({ building, onEdit, onDeleted }: Props) {
  const { data: buildingTypes = [] } = useBuildingTypes();
  const deleteBuilding = useDeleteBuilding();
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const handleDelete = async () => {
    try {
      await deleteBuilding.mutateAsync(building.id);
      setConfirmOpen(false);
      onDeleted();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  return (
    <>
      <Panel
        title="건물 상세"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onEdit}>
              수정
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
              삭제
            </Button>
          </div>
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

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="건물 삭제">
        <p className="text-sm text-t1">
          이 건물의 호실·입주자도 함께 삭제됩니다. 삭제할까요?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDelete}
            disabled={deleteBuilding.isPending}
          >
            확인
          </Button>
        </div>
      </Modal>
    </>
  );
}
