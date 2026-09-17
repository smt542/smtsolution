"use client";

import Image from "next/image";
import type { BillTarget } from "@/hooks/reactquery/bill";
import { displayUnitNo } from "@/lib/bill/document";
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-3 print:hidden" role="dialog" aria-modal="true" aria-labelledby="fax-confirm-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="w-[440px] overflow-hidden rounded-[20px] bg-white px-[26px] pb-[24px] pt-[28px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]">
        <h3 id="fax-confirm-title" className="text-[16.5px] font-extrabold leading-[20px] text-[#191f28]">팩스 발송</h3>

        <div className="flex h-[101px] flex-col gap-[6px] pt-[14px]">
          <label htmlFor="fax-sender" className="text-[12.5px] font-bold leading-[15px] text-[#4e5968]">발신 팩스번호</label>
          <span className="relative block h-[40px]">
            <select
              id="fax-sender"
              className="h-full w-full appearance-none rounded-[10px] border border-[#e8ebee] bg-white pl-[11px] pr-[32px] text-[13.5px] font-semibold tracking-[-0.135px] text-[#191f28] outline-none"
            >
              <option>{senderLabel}</option>
            </select>
            <Image
              aria-hidden="true"
              src="/figma-assets/bill/select-chevron.svg"
              alt=""
              width={14}
              height={14}
              className="pointer-events-none absolute right-[10px] top-1/2 size-[14px] -translate-y-1/2"
            />
          </span>
          <p className="h-[20px] pt-[6px] text-[11.5px] font-medium leading-[14px] text-[#b0b8c1]">프로필에 등록된 발신번호만 선택할 수 있어요</p>
        </div>

        <div className="flex flex-col gap-[6px] pt-[12px]">
          <label htmlFor="fax-recipient" className="text-[12.5px] font-bold leading-[15px] text-[#4e5968]">수신 팩스번호</label>
          <input
            id="fax-recipient"
            value={recipient}
            readOnly
            placeholder="02-1234-5678"
            className="h-[36px] w-full rounded-[10px] border border-[#e8ebee] bg-white px-[11px] text-[13.5px] font-medium text-[#757575] outline-none placeholder:text-[#757575]"
          />
        </div>

        <div className="pt-[12px]">
          <div className="rounded-[12px] bg-[#f2f4f6] px-[14px] py-[12px]">
            <div className="flex flex-col gap-[3px] border-b border-[#f1f3f5] pb-[6px]">
              <div className="flex items-center gap-[7px]">
                <strong className="text-[13.5px] font-bold text-[#191f28]">{building?.name ?? "선택 건물"}</strong>
                <span className="rounded-[6px] bg-[#e2f5f1] px-[7px] py-[2px] text-[11px] font-bold text-[#0e8677]">{targets.length}세대</span>
              </div>
              <p className="truncate text-[12px] font-medium leading-[18px] text-[#8b95a1]">{targets.map((target) => displayUnitNo(target.unitNo)).join(", ") || "선택된 세대 없음"}</p>
            </div>
            <p className="pt-[9px] text-[12.5px] font-semibold text-[#4e5968]">{year}년 {Number(month)}월분 고지서 <strong className="font-extrabold text-[#191f28]">{targets.length}장</strong></p>
          </div>
        </div>

        {error && <p role="alert" className="pt-[10px] text-[11.5px] font-bold text-[#f04452]">발송에 실패했습니다. 번호를 확인한 뒤 다시 시도해 주세요.</p>}

        <div className="flex h-[62px] items-start justify-end gap-[8px] pt-[22px]">
          <ModalActionButton variant="ghost" onClick={onCancel} className="w-[57px] !px-0">취소</ModalActionButton>
          <ModalActionButton onClick={onSend} disabled={!validRecipient || isPending} className="w-[57px] !px-0">{isPending ? "발송 중…" : "발송"}</ModalActionButton>
        </div>
      </div>
    </div>
  );
}
