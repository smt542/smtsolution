"use client";
import { useRef, useState } from "react";
import { FieldLabel } from "./FieldLabel";
import { PlusIcon, CloseIcon } from "@/components/icons";

/** Figma 계약서 사진: dashed 84px add tile + thumbnails (preview holds object URLs, no upload). */
export function PhotoUpload({ label = "계약서 사진", max = 10 }: { label?: string; max?: number }) {
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= max) break;
      next.push({ url: URL.createObjectURL(f), name: f.name });
    }
    setFiles(next);
  };

  return (
    <div className="col-span-2 flex flex-col">
      <FieldLabel hint={` (최대 ${max}장)`}>{label}</FieldLabel>
      <div className="flex flex-nowrap items-start gap-[10px] overflow-x-auto pb-[4px] pt-[6px]">
        {files.map((f, i) => (
          <div key={i} className="group relative size-[84px] overflow-hidden rounded-[10px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => setFiles(files.filter((_, j) => j !== i))}
              className="absolute right-[4px] top-[4px] flex size-[20px] items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="사진 삭제"
            >
              <CloseIcon className="size-[10px]" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-[84px] shrink-0 flex-col items-center justify-center gap-[4px] rounded-[10px] border-[1.5px] border-dashed border-line bg-[#fbfcfd] text-t3 transition-colors hover:border-teal hover:bg-teal-t hover:text-teal"
          >
            <PlusIcon className="size-[20px]" />
            <span className="text-[11px] font-bold">사진 추가</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
