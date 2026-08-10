"use client";
import { Checkbox } from "@/components/common";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/auth/permissions";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  /** 마스터(전체 통과)면 모두 체크·비활성 표시 */
  allGranted?: boolean;
}

export function PermissionChecklist({ value, onChange, disabled, allGranted }: Props) {
  const toggle = (k: ModuleKey) => {
    if (disabled || allGranted) return;
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {MODULE_KEYS.map((k) => (
        <Checkbox
          key={k}
          label={MODULE_LABELS[k]}
          checked={allGranted || value.includes(k)}
          disabled={disabled || allGranted}
          onChange={() => toggle(k)}
        />
      ))}
    </div>
  );
}
