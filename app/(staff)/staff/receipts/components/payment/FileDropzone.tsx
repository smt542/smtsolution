"use client";

import { useRef, useState, type SVGProps } from "react";

/** 업로드(트레이) 아이콘 — 프로젝트에 아이콘 디렉터리가 없어 드롭존 단일 소스에 co-locate. */
function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

interface FileDropzoneProps {
  accept: string;
  helperText: string;
  fileName?: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  ariaLabel?: string;
}

/** Figma 공용 드롭존 — 지로수납처리·은행 입금내역 업로드에서 재사용. */
export function FileDropzone({
  accept,
  helperText,
  fileName,
  disabled = false,
  onFile,
  ariaLabel = "파일 첨부",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = () => {
    if (!disabled) inputRef.current?.click();
  };
  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={pick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pick();
        }
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
      className={`flex h-[152px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center transition-colors ${
        dragOver ? "border-brand bg-blue-t" : "border-line bg-bg"
      } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-brand"}`}
    >
      <span
        className={`flex h-[46px] w-[46px] items-center justify-center rounded-full ${
          dragOver ? "bg-white text-brand" : "bg-surface text-t3"
        }`}
      >
        <UploadIcon className="h-[22px] w-[22px]" />
      </span>
      {fileName ? (
        <p className="max-w-full truncate text-sm font-bold text-t1">{fileName}</p>
      ) : (
        <p className="text-base font-bold text-t1">파일을 끌어다 놓거나 클릭해 선택</p>
      )}
      <p className="text-xs text-t3">{helperText}</p>
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
    </div>
  );
}
