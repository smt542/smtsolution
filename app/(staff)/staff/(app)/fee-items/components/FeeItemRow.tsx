"use client";

import Image from "next/image";
import { ROUNDING_OPTIONS } from "./constants";
import type { FeeItemDraft } from "./types";

interface FeeItemRowProps {
  item: FeeItemDraft;
  onEdit: (item: FeeItemDraft) => void;
  onDragStart: (key: string) => void;
  onDrop: (key: string) => void;
}

export function FeeItemRow({ item, onEdit, onDragStart, onDrop }: FeeItemRowProps) {
  const rounding = ROUNDING_OPTIONS.find((option) => option.value === item.rounding)?.label;
  const interactive = !item.isRequired;

  return (
    <tr
      draggable={interactive}
      className={`${item.isRequired ? "h-[47px]" : "h-[51px]"} border-t border-line2 text-[13px] text-t2 ${interactive ? "cursor-pointer hover:bg-bg/60" : ""}`}
      onClick={() => interactive && onEdit(item)}
      onDragStart={(event) => {
        if (!interactive) return;
        event.dataTransfer.effectAllowed = "move";
        onDragStart(item.key);
      }}
      onDragOver={(event) => interactive && event.preventDefault()}
      onDrop={(event) => {
        if (!interactive) return;
        event.preventDefault();
        onDrop(item.key);
      }}
    >
      <td className="w-11 pl-[21px]">
        <Image
          src={item.isRequired ? "/icons/fee-items/lock.svg" : "/icons/fee-items/grip.svg"}
          alt={item.isRequired ? "필수 항목" : "순서 이동"}
          width={16}
          height={16}
        />
      </td>
      <th scope="row" className="w-[25%] py-0 pr-5 text-left font-bold text-t1">
        <span>{item.name}</span>
        {item.isRequired && (
          <span className="ml-2 rounded-md bg-bg px-1.5 py-0.5 text-[10px] font-bold text-t3">필수</span>
        )}
      </th>
      <td className="w-[26%] px-5 font-semibold">{rounding}</td>
      <td className="w-[26%] px-5 font-semibold">{item.dailyProration ? "적용" : "안함"}</td>
      <td className="px-5 font-semibold">{item.carryOver ? "이월" : "안함"}</td>
    </tr>
  );
}
