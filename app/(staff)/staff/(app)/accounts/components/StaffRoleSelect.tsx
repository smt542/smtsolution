"use client";
import { Checkbox } from "@/components/common";
import type { StaffRole } from "@/hooks/reactquery/staffRoles";

interface Props {
  roles: StaffRole[];
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
}

export function StaffRoleSelect({ roles, value, onChange, disabled }: Props) {
  const toggle = (id: number) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  if (roles.length === 0) return <p className="text-xs text-t4">등록된 담당역할이 없습니다.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {roles.map((r) => (
        <Checkbox key={r.id} label={r.label} checked={value.includes(r.id)} disabled={disabled}
          onChange={() => toggle(r.id)} />
      ))}
    </div>
  );
}
