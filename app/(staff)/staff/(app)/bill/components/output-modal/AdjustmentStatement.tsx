"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/common";
import type { AdjustmentStatementPageModel } from "@/lib/bill/adjustmentStatement";
import { ZoomControls } from "./OutputModalPrimitives";

// 문서 기준 크기(px) = A4 landscape @96dpi. 실제 인쇄는 @page A4 landscape.
const DOC_WIDTH = 1123;
const DOC_HEIGHT = 794;

// 고정 컬럼 폭(%) — 나머지는 관리비 항목(2개씩 묶음) 컬럼이 균등 분배.
const FIXED_WIDTHS = {
  current: 3.3,
  previous: 3.3,
  usage: 2.5,
  monthTotal: 6.3,
  unpaid: 6.3,
  lateFee: 6.3,
  name: 8,
  unit: 2.6,
};
const FIXED_SUM = Object.values(FIXED_WIDTHS).reduce((sum, value) => sum + value, 0);

const ADJ_CSS = `
.adj-doc{width:${DOC_WIDTH}px;min-height:${DOC_HEIGHT}px;box-sizing:border-box;background:#fff;border:1px solid #e8ebee;border-radius:4px;padding:24px 34px;color:#111;line-height:1.2;}
.adj-title{text-align:center;font-size:14px;font-weight:700;letter-spacing:.04em;margin-bottom:8px;color:#000;}
.adj-info{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:5px;font-size:10px;color:#000;}
.adj-building{font-size:12.5px;font-weight:700;}
.adj-output{font-size:9.5px;line-height:1.35;text-align:right;}
.adj-page-no{color:#c00;font-weight:700;}
.adj-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;color:#000;}
.adj-table th,.adj-table td{border:1px solid #000;padding:0 2px;height:26px;vertical-align:middle;text-align:center;font-weight:400;line-height:1.15;}
.adj-table thead th{height:34px;font-size:8.5px;font-weight:400;}
.adj-table td.adj-num,.adj-table th.adj-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;}
.adj-table td.adj-unit{font-weight:700;}
.adj-table th.adj-name-cell,.adj-table td.adj-name-cell{text-align:left;font-size:8.5px;padding:0 3px;white-space:nowrap;overflow:hidden;}
.adj-two-line{display:flex;flex-direction:column;justify-content:center;gap:1px;}
.adj-two-line>span{display:block;min-height:11px;line-height:1.15;}
.adj-two-line-right>span{text-align:right;}
.adj-two-line>span.adj-name-head{display:flex;justify-content:space-between;gap:4px;min-width:0;}
.adj-two-line>span.adj-name-head>span:first-child{overflow:hidden;text-overflow:ellipsis;}
.adj-table tr{page-break-inside:avoid;}
.adj-table tr.adj-total td{border-top:2px solid #000;}
@media print{
.adj-doc{width:auto;min-height:0;border:none;border-radius:0;padding:0;box-shadow:none;}
.adj-doc:not(:last-child){break-after:page;}
@page{size:A4 landscape;margin:8mm;}
}
`;

/** 조정명세서 전용 스타일 + @page. 화면·인쇄 인스턴스가 공유하므로 모달에서 1회만 렌더한다. */
export function AdjustmentStatementStyles() {
  return <style>{ADJ_CSS}</style>;
}

/** 한 셀 안에 두 줄. 값이 없으면 높이 유지를 위해 non-breaking space를 넣는다. */
export function TwoLineCell({
  top,
  bottom,
  align,
}: {
  top?: ReactNode;
  bottom?: ReactNode;
  align?: "right";
}) {
  return (
    <div className={align === "right" ? "adj-two-line adj-two-line-right" : "adj-two-line"}>
      <span>{top || " "}</span>
      <span>{bottom || " "}</span>
    </div>
  );
}

const won = (value: number | null | undefined) =>
  value == null || value === 0 ? "" : Math.round(value).toLocaleString("ko-KR");
const reading = (value: number | null | undefined) =>
  value == null ? "" : Number(value).toLocaleString("ko-KR");

// 원본 폼 기준 항목 페어 컬럼 고정 슬롯 수. 실제 항목이 적으면 나머지는 공란(여분 칼럼)으로 채운다.
const MIN_ITEM_PAIRS = 10;

function feeItemPairs(names: string[]): [string, string | undefined][] {
  const pairs: [string, string | undefined][] = [];
  for (let index = 0; index < names.length; index += 2) {
    pairs.push([names[index], names[index + 1]]);
  }
  return pairs;
}

/** 조정명세서 한 페이지(건물 1개). 화면·인쇄가 동일 DOM을 공유한다. */
export function AdjustmentStatementPage({ page }: { page: AdjustmentStatementPageModel }) {
  const realPairs = feeItemPairs(page.feeItemNames);
  // 여분 칼럼: 항목 페어 컬럼을 고정 슬롯 수로 두고, 실제 항목 뒤는 공란으로 채운다.
  const pairs: [string | undefined, string | undefined][] = Array.from(
    { length: Math.max(MIN_ITEM_PAIRS, realPairs.length) },
    (_, index) => realPairs[index] ?? [undefined, undefined],
  );
  const feeColWidth = (100 - FIXED_SUM) / pairs.length;

  return (
    <article className="adj-doc">
      <div className="adj-title">
        [ {page.year} 년&nbsp; {page.month} 월분&nbsp; 조정명세서 ]
      </div>

      <div className="adj-info">
        <span className="adj-building">
          [ {page.buildingCode} 동&nbsp; {page.buildingName} ]
        </span>
        <div className="adj-output">
          <div>출력일자 : {page.outputDate}</div>
          <div>
            <span className="adj-page-no">
              [ 페이지 : {page.pageIndex}/{page.pageCount} ]
            </span>
            &nbsp;&nbsp;
            <span>[ {page.companyName} ]</span>
          </div>
        </div>
      </div>

      <table className="adj-table">
        <colgroup>
          <col style={{ width: `${FIXED_WIDTHS.current}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.previous}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.usage}%` }} />
          {pairs.map((_, index) => (
            <col key={`fee-col-${index}`} style={{ width: `${feeColWidth}%` }} />
          ))}
          <col style={{ width: `${FIXED_WIDTHS.monthTotal}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.unpaid}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.lateFee}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.name}%` }} />
          <col style={{ width: `${FIXED_WIDTHS.unit}%` }} />
        </colgroup>

        <thead>
          <tr>
            <th className="adj-num">당월</th>
            <th className="adj-num">전월</th>
            <th className="adj-num">량</th>
            {pairs.map((pair, index) => (
              <th key={`fee-head-${index}`}>
                <TwoLineCell top={pair[0]} bottom={pair[1]} />
              </th>
            ))}
            <th>당 월 계</th>
            <th>
              <TwoLineCell top="미납액" bottom="(납기후연체)" />
            </th>
            <th>
              <TwoLineCell top="미납연체료" bottom="(납기후금액)" />
            </th>
            <th className="adj-name-cell">
              <div className="adj-two-line">
                <span className="adj-name-head">
                  <span>이름</span>
                  <span>수납일</span>
                </span>
                <span>비고</span>
              </div>
            </th>
            <th>호수</th>
          </tr>
        </thead>

        <tbody>
          {page.rows.map((row) => (
            <tr key={row.unitId}>
              <td className="adj-num">{reading(row.meter.current)}</td>
              <td className="adj-num">{reading(row.meter.previous)}</td>
              <td className="adj-num">{reading(row.meter.usage)}</td>
              {pairs.map((pair, index) => (
                <td key={`fee-${index}`}>
                  <TwoLineCell
                    align="right"
                    top={won(row.itemAmounts[index * 2])}
                    bottom={pair[1] === undefined ? undefined : won(row.itemAmounts[index * 2 + 1])}
                  />
                </td>
              ))}
              <td className="adj-num">{won(row.currentTotal)}</td>
              <td>
                <TwoLineCell align="right" top={won(row.arrears)} bottom={won(row.lateAfterDue)} />
              </td>
              <td>
                <TwoLineCell align="right" top={won(row.arrearsLateFee)} bottom={won(row.afterDueTotal)} />
              </td>
              <td className="adj-name-cell">
                <div className="adj-two-line">
                  <span className="adj-name-head">
                    <span className="truncate">{row.name || " "}</span>
                    <span>{row.paidDate ?? ""}</span>
                  </span>
                  <span>{row.phone ?? " "}</span>
                </div>
              </td>
              <td className="adj-unit">{row.unitNo}</td>
            </tr>
          ))}

          <tr className="adj-total">
            <td className="adj-num" />
            <td className="adj-num" />
            <td className="adj-num" />
            {pairs.map((pair, index) => (
              <td key={`total-fee-${index}`}>
                <TwoLineCell
                  align="right"
                  top={won(page.totals.itemAmounts[index * 2])}
                  bottom={pair[1] === undefined ? undefined : won(page.totals.itemAmounts[index * 2 + 1])}
                />
              </td>
            ))}
            <td className="adj-num">{won(page.totals.currentTotal)}</td>
            <td>
              <TwoLineCell align="right" top={won(page.totals.arrears)} bottom={won(page.totals.lateAfterDue)} />
            </td>
            <td>
              <TwoLineCell
                align="right"
                top={won(page.totals.arrearsLateFee)}
                bottom={won(page.totals.afterDueTotal)}
              />
            </td>
            <td className="adj-name-cell" />
            <td className="adj-unit">동계</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

/** 건물 1개당 한 페이지. 화면(scale 축소)·인쇄(A4 landscape)가 동일 컴포넌트를 공유한다. */
export function AdjustmentStatementPreview({
  pages,
  mode,
}: {
  pages: AdjustmentStatementPageModel[];
  mode: "screen" | "print";
}) {
  if (mode === "print") {
    return (
      <>
        {pages.map((page) => (
          <AdjustmentStatementPage key={page.buildingId} page={page} />
        ))}
      </>
    );
  }
  return (
    <div className="flex flex-col items-center gap-[16px]">
      {pages.map((page) => (
        <AdjustmentStatementPage key={page.buildingId} page={page} />
      ))}
    </div>
  );
}

/** 회색 페이퍼 뷰어. 문서를 transform:scale로 축소하고, 축소된 크기만큼만 스크롤 영역을 확보한다. */
export function AdjustmentPreviewViewport({
  pages,
  zoom,
  onZoom,
  refreshing,
}: {
  pages: AdjustmentStatementPageModel[];
  zoom: number;
  onZoom: (value: number) => void;
  refreshing: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: DOC_WIDTH, height: DOC_HEIGHT });

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pages]);

  const scale = zoom / 100;

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto bg-[#e8ebee] p-[16px]">
        <div className="mx-auto" style={{ width: size.width * scale, height: size.height * scale }}>
          <div
            ref={contentRef}
            style={{ width: DOC_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <AdjustmentStatementPreview pages={pages} mode="screen" />
          </div>
        </div>
      </div>
      <ZoomControls zoom={zoom} onZoom={onZoom} />
      {refreshing ? (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/95 shadow-[0_4px_14px_rgba(23,31,40,0.12)]">
          <Spinner label="출력 미리보기 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
    </section>
  );
}
