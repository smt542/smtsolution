"use client";

import { toast } from "sonner";
import { useSetBuildingSetupConfirm, type Building } from "@/hooks/reactquery/buildings";

interface BillingReferencePanelProps {
  building: Building | null;
  editing: boolean;
  note: string;
  onNoteChange: (value: string) => void;
}

export function BillingReferencePanel({
  building,
  editing,
  note,
  onNoteChange,
}: BillingReferencePanelProps) {
  const setImportant = useSetBuildingSetupConfirm();

  const toggleImportant = async (required: boolean) => {
    if (!building) return;
    try {
      await setImportant.mutateAsync({ id: building.id, required });
      toast.success(required ? "중요 건물로 지정했습니다." : "중요 건물 지정을 해제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "중요 건물 설정을 저장하지 못했습니다.");
    }
  };

  return (
    <section className="h-[168px] shrink-0 overflow-hidden rounded-[16px] bg-surface shadow-card">
      <div className="flex h-[48px] items-center gap-[10px] border-b border-line2 px-[18px]">
        <h2 className="text-[14px] font-semibold text-t1">부과시 참조사항</h2>
        <label className="ml-auto flex items-center gap-[7px] text-[12px] font-bold text-t3">
          <input
            key={`${building?.id ?? "none"}:${building?.setupConfirmRequired ?? false}`}
            type="checkbox"
            aria-label="중요 건물"
            defaultChecked={building?.setupConfirmRequired ?? false}
            disabled={!building || setImportant.isPending}
            onChange={(event) => void toggleImportant(event.target.checked)}
            className="size-[17px] appearance-none rounded-[5px] border-2 border-line checked:border-teal checked:bg-teal disabled:opacity-50"
          />
          중요 건물
        </label>
      </div>

      {building ? (
        <textarea
          aria-label="부과시 참조사항"
          readOnly={!editing}
          value={editing ? note : building.billingNote ?? ""}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={editing ? "관리비 부과 시 참고할 내용을 입력하세요" : "등록된 내용이 없습니다"}
          className={`m-[12px] h-[108px] w-[calc(100%-24px)] resize-none rounded-[10px] px-[12px] py-[11px] text-[13.5px] leading-[21.87px] outline-none ${
            editing
              ? "border border-teal bg-white text-t1"
              : "border border-transparent bg-white text-t1"
          }`}
        />
      ) : (
        <p className="flex h-[120px] items-center px-[18px] text-[13px] text-t4">건물을 선택하면 표시돼요</p>
      )}
    </section>
  );
}
