import type { CardNumberLine, CardSheetPage } from "./cardSheet";

// 정본 building-list `.cf`(화면) + `doPrint` @media print. 화면 값이 기본, 인쇄 값은 print: 로 덮는다.
const HEAD_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap px-[6px] py-[3px] text-[8.4px] print:px-[2mm] print:py-[1.4mm] print:text-[9pt]";
const BOX =
  "flex gap-[8px] border border-t-0 border-[#444] px-[6px] py-[4px] print:gap-[3mm] print:border-[0.8pt] print:border-t-0 print:border-black print:px-[2mm] print:py-[1.4mm]";
const LABEL =
  "h-fit flex-none rounded-[2px] border border-[#444] px-[5px] py-[1px] font-bold print:border-[0.7pt] print:border-black print:px-[1.6mm] print:py-[0.4mm]";
const TABLE =
  "w-full border-collapse border border-t-0 border-[#444] print:border-[0.8pt] print:border-t-0 print:border-black";
const CELL =
  "whitespace-nowrap border border-[#999] px-[4px] py-[2px] text-[8px] print:border-[0.5pt] print:border-black print:px-[1.4mm] print:py-[1mm] print:text-[8.4pt]";
const UNIT_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap border border-[#999] px-[2px] py-[2px] text-[7.4px] print:border-[0.5pt] print:border-black print:px-[1mm] print:py-[0.8mm] print:text-[7.6pt]";
const HEAD_FILL =
  "bg-[#F2F3F5] text-center font-bold [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:bg-[#EDEDED]";
const UNIT_WIDTHS = ["7%", "11%", "6%", "6%", "6%", "12%", "16%", "13%", "7%", "6%", "6%", "9%"];
const UNIT_HEADS = ["호수", "이 름", "분류", "인원", "평형", "집전화", "핸드폰", "입주일자", "관리비", "인상후", "인상폭", "현관키"];
/** 정본 ` &nbsp;&nbsp; ` 간격. */
const GAP = " \u00a0\u00a0 ";

function NumberTable({ title, rows, withMeter }: { title: string; rows: CardNumberLine[]; withMeter: boolean }) {
  const heads = withMeter
    ? ["LIN", title, "계약성명", "구분", "계산", "검침", "출력", "기타적요"]
    : ["LIN", title, "계약성명", "구분", "계산", "기타적요"];
  // D8: 비어 있으면 머리행 + 빈 행 1줄.
  const lines: (CardNumberLine | null)[] = rows.length > 0 ? rows : [null];
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          {heads.map((head) => (
            <th key={head} className={`${CELL} ${HEAD_FILL}`}>
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={line ? line.lin : `empty-${index}`}>
            <td className={`${CELL} text-center`}>{line ? line.lin : "\u00a0"}</td>
            <td className={`${CELL} text-center`}>{line?.customerNo}</td>
            <td className={`${CELL} text-center`}>{line?.holderName}</td>
            <td className={`${CELL} text-center`}>{line?.basis}</td>
            <td className={`${CELL} text-center`}>{line?.calculation}</td>
            {withMeter && (
              <>
                <td className={`${CELL} text-center`}>{line?.meterDay}</td>
                <td className={`${CELL} text-center`}>{line?.print}</td>
              </>
            )}
            <td className={CELL}>{line?.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 입주자카드 한 쪽(정본 cardForm). */
export function TenantCardSheet({ page, year, month }: { page: CardSheetPage; year: number; month: number }) {
  const { header, blocks } = page;
  return (
    <div className="font-['Pretendard',sans-serif] text-[8.4px] leading-[1.45] text-black print:text-[9pt] print:leading-[1.5]">
      <div className="mb-[8px] text-center text-[15px] font-extrabold tracking-[0.22em] print:mb-[4mm] print:text-[17pt] print:tracking-[0.2em]">
        &lt;&lt; 입 주 자 카 드 출 력 &gt;&gt;
      </div>
      <table className="w-full border-collapse border border-[#444] print:border-[0.8pt] print:border-black">
        <tbody>
          <tr>
            <td className={HEAD_CELL}>
              코드번호: <b>{header.code}</b>
            </td>
            <td className={HEAD_CELL}>동명칭: {header.dongName}</td>
            <td className={HEAD_CELL}>주소: {header.address}</td>
          </tr>
          <tr>
            <td className={HEAD_CELL}>
              빌라명칭: <b>{header.name}</b>
            </td>
            <td className={HEAD_CELL}>전화번호: {header.phone}</td>
            <td className={HEAD_CELL}>관리업체: {header.company}</td>
          </tr>
          <tr>
            <td className={HEAD_CELL} colSpan={3}>
              키번호: {header.keyLine}
            </td>
          </tr>
        </tbody>
      </table>
      <div className={BOX}>
        <div className={LABEL}>기타사항</div>
        <div className="min-h-[34px] min-w-0 flex-1 whitespace-pre-line text-[#666] print:min-h-[14mm] print:text-black">
          {header.memo}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>청소사항 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          담당자: {blocks.cleaning.manager}
          {GAP}횟수: {blocks.cleaning.frequency}
          {GAP}요일: {blocks.cleaning.weekdays}
          {GAP}청소금액: {blocks.cleaning.amount}
          <br />
          비 고: {blocks.cleaning.remarks}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>정화조 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          업체: {blocks.septic.vendor} {blocks.septic.phone}
          {GAP}금액: {blocks.septic.amount}
          {GAP}청구구분: {blocks.septic.billingType}
        </div>
      </div>
      <div className={BOX}>
        <div className={LABEL}>인터넷 &gt;&gt;</div>
        <div className="min-w-0 flex-1">
          업체: {blocks.internet.vendor}
          {GAP}명의자: {blocks.internet.holder}
          {GAP}금액: {blocks.internet.amount}
        </div>
      </div>
      <NumberTable title="수도고객번호" rows={page.water} withMeter />
      <NumberTable title="공용전기고객번호" rows={page.commonElec} withMeter={false} />
      <table className={`${TABLE} table-fixed`}>
        <colgroup>
          {UNIT_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {UNIT_HEADS.map((head) => (
              <th key={head} className={`${UNIT_CELL} ${HEAD_FILL}`}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.units.map((unit) => (
            <tr key={unit.key}>
              <td className={`${UNIT_CELL} text-center`}>{unit.unitNo}</td>
              <td className={UNIT_CELL}>{unit.name}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.roomType}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.residents}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.area}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.homePhone}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.mobilePhone}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.moveIn}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.mgmtFee}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.afterIncrease}</td>
              <td className={`${UNIT_CELL} text-right tabular-nums`}>{unit.increase}</td>
              <td className={`${UNIT_CELL} text-center`}>{unit.entranceKey}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-[6px] text-right text-[8px] text-[#666] print:mt-[2mm] print:text-[8pt]">
        {page.building.name} · {year}년 {month}월 기준 · {page.pageIndex + 1} / {page.pageCount} 쪽
      </div>
    </div>
  );
}
