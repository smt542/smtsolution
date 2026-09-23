"use client";
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/common";
import { DocumentIcon, IdCardIcon, PrinterIcon } from "@/components/icons";
import type { OutputQueryStatus } from "@/hooks/reactquery/bill";

/** 정본 `.pm-page` 종이 크기(px). */
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 594;
/** 1단계: 현재 문서(190mm 폭)를 종이 폭에 맞춰 축소해 넣는다 — 2단계에서 정본 양식으로 교체. */
const DOC_ZOOM = PAGE_WIDTH / ((190 * 96) / 25.4);
const docStyle = { zoom: DOC_ZOOM } as CSSProperties;
const PAGER_BUTTON =
  "flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border border-line bg-white p-0 text-t2 enabled:hover:border-teal enabled:hover:bg-bg enabled:hover:text-teal disabled:opacity-40";
const TITLES = { card: "입주자카드", statement: "관리비부과내역서" } as const;

interface PreviewPaneProps {
  kind: "card" | "statement";
  count: number;
  page: number; // 1-based
  /** 현재 페이지 건물 "코드 · 건물명"(페이지가 없으면 빈 문자열). */
  buildingLabel: string;
  onPrev: () => void;
  onNext: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  status: OutputQueryStatus;
  emptyMessage?: string;
  emptyHint?: string;
  children?: ReactNode; // 현재 페이지 문서
}

/** 종이 영역 안 가운데 안내(로딩·실패·빈 상태). */
function PaperMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[4px] bg-bg px-4 text-center">
      {children}
    </div>
  );
}

/** 정본 `.pm-paper` + `.pm-page` — 420×594 종이를 영역에 맞춰 축소해 가운데 둔다(배율 = min((W−28)/420, (H−28)/594)). */
function PaperPage({ children }: { children: ReactNode }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const next = Math.min((area.clientWidth - 28) / PAGE_WIDTH, (area.clientHeight - 28) / PAGE_HEIGHT);
      setScale(next > 0 ? next : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      <div
        className="absolute left-1/2 top-1/2 h-[594px] w-[420px] overflow-hidden rounded-[3px] border border-line bg-white shadow-[0_6px_20px_-4px_rgba(23,31,40,0.18)]"
        style={{
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        <div style={docStyle}>{children}</div>
      </div>
    </div>
  );
}

/** 정본 `.pm-doc` 문서 카드: 헤더(아이콘·제목·총 N장) · 건물 줄 · 페이지 줄(페이저·개별 인쇄) · 종이. */
export function PreviewPane({
  kind,
  count,
  page,
  buildingLabel,
  onPrev,
  onNext,
  actionLabel,
  onAction,
  actionDisabled,
  status,
  emptyMessage,
  emptyHint,
  children,
}: PreviewPaneProps) {
  const title = TITLES[kind];
  const hasContent = count > 0;
  const Icon = kind === "card" ? IdCardIcon : DocumentIcon;
  return (
    <div
      data-pane={kind}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-line bg-surface leading-[normal] shadow-[0_2px_8px_rgba(23,31,40,0.06)]"
    >
      <div className="flex shrink-0 items-center gap-[7px] border-b border-line2 bg-[#fbfcfd] px-[15px] py-[11px] text-[12.5px] font-extrabold text-t2">
        <Icon strokeWidth={2} className="h-[15px] w-[15px] shrink-0 text-teal" />
        <h3>{title}</h3>
        <div className="flex-1" />
        <span className="whitespace-nowrap rounded-full bg-bg px-[8px] py-[2px] text-[10.5px] font-bold text-t3">
          총 {count}장
        </span>
      </div>
      {/* 정본 `.pm-doc-b` — 페이지가 없어도 줄 높이는 남긴다. */}
      <div className="shrink-0 bg-white px-[15px] pt-[7px] text-[12px] font-bold text-t3">{buildingLabel || "\u00a0"}</div>
      <div className="flex shrink-0 items-center gap-[8px] border-b border-line2 bg-white px-[15px] py-[8px]">
        {/* 정본 `.pm-pager` — 화살표는 2장 이상일 때만 그린다(1장 이하는 "1 / 1" 글자만). */}
        <div className="inline-flex items-center gap-[3px] text-[11px] font-bold text-t2">
          {count > 1 && (
            <button type="button" aria-label="이전 페이지" onClick={onPrev} disabled={page <= 1} className={PAGER_BUTTON}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-[12px] w-[12px]" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <span className="min-w-[34px] text-center tabular-nums">
            {hasContent ? page : 0} / {count}
          </span>
          {count > 1 && (
            <button type="button" aria-label="다음 페이지" onClick={onNext} disabled={page >= count} className={PAGER_BUTTON}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-[12px] w-[12px]" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="inline-flex items-center gap-[5px] enabled:hover:border-teal enabled:hover:bg-teal-t enabled:hover:text-teal disabled:opacity-40"
        >
          <PrinterIcon className="h-[13px] w-[13px]" />
          {actionLabel}
        </Button>
      </div>
      {status === "loading" ? (
        <PaperMessage>
          <Spinner label={`${title} 불러오는 중`} showLabel />
        </PaperMessage>
      ) : status === "error" ? (
        <PaperMessage>
          <p className="text-[12.5px] font-bold text-t2">데이터를 불러오지 못했습니다. 다시 시도해 주세요.</p>
        </PaperMessage>
      ) : hasContent ? (
        <PaperPage>{children}</PaperPage>
      ) : (
        <PaperMessage>
          <p className="text-[12.5px] font-bold text-t2">{emptyMessage ?? "표시할 내용이 없습니다"}</p>
          {emptyHint && <p className="text-[11.5px] text-t3">{emptyHint}</p>}
        </PaperMessage>
      )}
    </div>
  );
}
