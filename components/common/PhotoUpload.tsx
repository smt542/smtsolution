"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { useAppToast, useObjectUrls } from "@/hooks/common";
import {
  IMAGE_ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_FILES,
  selectImageFiles,
} from "@/lib/attachments/policy";

/** 이미 저장된 사진. 새로 고른 파일과 같은 줄에, 앞쪽에 그린다. */
export interface PhotoUploadExistingPhoto {
  id: string | number;
  /** 파일명 — 접근성 라벨에 쓴다. */
  name: string;
  /** 썸네일 URL. 아직 받지 못했으면 비워 둔다. */
  url?: string | null;
  /** 썸네일 URL을 받지 못했는지 여부 */
  error?: boolean;
  /** 주면 삭제 버튼을 그린다. 삭제 확인은 호출부 몫이다. */
  onDelete?: () => void | Promise<void>;
  /** 주면 썸네일을 눌러 크게 본다(정본 .gal-item img cursor:zoom-in). */
  onOpen?: () => void;
}

export interface PhotoUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** 저장된 사진들. max는 새로 고를 수 있는 장수만 센다. */
  existing?: readonly PhotoUploadExistingPhoto[];
  max?: number;
  /** 라벨 "(최대 N장)"에 적을 전체 장수(저장된 사진 포함). 없으면 max. */
  totalMax?: number;
  accept?: string;
  disabled?: boolean;
  label?: string;
  /** 바깥에서 이미 필드 라벨을 그렸을 때 내부 라벨을 숨긴다(파일 입력 aria-label은 유지). */
  hideLabel?: boolean;
  variant?: "tiles" | "drop";
  /** drop 안내 둘째 줄. */
  hint?: string;
}

const tileClass =
  "relative size-[84px] shrink-0 overflow-hidden rounded-[10px] border border-line";
/* 정본 .gal-rm: 삭제 버튼은 hover 없이도 항상 보인다 */
const tileDeleteClass =
  "absolute right-[4px] top-[4px] flex size-[20px] items-center justify-center rounded-full bg-[rgba(15,20,26,.62)] text-white enabled:hover:bg-[rgba(15,20,26,.85)] disabled:cursor-not-allowed disabled:opacity-40";
const tilePlaceholderClass =
  "flex size-full items-center justify-center p-2 text-center text-[10px] text-t3";

export function PhotoUpload({
  files,
  onFilesChange,
  existing = [],
  max = MAX_ATTACHMENT_FILES,
  totalMax,
  accept = IMAGE_ATTACHMENT_ACCEPT,
  disabled = false,
  label = "계약서 사진",
  hideLabel = false,
  variant = "tiles",
  hint = "JPG · PNG · 여러 장 가능",
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useObjectUrls(files);
  const appToast = useAppToast();
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (selected: FileList | readonly File[] | null) => {
    if (!selected || disabled) return;
    const { accepted, errors } = selectImageFiles(files, Array.from(selected), max, accept);
    if (errors.length > 0) appToast.error(errors.join("\n"));
    if (accepted.length > 0) onFilesChange([...files, ...accepted]);
  };

  const addDropFiles = (selected: FileList | readonly File[] | null) => {
    if (!selected || disabled) return;
    const { accepted, errors } = selectImageFiles([], Array.from(selected), max, accept);
    if (errors.length > 0) appToast.error(errors.join("\n"));
    if (accepted.length > 0) {
      onFilesChange(max === 1 ? [accepted[0]] : [...files, ...accepted]);
    }
  };

  // 크게 보기는 모달 안에서 열리므로 Esc를 캡처 단계에서 먼저 받아 바깥 모달까지 닫히지 않게 한다.
  useEffect(() => {
    if (!viewer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setViewer(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [viewer]);

  if (variant === "drop") {
    return (
      <div className="col-span-2 flex flex-col">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            setDragOver(false);
            if (disabled) return;
            event.preventDefault();
            addDropFiles(event.dataTransfer.files);
          }}
          className={[
            "flex w-full flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed p-5 transition-colors",
            // 정본 .ct-drop:hover·.ct-drop.on(끌어다 놓는 중). 상태별 클래스는 겹치지 않게 하나씩만 둔다.
            disabled
              ? "cursor-default border-line opacity-50"
              : dragOver
                ? "cursor-pointer border-blue bg-[rgba(20,164,151,0.05)]"
                : "cursor-pointer border-line hover:border-blue hover:bg-[rgba(20,164,151,0.05)]",
          ].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[22px] text-blue"
            aria-hidden="true"
          >
            <path d="M12 16V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
          </svg>
          <b className="text-[13px] font-bold">사진을 끌어다 놓거나 클릭해서 선택</b>
          <span className="text-xs font-medium text-t3">{hint}</span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={max > 1}
            disabled={disabled}
            hidden
            aria-label={`${label} 선택`}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              addDropFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {(existing.length > 0 || files.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {existing.map((photo) => (
              <div key={photo.id} className="relative w-[92px]">
                {photo.url ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (photo.onOpen) photo.onOpen();
                      else setViewer({ url: photo.url as string, name: photo.name });
                    }}
                    className="block cursor-pointer"
                    aria-label={`${photo.name} 미리보기`}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      width={92}
                      height={92}
                      className="block size-[92px] cursor-pointer rounded-[10px] border border-line object-cover"
                    />
                  </button>
                ) : (
                  <span
                    role={photo.error ? "alert" : "status"}
                    className="flex size-[92px] items-center justify-center rounded-[10px] border border-line p-2 text-center text-[10px] text-t3"
                  >
                    {photo.error ? "미리보기 실패" : "불러오는 중…"}
                  </span>
                )}
                {photo.onDelete && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void photo.onDelete?.()}
                    aria-label={`${photo.name} 삭제`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#191F28] text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                )}
                <div className="mt-[5px] truncate text-[11px] font-semibold text-t4">{photo.name}</div>
              </div>
            ))}
            {files.map((file, index) => {
              const preview = previews[index];
              return (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="relative w-[92px]">
                  {preview?.file === file ? (
                    <button
                      type="button"
                      onClick={() => setViewer({ url: preview.url, name: file.name })}
                      className="block cursor-pointer"
                      aria-label={`${file.name} 미리보기`}
                    >
                      <Image
                        src={preview.url}
                        alt={file.name}
                        width={92}
                        height={92}
                        unoptimized
                        className="block size-[92px] cursor-pointer rounded-[10px] border border-line object-cover"
                      />
                    </button>
                  ) : (
                    <span className="flex size-[92px] items-center justify-center rounded-[10px] border border-line p-2 text-center text-[10px] text-t3">
                      {file.name}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                    aria-label={`${file.name} 삭제`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#191F28] text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                  <div className="mt-[5px] truncate text-[11px] font-semibold text-t4">{file.name}</div>
                </div>
              );
            })}
          </div>
        )}

        {viewer && (
          <div
            className="fixed inset-0 z-[260] flex items-center justify-center bg-[rgba(23,31,40,0.7)] p-10"
            onClick={() => setViewer(null)}
          >
            <Image
              src={viewer.url}
              alt={viewer.name}
              width={1200}
              height={900}
              unoptimized
              className="max-h-full max-w-full rounded-xl"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="col-span-2 flex flex-col">
      {hideLabel ? null : (
        <div className="mb-1 text-[12.5px] font-bold text-t2">
          {label} <span className="font-semibold text-t4">(최대 {totalMax ?? max}장)</span>
        </div>
      )}
      {/* 위 여백은 내부 라벨과의 간격이다. 호출부가 라벨을 그리면(hideLabel) 그 라벨 여백만 쓴다
          (정본 협력업체 모달 .vm-flbl margin-bottom 5px 바로 아래 .gal). */}
      <div className={`flex flex-nowrap items-start gap-[10px] overflow-x-auto pb-[4px] ${hideLabel ? "" : "pt-[6px]"}`}>
        {existing.map((photo) => (
          <div key={photo.id} className={tileClass}>
            {photo.url && photo.onOpen ? (
              <button
                type="button"
                className="size-full cursor-zoom-in"
                onClick={photo.onOpen}
                aria-label={`${photo.name} 미리보기`}
              >
                <Image src={photo.url} alt="" width={84} height={84} className="size-full object-cover" />
              </button>
            ) : photo.url ? (
              <Image
                src={photo.url}
                alt={photo.name}
                width={84}
                height={84}
                className="size-full object-cover"
              />
            ) : (
              <span
                role={photo.error ? "alert" : "status"}
                aria-label={`${photo.name} ${photo.error ? "미리보기 실패" : "불러오는 중"}`}
                className={tilePlaceholderClass}
              >
                {photo.error ? "미리보기 실패" : "불러오는 중…"}
              </span>
            )}
            {photo.onDelete && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => void photo.onDelete?.()}
                className={tileDeleteClass}
                aria-label={`${photo.name} 삭제`}
              >
                <CloseIcon className="size-[10px]" />
              </button>
            )}
          </div>
        ))}
        {files.map((file, index) => {
          const preview = previews[index];
          return (
            <div key={`${file.name}-${file.lastModified}-${index}`} className={tileClass}>
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
                <span className={tilePlaceholderClass}>{file.name}</span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className={tileDeleteClass}
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
