"use client";

import { useRef, useState, type SVGProps } from "react";
import { appToast } from "@/hooks/common/useAppToast";

/** 업로드(트레이) 아이콘 — 프로젝트에 아이콘 디렉터리가 없어 드롭존 단일 소스에 co-locate. */
function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 3v5h5" />
      <path d="M6 3h8l5 5v13H6z" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

interface FileDropzoneProps {
  accept: string;
  helperText: string;
  /** 확장자가 `accept`에 없을 때 띄우는 안내(정본 `show()`의 토스트 문구). */
  rejectText: string;
  fileName?: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  ariaLabel?: string;
}

/** 정본 `.gr-drop` 드롭존 — 지로수납처리·은행 입금내역 업로드에서 재사용. */
export function FileDropzone({
  accept,
  helperText,
  rejectText,
  fileName,
  disabled = false,
  onFile,
  ariaLabel = "파일 첨부",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptedExtensions = accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.startsWith("."));

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!acceptedExtensions.some((extension) => lowerName.endsWith(extension))) {
      appToast.warning(rejectText);
      return;
    }
    onFile(file);
  };

  return (
    <label
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-[6px] rounded-[14px] border-[1.5px] border-dashed px-[20px] py-[30px] text-center leading-[normal] transition-[border-color,background] duration-[120ms] ${
        dragOver
          ? "border-brand bg-blue-t2"
          : "border-line bg-[#FBFCFD] hover:border-brand hover:bg-blue-t2"
      } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="mb-[2px] flex size-[46px] items-center justify-center rounded-[14px] bg-blue-t text-blue-d">
        <UploadIcon className="size-[22px]" />
      </span>
      {fileName ? (
        <span className="max-w-full truncate text-[13.5px] font-bold text-t1">{fileName}</span>
      ) : (
        <span className="text-[13.5px] font-bold text-t1">파일을 끌어다 놓거나 클릭해 선택</span>
      )}
      <span className="text-[11.5px] font-medium text-t3">{helperText}</span>
    </label>
  );
}

interface FileDropzoneFileRowProps {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}

/** 지로 업로드에 선택된 파일을 표시하는 공용 파일 행. */
export function FileDropzoneFileRow({ file, onRemove, disabled = false }: FileDropzoneFileRowProps) {
  const sizeInKb = `${Math.max(1, Math.round(file.size / 1024))}KB`;

  return (
    <div className="mt-[12px] flex h-[48px] items-center gap-[8px] rounded-[11px] border border-line bg-surface px-[13px] py-[11px] leading-[normal]">
      <FileIcon className="size-[17px] shrink-0 text-t3" aria-hidden="true" />
      <span className="min-w-0 truncate text-[13px] font-semibold text-t1">{file.name}</span>
      <span className="ml-auto shrink-0 text-[11.5px] font-medium text-t3">{sizeInKb}</span>
      <button
        type="button"
        title="첨부 삭제"
        aria-label="첨부 삭제"
        disabled={disabled}
        className="ml-[8px] inline-flex size-[24px] shrink-0 items-center justify-center rounded-[7px] border border-line bg-surface text-t3 hover:border-red disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onRemove}
      >
        <TrashIcon className="size-[17px] text-t3" aria-hidden="true" />
      </button>
    </div>
  );
}
