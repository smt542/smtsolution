"use client";
import { useConfirm } from "@/components/common/ConfirmProvider";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";

interface Props {
  org: PlatformOrganization;
  onEdit: () => void;
  onToggleDeleted: (deleted: boolean) => void;
  disabled: boolean;
  isPending: boolean;
}

const btn =
  "inline-flex h-8 cursor-pointer items-center rounded-[9px] border border-line bg-surface px-2.5 text-[12.5px] font-bold outline-none hover:bg-bg focus:border-blue focus:ring-[3px] focus:ring-blue-t disabled:opacity-50";

export function OrgRowActions({ org, onEdit, onToggleDeleted, disabled, isPending }: Props) {
  const confirm = useConfirm();
  if (org.deletedAt) {
    return (
      <button
        type="button"
        onClick={() => onToggleDeleted(false)}
        disabled={disabled}
        className={`${btn} text-blue`}
      >
        {isPending ? "복구 중…" : "복구"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onEdit} className={`${btn} text-t2`}>
        수정
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: "조직 해지",
            description: `'${org.name}' 조직을 해지할까요? 사용자 접속이 제한되고 목록에서 숨겨집니다. 데이터는 삭제되지 않으며 복구할 수 있습니다.`,
            confirmLabel: "해지",
            variant: "danger",
          });
          if (!ok) return;
          onToggleDeleted(true);
        }}
        disabled={disabled}
        className={`${btn} text-red`}
      >
        {isPending ? "해지 중…" : "해지"}
      </button>
    </div>
  );
}
