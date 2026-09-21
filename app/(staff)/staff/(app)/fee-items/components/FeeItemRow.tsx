"use client";

import Image from "next/image";
import { ROUNDING_OPTIONS } from "./constants";
import type { FeeItemDraft } from "./types";

export type FeeItemDropPosition = "before" | "after";

interface FeeItemRowProps {
  item: FeeItemDraft;
  isTypeUnsaved: boolean;
  isReorderPending: boolean;
  onEdit: (item: FeeItemDraft) => void;
  onDragStart: (key: string) => void;
  onDragOver: (key: string, position: FeeItemDropPosition | null) => void;
  onDrop: (key: string, position: FeeItemDropPosition | null) => void;
  onDragEnd: () => void;
  dragged: boolean;
  dropPosition: FeeItemDropPosition | null;
}

export function FeeItemRow({
  item,
  isTypeUnsaved,
  isReorderPending,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragged,
  dropPosition,
}: FeeItemRowProps) {
  const rounding = ROUNDING_OPTIONS.find((option) => option.value === item.rounding)?.label;
  const editable = !isTypeUnsaved && (!item.isRequired || item.id == null);
  const interactive = !isTypeUnsaved && !item.isRequired && item.id != null && !isReorderPending;
  const indicatorClass = dropPosition === "before"
    ? "[&>*]:shadow-[inset_0_2px_0_0_var(--color-teal)]"
    : dropPosition === "after"
      ? "[&>*]:shadow-[inset_0_-2px_0_0_var(--color-teal)]"
      : "";

  return (
    <tr
      draggable={interactive}
      className={`${item.isRequired ? "h-[47px] bg-[#fbfcfd]" : "h-[51px]"} border-t border-line2 text-[13.5px] text-t2 transition-opacity duration-150 ease-out [&>*]:transition-shadow [&>*]:duration-150 [&>*]:ease-out ${interactive ? "cursor-pointer hover:bg-bg/60" : ""} ${dragged ? "opacity-40" : "opacity-100"} ${indicatorClass}`}
      onClick={() => editable && onEdit(item)}
      onDragStart={(event) => {
        if (!interactive) return;
        event.dataTransfer.effectAllowed = "move";
        onDragStart(item.key);
      }}
      onDragOver={(event) => {
        if (!interactive) {
          onDragOver(item.key, null);
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        onDragOver(item.key, position);
      }}
      onDrop={(event) => {
        if (!interactive) {
          onDrop(item.key, null);
          return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        onDrop(item.key, position);
      }}
      onDragEnd={onDragEnd}
    >
      <td className="w-11 pl-4">
        <Image
          src={item.isRequired ? "/icons/fee-items/lock.svg" : "/icons/fee-items/grip.svg"}
          alt={item.isRequired ? "필수 항목" : "순서 이동"}
          width={16}
          height={16}
        />
      </td>
      <th scope="row" className="w-[24%] py-0 px-4 text-left font-bold text-t1">
        <span>{item.name}</span>
        {item.isRequired && (
          <span className="ml-2 rounded-md bg-bg px-1.5 py-0.5 text-[10px] font-bold text-t3">필수</span>
        )}
      </th>
      <td className="px-4 font-semibold">{rounding}</td>
      <td className="px-4 font-semibold">{item.dailyProration ? "적용" : "안함"}</td>
      <td className="px-4 font-semibold">{item.carryOver ? "이월" : "안함"}</td>
    </tr>
  );
}
