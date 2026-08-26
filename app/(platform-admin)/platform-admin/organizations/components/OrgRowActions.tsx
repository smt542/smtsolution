"use client";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";

interface Props {
  org: PlatformOrganization;
  onEdit: () => void;
  onToggleDeleted: (deleted: boolean) => void;
  isPending: boolean;
}

const btn =
  "rounded-lg border border-line px-2.5 py-1 text-xs font-bold hover:bg-bg/60 disabled:opacity-50";

export function OrgRowActions({ org, onEdit, onToggleDeleted, isPending }: Props) {
  if (org.deletedAt) {
    return (
      <button
        type="button"
        onClick={() => onToggleDeleted(false)}
        disabled={isPending}
        className={`${btn} text-blue`}
      >
        복구
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
        onClick={() => {
          if (window.confirm(
            `'${org.name}' 조직을 해지할까요? 사용자 접속이 제한되고 목록에서 숨겨집니다. 데이터는 삭제되지 않으며 복구할 수 있습니다.`,
          ))
            onToggleDeleted(true);
        }}
        disabled={isPending}
        className={`${btn} text-danger`}
      >
        해지
      </button>
    </div>
  );
}
