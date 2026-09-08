"use client";
import React, { useEffect, useState } from "react";
import { Modal, Button } from "@/components/common";
import type { NewOccupancy } from "@/hooks/reactquery/billing";

interface Props {
  open: boolean;
  units: NewOccupancy[];
  pending: boolean;
  onConfirm: (unitIds: number[]) => void;
  onClose: () => void;
}

export function NewTenantChargeModal({ open, units, pending, onConfirm, onClose }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(new Set(units.map((u) => u.unitId)));
    }
  }, [open, units]);

  const toggle = (unitId: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });

  const selectedIds = units.filter((u) => checked.has(u.unitId)).map((u) => u.unitId);

  return (
    <Modal open={open} onClose={onClose} title="신규 입주자 당월 부과">
      <p className="mb-1 text-sm font-semibold text-t1">이번 달 관리비를 부과하시겠습니까?</p>
      <p className="mb-3 text-xs text-t3">부과 확정 이후 등록된 신규 세대입니다. 부과할 세대를 선택하세요.</p>
      <ul className="mb-4 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {units.map((u) => (
          <li key={u.unitId} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              aria-label={`${u.unitNo} 부과 선택`}
              checked={checked.has(u.unitId)}
              onChange={() => toggle(u.unitId)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-t1">
              {u.dong ? `${u.dong} ` : ""}
              {u.unitNo}호
            </span>
            <span className="text-sm text-t2">{u.tenantName ?? "-"}</span>
            {u.moveInDate && <span className="ml-auto text-xs text-t3">입주 {u.moveInDate}</span>}
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button variant="primary" disabled={pending || selectedIds.length === 0} onClick={() => onConfirm(selectedIds)}>
          부과
        </Button>
      </div>
    </Modal>
  );
}
