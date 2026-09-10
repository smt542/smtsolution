"use client";

import type { BillTarget } from "@/hooks/reactquery/bill";
import type { BillBuilding } from "../../types";
import { ModalActionButton } from "./OutputModalPrimitives";

interface FaxConfirmationModalProps {
  building?: BillBuilding;
  targets: BillTarget[];
  period: string;
  senderLabel: string;
  recipient: string;
  isPending: boolean;
  error: boolean;
  onCancel: () => void;
  onSend: () => void;
}

export function FaxConfirmationModal({ building, targets, period, senderLabel, recipient, isPending, error, onCancel, onSend }: FaxConfirmationModalProps) {
  const [year, month] = period.split("-");
  const validRecipient = /\d{2,4}-?\d{3,4}-?\d{4}/.test(recipient);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,31,40,0.45)] p-3 print:hidden" role="dialog" aria-modal="true" aria-labelledby="fax-confirm-title">
      <div className="h-[410px] w-[440px] overflow-hidden rounded-[20px] bg-white px-[26px] pb-[24px] pt-[28px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]">
        <h3 id="fax-confirm-title" className="text-[16.5px] font-extrabold leading-[21px] tracking-[-0.02em] text-[#191f28]">팩스 발송</h3>

        <label className="mt-[16px] block text-[11px] font-bold text-[#4e5968]">
          발신 팩스번호
          <span className="relative mt-[6px] block h-[40px]">
            <select aria-label="발신 팩스번호" className="h-full w-full appearance-none rounded-[10px] border border-[#e8ebee] bg-white px-[12px] pr-[32px] text-[12px] font-semibold text-[#333d4b] outline-none">
              <option>{senderLabel}</option>
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-[13px] top-[15px] size-[7px] rotate-45 border-b border-r border-[#8b95a1]" />
          </span>
        </label>
        <p className="mt-[5px] text-[9.5px] text-[#8b95a1]">프로필에 등록된 발신번호만 선택할 수 있어요</p>

        <label className="mt-[13px] block text-[11px] font-bold text-[#4e5968]">
          수신 팩스번호
          <input
            aria-label="수신 팩스번호"
            value={recipient}
            readOnly
            className="mt-[6px] h-[36px] w-full rounded-[9px] border border-[#14a497] bg-white px-[11px] text-[12px] font-semibold text-[#333d4b] outline-none ring-[3px] ring-[#e2f5f1]"
          />
        </label>

        <div className="mt-[12px] h-[92px] rounded-[12px] bg-[#f2f4f6] px-[14px] py-[10px]">
          <div className="flex items-center gap-[7px]">
            <strong className="text-[12px] text-[#333d4b]">{building?.name ?? "선택 건물"}</strong>
            <span className="rounded-full bg-[#e2f5f1] px-[7px] py-[2px] text-[9.5px] font-bold text-[#0f857a]">{targets.length}세대</span>
          </div>
          <p className="mt-[5px] truncate text-[10.5px] text-[#6b7684]">{targets.map((target) => `${target.unitNo}호`).join(", ") || "선택된 세대 없음"}</p>
          <div className="mt-[7px] border-t border-[#dfe3e7] pt-[7px] text-[10.5px] font-bold text-[#4e5968]">{year}년 {Number(month)}월분 고지서 {targets.length}장</div>
        </div>

        {error && <p role="alert" className="mt-[8px] text-[10.5px] font-bold text-[#f04452]">발송에 실패했습니다. 번호를 확인한 뒤 다시 시도해 주세요.</p>}

        <div className="mt-[22px] flex justify-end gap-[8px]">
          <ModalActionButton variant="ghost" onClick={onCancel} className="w-[57px] !px-0">취소</ModalActionButton>
          <ModalActionButton onClick={onSend} disabled={!validRecipient || isPending} className="w-[57px] !px-0">{isPending ? "발송 중…" : "발송"}</ModalActionButton>
        </div>
      </div>
    </div>
  );
}
