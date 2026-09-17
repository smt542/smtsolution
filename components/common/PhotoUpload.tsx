"use client";

import Image from "next/image";
import { useRef } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { useAppToast, useObjectUrls } from "@/hooks/common";
import {
  IMAGE_ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_FILES,
  selectImageFiles,
} from "@/lib/attachments/policy";

export interface PhotoUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  max?: number;
  accept?: string;
  disabled?: boolean;
  label?: string;
  /** 바깥에서 이미 필드 라벨을 그렸을 때 내부 라벨을 숨긴다(파일 입력 aria-label은 유지). */
  hideLabel?: boolean;
}

export function PhotoUpload({
  files,
  onFilesChange,
  max = MAX_ATTACHMENT_FILES,
  accept = IMAGE_ATTACHMENT_ACCEPT,
  disabled = false,
  label = "계약서 사진",
  hideLabel = false,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useObjectUrls(files);
  const appToast = useAppToast();

  const addFiles = (selected: FileList | readonly File[] | null) => {
    if (!selected || disabled) return;
    const { accepted, errors } = selectImageFiles(files, Array.from(selected), max, accept);
    if (errors.length > 0) appToast.error(errors.join("\n"));
    if (accepted.length > 0) onFilesChange([...files, ...accepted]);
  };

  return (
    <div className="col-span-2 flex flex-col">
      {hideLabel ? null : (
        <div className="mb-1 text-[12.5px] font-bold text-t2">
          {label} <span className="font-semibold text-t4">(최대 {max}장)</span>
        </div>
      )}
      <div className="flex flex-nowrap items-start gap-[10px] overflow-x-auto pb-[4px] pt-[6px]">
        {files.map((file, index) => {
          const preview = previews[index];
          return (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="group relative size-[84px] shrink-0 overflow-hidden rounded-[10px] border border-line"
            >
              {preview?.file === file ? (
                <Image
                  src={preview.url}
                  alt={file.name}
                  width={84}
                  height={84}
                  /* 업로드 전 blob: 미리보기 URL이라 옵티마이저가 가져올 수 없다 */
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center text-[10px] text-t3">
                  {file.name}
                </span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className="absolute right-[4px] top-[4px] flex size-[20px] items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${file.name} 삭제`}
              >
                <CloseIcon className="size-[10px]" />
              </button>
            </div>
          );
        })}
        {files.length < max && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex size-[84px] shrink-0 flex-col items-center justify-center gap-[4px] rounded-[10px] border-[1.5px] border-dashed border-line bg-[#fbfcfd] text-t3 transition-colors hover:border-teal hover:bg-teal-t hover:text-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="size-[20px]" />
            <span className="text-[11px] font-bold">사진 추가</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={max > 1}
          disabled={disabled}
          hidden
          aria-label={`${label} 선택`}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
