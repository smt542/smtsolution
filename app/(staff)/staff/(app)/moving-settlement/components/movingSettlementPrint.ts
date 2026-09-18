type PrintValue = number | string | null | undefined;

export type SettlementStatementUtility = "water" | "elec" | "gas";

export interface SettlementStatementMeter {
  utility: SettlementStatementUtility;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  unitPrice: number | null;
  charge: number | null;
}

export interface SettlementStatementManagementRow {
  name: string;
  charge: number;
  settlement: number;
}

export interface SettlementStatementChecklistItem {
  label: string;
  note: string | null;
}

export interface SettlementStatementPrintModel {
  moveOutDate: string;
  buildingName: string;
  unitNo: string;
  ownerPhone: string | null;
  address: string | null;
  occupantPhone: string | null;
  meters: SettlementStatementMeter[];
  chargeDays: number | null;
  monthDays: number | null;
  utilityTotal: number | null;
  managementRows: SettlementStatementManagementRow[];
  managementMonthlyTotal: number | null;
  managementSettlementTotal: number | null;
  repairMemo: string | null;
  repairAmount: number | null;
  billingUnpaid: number | null;
  cleaningCost: number | null;
  total: number | null;
  settleAccount: string | null;
  note: string | null;
  checklist: SettlementStatementChecklistItem[];
  organizationName: string | null;
}

/**
 * 건물·호실을 고르지 않은 상태에서 [빈양식] 을 눌렀을 때 쓰는 모델.
 * 정산 컨텍스트가 없으므로 점검 항목은 org 마스터(`settlement_check_items`)에서 받고,
 * 관리비 항목명은 건물 유형에 따라 달라져 채울 수 없어 빈 행으로 둔다.
 */
export function emptyStatementPrintModel(params: {
  checklistLabels: string[];
  organizationName: string | null;
}): SettlementStatementPrintModel {
  return {
    moveOutDate: "",
    buildingName: "",
    unitNo: "",
    ownerPhone: null,
    address: null,
    occupantPhone: null,
    meters: (["water", "elec", "gas"] as const).map((utility) => ({
      utility,
      previousReading: null,
      currentReading: null,
      usage: null,
      unitPrice: null,
      charge: null,
    })),
    chargeDays: null,
    monthDays: null,
    utilityTotal: null,
    managementRows: [],
    managementMonthlyTotal: null,
    managementSettlementTotal: null,
    repairMemo: null,
    repairAmount: null,
    billingUnpaid: null,
    cleaningCost: null,
    total: null,
    settleAccount: null,
    note: null,
    checklist: params.checklistLabels.map((label) => ({ label, note: null })),
    organizationName: params.organizationName,
  };
}

const PRINT_SHEET_ID = "rcPrintSheet";
const PRINT_STYLE_ID = "rcPrintCss";

const PRINT_CSS = `
@media screen{#rcPrintSheet{display:none}}
@media print{
@page{size:A4 landscape;margin:8mm}
html,body{background:#fff!important;height:auto!important;overflow:visible!important}
body>*:not(#rcPrintSheet){display:none!important}
/* 정본은 display:block + .stl/.str{min-height:186mm} 이라, 186+하단 3.7 = 189.7mm 로
   인쇄영역(A4 가로 210 - 여백 16 = 194mm)과 여유가 2.8mm 뿐이다. 어느 셀이든 한 줄만
   접히면 하단 날짜·회사명이 2쪽으로 밀렸다. 시트를 인쇄영역 높이에 고정하고 하단을
   flex 로 바닥에 붙여, 본문이 늘어도 하단이 1쪽에 남게 한다. 본문 가용 높이도 188.8mm 로 늘어난다. */
#rcPrintSheet{display:flex!important;flex-direction:column;height:194mm;font-family:Pretendard,sans-serif;color:#000;line-height:normal}
#rcPrintSheet table{width:100%;border-collapse:collapse}
#rcPrintSheet th,#rcPrintSheet td{border:.5pt solid #999;padding:1mm 1.5mm;font-size:8pt}
#rcPrintSheet th{background:#F1F3F5;font-weight:700;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#rcPrintSheet .r{text-align:right}
#rcPrintSheet .c{text-align:center}
#rcPrintSheet{page-break-inside:avoid}
#rcPrintSheet table,#rcPrintSheet tr{page-break-inside:avoid}
#rcPrintSheet .stwrap{display:grid;grid-template-columns:1fr 1fr;column-gap:6mm;align-items:stretch;position:relative;flex:1 1 auto;min-height:0}
#rcPrintSheet .stl,#rcPrintSheet .str{min-height:0;display:flex;flex-direction:column}
#rcPrintSheet .stl{border-right:.4pt dashed #bbb;padding-right:3mm}
#rcPrintSheet .str .tb{flex:1}
#rcPrintSheet .stt{text-align:center;font-size:13pt;font-weight:800;letter-spacing:.14em;border:.6pt solid #999;padding:1.2mm;margin-bottom:1mm}
#rcPrintSheet .hd{border:.6pt solid #999;background:#F1F3F5;font-weight:700;font-size:8.4pt;padding:1mm 2mm;text-align:center;margin-top:1mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#rcPrintSheet .hd.big{font-size:10.5pt;padding:1.4mm;letter-spacing:.06em;margin-top:0}
#rcPrintSheet .band{border:.6pt solid #999;padding:1mm 2mm;font-size:8pt;display:flex;gap:4mm;flex-wrap:wrap;margin-bottom:1mm}
#rcPrintSheet .band.r{justify-content:flex-end}
#rcPrintSheet .band.nb{margin-bottom:0;border-bottom:0}
#rcPrintSheet .band.memo{display:flex;gap:2mm;align-items:flex-start;flex-wrap:nowrap}
#rcPrintSheet .band.memo>span{flex:1;min-width:0;font-size:7.6pt;line-height:1.4;max-height:10mm;overflow:hidden;white-space:pre-wrap;word-break:break-all}
#rcPrintSheet .band u{text-decoration:none;border-bottom:.4pt solid #bbb;min-width:22mm;display:inline-block}
#rcPrintSheet .tb{margin-bottom:1mm}
#rcPrintSheet .tb th,#rcPrintSheet .tb td{padding:.6mm 1.4mm;font-size:7.4pt;height:3.9mm;line-height:1.15}
#rcPrintSheet .sum th,#rcPrintSheet .sum td{text-align:center;font-size:8pt}
#rcPrintSheet .sum td.tot{font-weight:800;font-size:9.5pt}
#rcPrintSheet .memo{border:.6pt solid #999;border-top:0;min-height:14mm;padding:1.5mm;font-size:8pt}
#rcPrintSheet .stfoot{flex:0 0 auto;margin-top:1.5mm;text-align:right;font-size:8.5pt}
}`;

const UTILITY_LABELS: Array<{
  utility: SettlementStatementUtility;
  label: string;
}> = [
  { utility: "water", label: "수도" },
  { utility: "elec", label: "전기" },
  { utility: "gas", label: "가스" },
];

function formatNumber(value: PrintValue): string {
  if (value == null || value === "") return "";
  const number = Number(value);
  return number ? number.toLocaleString() : "";
}

function formatText(value: string | null | undefined): string {
  return value ?? "";
}

/** 정본 표기는 `2025.11.25` 다(프로토타입 `dstr()`). 폼의 ISO 값을 점 구분으로 바꾼다. */
function formatPrintDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10).replaceAll("-", ".");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function createLabel(label: string, value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const labelElement = createElement("b");
  labelElement.textContent = label;
  const valueElement = createElement("u");
  valueElement.textContent = value || "\u00a0".repeat(14);
  fragment.append(labelElement, document.createTextNode(" "), valueElement);
  return fragment;
}

function appendBand(
  parent: HTMLElement,
  values: Array<[label: string, value: string]>,
  className = "",
): void {
  const band = createElement("div", `band${className ? ` ${className}` : ""}`);
  for (const [label, value] of values) band.appendChild(createLabel(label, value));
  parent.appendChild(band);
}

function appendCell(
  row: HTMLTableRowElement,
  tagName: "th" | "td",
  value: string,
  className?: string,
  width?: string,
): void {
  const cell = createElement(tagName, className);
  if (width) cell.style.width = width;
  cell.textContent = value;
  row.appendChild(cell);
}

function createTable(className = "tb", withHead = true): {
  table: HTMLTableElement;
  head: HTMLTableSectionElement;
  body: HTMLTableSectionElement;
} {
  const table = createElement("table", className);
  const head = createElement("thead");
  const body = createElement("tbody");
  if (withHead) table.appendChild(head);
  table.appendChild(body);
  return { table, head, body };
}

function appendMeterTable(parent: HTMLElement, model: SettlementStatementPrintModel): void {
  const { table, head, body } = createTable();
  const headerRow = createElement("tr");
  appendCell(headerRow, "th", "구분", undefined, "14%");
  appendCell(headerRow, "th", "전월", "r", "15%");
  appendCell(headerRow, "th", "이사", "r", "15%");
  appendCell(headerRow, "th", "사용량", "r", "14%");
  appendCell(headerRow, "th", "단가", "r", "14%");
  appendCell(headerRow, "th", "금액", "r");
  head.appendChild(headerRow);

  for (const utility of UTILITY_LABELS) {
    const meter = model.meters.find((item) => item.utility === utility.utility);
    const row = createElement("tr");
    appendCell(row, "th", utility.label);
    appendCell(row, "td", formatNumber(meter?.previousReading), "r");
    appendCell(row, "td", formatNumber(meter?.currentReading), "r");
    const usageIsNegative = (meter?.usage ?? 0) < 0;
    appendCell(row, "td", usageIsNegative ? "-" : formatNumber(meter?.usage), "r");
    appendCell(row, "td", formatNumber(meter?.unitPrice), "r");
    appendCell(row, "td", usageIsNegative ? "-" : formatNumber(meter?.charge), "r");
    body.appendChild(row);
  }
  parent.appendChild(table);
}

function appendFeePair(
  row: HTMLTableRowElement,
  item: SettlementStatementManagementRow | undefined,
): void {
  appendCell(row, "th", item?.name ?? "", undefined, "22%");
  appendCell(row, "td", formatNumber(item?.settlement), "r", "28%");
}

function appendManagementFeeTable(
  parent: HTMLElement,
  rows: SettlementStatementManagementRow[],
): void {
  const { table, body } = createTable("tb", false);
  const rowCount = Math.max(10, Math.ceil(rows.length / 2));
  for (let index = 0; index < rowCount; index += 1) {
    const row = createElement("tr");
    appendFeePair(row, rows[index]);
    appendFeePair(row, rows[index + rowCount]);
    body.appendChild(row);
  }
  parent.appendChild(table);
}

function appendOtherFeeTable(
  parent: HTMLElement,
  repairMemo: string | null,
  repairAmount: number | null,
): void {
  const { table, body } = createTable("tb", false);
  for (let index = 0; index < 8; index += 1) {
    const row = createElement("tr");
    appendCell(row, "th", index === 0 ? formatText(repairMemo) : "", undefined, "22%");
    appendCell(row, "td", index === 0 ? formatNumber(repairAmount) : "", "r", "28%");
    appendCell(row, "th", "", undefined, "22%");
    appendCell(row, "td", "", "r", "28%");
    body.appendChild(row);
  }
  parent.appendChild(table);
}

function findUtilityCharge(
  model: SettlementStatementPrintModel,
  utility: SettlementStatementUtility,
): number | null {
  return model.meters.find((meter) => meter.utility === utility)?.charge ?? null;
}

function appendSummaryTable(parent: HTMLElement, model: SettlementStatementPrintModel): void {
  const { table, head, body } = createTable("tb sum");
  const headerRow = createElement("tr");
  ["①전기,수도,가스", "②관리비계", "③기타합계", "미납소계", "청소비", "총합계"].forEach(
    (header) => appendCell(headerRow, "th", header),
  );
  head.appendChild(headerRow);

  const valueRow = createElement("tr");
  [
    formatNumber(model.utilityTotal),
    formatNumber(model.managementSettlementTotal),
    formatNumber(model.repairAmount),
    formatNumber(model.billingUnpaid),
    formatNumber(model.cleaningCost),
  ].forEach((value) => appendCell(valueRow, "td", value, "r"));
  appendCell(valueRow, "td", formatNumber(model.total), "r tot");
  body.appendChild(valueRow);
  parent.appendChild(table);
}

function appendMemo(parent: HTMLElement, note: string | null): void {
  const memo = createElement("div", "band memo");
  const label = createElement("b");
  label.textContent = "비고";
  const content = createElement("span");
  content.textContent = formatText(note);
  memo.append(label, content);
  parent.appendChild(memo);
}

function appendLeftColumn(parent: HTMLElement, model: SettlementStatementPrintModel): void {
  const title = createElement("div", "stt");
  title.textContent = "이 사 정 산 내 역 서";
  parent.appendChild(title);

  appendBand(parent, [
    ["이사일자:", formatPrintDate(model.moveOutDate)],
    ["건물명:", [model.buildingName, model.unitNo].filter(Boolean).join(" ")],
    ["임대인연락처:", formatText(model.ownerPhone)],
  ]);
  appendBand(parent, [
    ["주소:", formatText(model.address)],
    ["입주자연락처:", formatText(model.occupantPhone)],
  ]);

  appendMeterTable(parent, model);
  appendBand(parent, [
    [
      "계산일수:",
      model.chargeDays === null
        ? ""
        : `${model.chargeDays}일 / ${model.monthDays ?? ""}일`,
    ],
    ["① 합계:", formatNumber(model.utilityTotal)],
  ]);

  appendManagementFeeTable(parent, model.managementRows);
  appendBand(parent, [
    ["당월계:", formatNumber(model.managementMonthlyTotal)],
    ["전기료:", formatNumber(findUtilityCharge(model, "elec"))],
    ["수도료:", formatNumber(findUtilityCharge(model, "water"))],
    ["가스료:", formatNumber(findUtilityCharge(model, "gas"))],
    ["② 합계:", formatNumber(model.managementSettlementTotal)],
  ]);

  const heading = createElement("div", "hd");
  heading.textContent = "관리비외 정산비용";
  parent.appendChild(heading);
  appendOtherFeeTable(parent, model.repairMemo, model.repairAmount);
  appendBand(parent, [["③ 기타합계:", formatNumber(model.repairAmount)]], "r");
  appendSummaryTable(parent, model);

  appendBand(
    parent,
    [["정산금 입금계좌:", formatText(model.settleAccount)]],
    model.note ? "nb" : "",
  );
  if (model.note) appendMemo(parent, model.note);
}

function appendRightColumn(parent: HTMLElement, model: SettlementStatementPrintModel): void {
  const heading = createElement("div", "hd big");
  heading.textContent = "내부 시설물 점검표";
  parent.appendChild(heading);

  const { table, head, body } = createTable();
  const headerRow = createElement("tr");
  appendCell(headerRow, "th", "항목", undefined, "44%");
  appendCell(headerRow, "th", "적요");
  head.appendChild(headerRow);
  for (const item of model.checklist) {
    const row = createElement("tr");
    appendCell(row, "th", formatText(item.label));
    appendCell(row, "td", formatText(item.note));
    body.appendChild(row);
  }
  parent.appendChild(table);

  const noteHeading = createElement("div", "hd");
  noteHeading.textContent = "비고";
  parent.appendChild(noteHeading);
  const note = createElement("div", "memo");
  note.textContent = formatText(model.note);
  parent.appendChild(note);
}

function blankModel(model: SettlementStatementPrintModel): SettlementStatementPrintModel {
  return {
    ...model,
    moveOutDate: "",
    buildingName: "",
    unitNo: "",
    ownerPhone: null,
    address: null,
    occupantPhone: null,
    meters: model.meters.map((meter) => ({
      ...meter,
      previousReading: null,
      currentReading: null,
      usage: null,
      unitPrice: null,
      charge: null,
    })),
    chargeDays: null,
    monthDays: null,
    utilityTotal: null,
    managementRows: model.managementRows.map((row) => ({
      ...row,
      charge: 0,
      settlement: 0,
    })),
    managementMonthlyTotal: null,
    managementSettlementTotal: null,
    repairMemo: null,
    repairAmount: null,
    billingUnpaid: null,
    cleaningCost: null,
    total: null,
    settleAccount: null,
    note: null,
    // 정본은 빈 양식에서도 점검 항목명을 남긴다(`cks.map(r=>r.t)` 는 blank 를 타지 않는다).
    // 손으로 적어 넣는 양식이므로 항목명이 지워지면 쓸모가 없다. 적요만 비운다.
    checklist: model.checklist.map((item) => ({ label: item.label, note: null })),
    organizationName: null,
  };
}

function removePrintArtifacts(): void {
  document.getElementById(PRINT_SHEET_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

export function printSettlementStatement(
  model: SettlementStatementPrintModel,
  options: { blank?: boolean } = {},
): void {
  removePrintArtifacts();

  const style = createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);

  const sheet = createElement("div");
  sheet.id = PRINT_SHEET_ID;
  const printModel = options.blank ? blankModel(model) : model;

  const columns = createElement("div", "stwrap");
  const left = createElement("div", "stl");
  const right = createElement("div", "str");
  appendLeftColumn(left, printModel);
  appendRightColumn(right, printModel);
  columns.append(left, right);
  sheet.appendChild(columns);

  // 정본은 빈 양식에서도 하단 연도·회사명을 찍는다(`.stfoot` 은 blank 를 타지 않는다).
  // 회사가 발행하는 양식이므로 발행처 표기는 남긴다.
  const footer = createElement("div", "stfoot");
  const year = String(new Date().getFullYear());
  const organizationName = formatText(model.organizationName);
  footer.textContent = `${year}년      월      일\u00a0\u00a0 ${organizationName}`;
  sheet.appendChild(footer);

  document.body.appendChild(sheet);

  window.setTimeout(() => {
    try {
      window.print();
    } catch {
      // Printing may be unavailable in embedded browser contexts.
    } finally {
      window.setTimeout(removePrintArtifacts, 800);
    }
  }, 250);
}
