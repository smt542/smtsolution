"use client";

import { appToast as toast } from "@/hooks/common/useAppToast";
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
  const important = building?.setupConfirmRequired ?? false;

  const toggleImportant = async (required: boolean) => {
    if (!building) return;
    try {
      await setImportant.mutateAsync({ id: building.id, required });
    } catch (error) {
      toast.error(error, "중요 건물 설정을 저장하지 못했어요.");
    }
  };

  return (
    <section className="flex h-[168px] shrink-0 flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
      <div className="flex shrink-0 items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[14px] font-semibold text-t1">부과시 참조사항</h2>
        <label
          className={`ml-auto flex flex-none cursor-pointer select-none items-center gap-[7px] text-[12px] font-bold ${
            important ? "text-t1" : "text-t3"
          }`}
        >
          <span
            className={`relative size-[17px] flex-none rounded-[5px] border-2 ${
              important
                ? "border-teal bg-teal after:absolute after:left-1/2 after:top-[46%] after:h-[9px] after:w-[5px] after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:content-['']"
                : "border-line"
            }`}
          />
          <input
            key={`${building?.id ?? "none"}:${important}`}
            type="checkbox"
            aria-label="중요 건물"
            defaultChecked={important}
            disabled={!building || setImportant.isPending}
            onChange={(event) => void toggleImportant(event.target.checked)}
            className="sr-only"
          />
          중요 건물
          {setImportant.isPending ? (
            <span role="status" aria-label="중요 건물 설정 저장 중" className="sr-only">저장 중…</span>
          ) : null}
        </label>
      </div>

      {building ? (
        editing ? (
          <textarea
            aria-label="부과시 참조사항"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="관리비 부과 시 참고할 내용을 입력해 주세요"
            className="m-[12px] mt-0 min-h-0 flex-1 resize-none rounded-[10px] border border-teal bg-white px-[12px] py-[11px] text-[13.5px] font-normal leading-[1.62] text-t1 outline-none"
          />
        ) : building.billingNote ? (
          <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-[16px] pb-[15px] pt-[13px] text-[13.5px] font-normal leading-[1.62] text-t1">
            {building.billingNote}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto px-[16px] pb-[15px] pt-[13px] text-[13.5px] font-normal leading-[1.62] text-t4">
            등록된 참조사항이 없어요
          </div>
        )
      ) : (
        <p className="flex min-h-0 flex-1 items-center px-[16px] text-[13.5px] font-normal text-t4">
          건물을 선택하면 표시돼요
        </p>
      )}
    </section>
  );
}
