"use client";

import { useConfirm } from "@/components/common/ConfirmProvider";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import type { OrganizationStatus } from "@/hooks/reactquery/platform";
import { ADMIN_DROPDOWN_MENU_CLASS } from "../../../../_components/adminDropdownClasses";

const OPTIONS: { value: OrganizationStatus; label: string }[] = [
  { value: "trial", label: "체험" },
  { value: "active", label: "운영 중" },
  { value: "suspended", label: "정지" },
];

interface Props {
  status: OrganizationStatus;
  onChange: (next: OrganizationStatus) => Promise<void> | void;
  isPending: boolean;
}

export function OrgStatusControl({ status, onChange, isPending }: Props) {
  const confirm = useConfirm();
  return (
    <div className="[&_.uc-dd-btn]:h-8 [&_.uc-dd-btn]:rounded-[9px] [&_.uc-dd-btn]:px-[10px] [&_.uc-dd-btn]:text-[12.5px] [&_.uc-dd-btn]:font-bold [&_.uc-dd-btn]:text-t2 [&_.uc-dd-btn]:hover:border-line [&_.uc-dd-btn]:hover:shadow-none [&_.uc-dd.open_.uc-dd-btn]:border-line [&_.uc-dd.open_.uc-dd-btn]:shadow-none [&_.uc-dd-btn_svg]:h-[14px] [&_.uc-dd-btn_svg]:w-[14px]">
      <CustomDropdown
        chevron="rotate"
        chevronMs={180}
        ariaLabel="조직 상태 변경"
        value={status}
        options={OPTIONS}
        disabled={isPending}
        compact
        position="fixed"
        menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
        onChange={(value) => {
          const next = value as OrganizationStatus;
          if (next === status) return;
          const message =
            next === "suspended"
              ? "조직을 정지하면 해당 업체의 사무·현장 관리자와 세입자 앱 접속이 제한됩니다. 계속할까요?"
              : `조직 상태를 '${OPTIONS.find((option) => option.value === next)?.label}'(으)로 변경할까요?`;
          void (async () => {
            const ok = await confirm({ title: "조직 상태 변경", description: message, confirmLabel: "변경" });
            if (!ok) return;
            void onChange(next);
          })();
        }}
      />
    </div>
  );
}
