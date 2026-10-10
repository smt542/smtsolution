"use client";

import { Document, Font, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import {
  INVOICE_UNSET,
  type InvoiceConfig,
  invoiceNo,
  invoiceVatRate,
  lineItems,
  periodLabel,
  todayLabel,
} from "./InvoiceDocument";

/**
 * 발송비 청구서 PDF(A4 한 쪽). 정본 usage.dc.html의 청구서 저장(saveInv: 720px .iv-body, 패딩 32·34)을
 * A4 폭에 맞춰 그대로 줄인다 — 정본 px × S = pt. 데이터·계산은 미리보기(InvoiceDocument)와 같은 함수를 쓴다.
 * 무거운 PDF 엔진이라 버튼을 누를 때만 import 한다(`await import("./InvoicePdf")`).
 */

const S = 595.28 / 720;
const px = (value: number) => value * S;

// 정본 :root 색
const C = {
  t1: "#191F28",
  t2: "#4E5968",
  t3: "#8B95A1",
  t4: "#B0B8C1",
  line: "#E8EBEE",
  line2: "#F1F3F5",
  bg: "#F2F4F6",
  blue: "#14A497",
};

// 앱 글꼴(Pretendard)과 같은 CDN, 정본 청구서가 쓰는 600·700·800만. WOFF가 아니라 OTF인 이유: PDF 엔진(fontkit)이
// WOFF는 글꼴을 읽을 때마다 압축을 다시 풀어 한 장에 50초 걸렸다(OTF는 1초 안쪽)
const PRETENDARD_OTF = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static";
let fontRegistered = false;
function ensureFont(): void {
  if (fontRegistered) return;
  Font.register({
    family: "Pretendard",
    fonts: [
      { src: `${PRETENDARD_OTF}/Pretendard-SemiBold.otf`, fontWeight: 600 },
      { src: `${PRETENDARD_OTF}/Pretendard-Bold.otf`, fontWeight: 700 },
      { src: `${PRETENDARD_OTF}/Pretendard-ExtraBold.otf`, fontWeight: 800 },
    ],
  });
  // 한글은 띄어쓰기에서만 줄을 바꾼다(기본값은 영어 하이픈 분철)
  Font.registerHyphenationCallback((word) => [word]);
  fontRegistered = true;
}

// 정본 표 칸 폭(720px 저장본 실측 120.16·201.28·99.5·231.06 / 652)
const COL = ["18.43%", "30.87%", "15.26%", "35.44%"] as const;

// Pretendard 세로 치수(hhea, em 비율) — CSS line-height normal = ASCENT + DESCENT
const ASCENT = 0.9521;
const NORMAL = 1.1934;
// 정본 font-variant-numeric: tabular-nums(번호·금액 칸)
const TNUM = ["tnum"];

/**
 * 글자 한 줄 = 정본 줄 상자(box, 정본 px) 높이. 줄높이는 글자마다 준다 — 페이지에 배수로 주면 페이지 기본 글자
 * 크기(18pt) 기준으로 굳어 모든 줄이 21.6pt가 된다. react-pdf는 줄이 글자보다 크면 글자를 줄 위에 붙이므로
 * CSS처럼 가운데에 오도록 반 행간(lead)만큼 내리고, 흐름 높이는 box 그대로 두려고 아래 여백에서 뺀다.
 */
function textLine(size: number, box: number, spaceBelow = 0) {
  const lead = Math.max(0, (box - NORMAL * size) / 2);
  return { fontSize: px(size), lineHeight: box / size, paddingTop: px(lead), marginBottom: px(spaceBelow - lead) };
}

const styles = StyleSheet.create({
  page: {
    paddingTop: px(32),
    paddingBottom: px(32),
    paddingHorizontal: px(34),
    fontFamily: "Pretendard",
    fontWeight: 600,
    color: C.t1,
  },
  hd: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: px(14),
    paddingBottom: px(20),
    borderBottomWidth: px(2),
    borderBottomColor: C.t1,
  },
  title: { ...textLine(20, 24), fontWeight: 800, letterSpacing: px(-0.6) },
  meta: { ...textLine(12.5, 15), marginTop: px(6), color: C.t3, fontFeatureSettings: TNUM },
  co: { marginLeft: "auto", alignItems: "flex-end" },
  coName: { ...textLine(13.5, 13.5 * 1.7, 2), fontWeight: 800, color: C.t1 },
  coLine: { ...textLine(12, 12 * 1.7), color: C.t3, textAlign: "right" },
  // 정본 align-items:baseline — react-pdf에 없어 작은 글자를 두 글자 기준선 차이만큼 내린다
  to: { flexDirection: "row", alignItems: "flex-start", gap: px(10), paddingTop: px(18), paddingBottom: px(16) },
  toName: { ...textLine(17, 20), fontWeight: 800, letterSpacing: px(-0.34) },
  toSub: { ...textLine(12.5, 15), marginTop: px(ASCENT * (17 - 12.5)), color: C.t3 },
  thRow: { flexDirection: "row", borderTopWidth: px(1), borderBottomWidth: px(1), borderColor: C.line },
  th: { fontSize: px(12), lineHeight: 14 / 12, paddingVertical: px(9), fontWeight: 700, color: C.t3 },
  tdRow: { flexDirection: "row", borderBottomWidth: px(1), borderBottomColor: C.line2 },
  td: { fontSize: px(13), lineHeight: 15 / 13, paddingVertical: px(11), color: C.t2, fontFeatureSettings: TNUM },
  tdName: { fontWeight: 700, color: C.t1 },
  right: { textAlign: "right" },
  sum: { marginTop: px(16), marginLeft: "auto", width: px(280), gap: px(9) },
  sr: { flexDirection: "row", alignItems: "center" },
  srLabel: { ...textLine(13, 15), color: C.t3 },
  srValue: { ...textLine(13, 15), marginLeft: "auto", fontWeight: 700, color: C.t2, fontFeatureSettings: TNUM },
  tot: { paddingTop: px(11), borderTopWidth: px(2), borderTopColor: C.t1 },
  totLabel: { ...textLine(15, 18), fontWeight: 800, color: C.t1 },
  totValue: { ...textLine(18, 21), marginLeft: "auto", fontWeight: 800, color: C.blue, fontFeatureSettings: TNUM },
  acc: { marginTop: px(24), backgroundColor: C.bg, borderRadius: px(12), paddingVertical: px(16), paddingHorizontal: px(18) },
  accLabel: { ...textLine(12, 14, 8), fontWeight: 700, color: C.t3 },
  accNo: { ...textLine(15, 18), fontWeight: 800, letterSpacing: px(-0.15), fontFeatureSettings: TNUM },
  accHolder: { ...textLine(12.5, 15), marginTop: px(4), color: C.t3 },
  memo: { ...textLine(12, 12 * 1.6), marginTop: px(14), color: C.t4 },
});

interface InvoicePdfInput {
  row: PlatformOrgBilling;
  month: string;
  config: InvoiceConfig;
  settings: PlatformSettings | undefined;
}

function InvoicePdfDocument({ row, month, config, settings }: InvoicePdfInput) {
  const items = lineItems(row, settings);
  const [year, mon] = month.split("-").map(Number);
  return (
    <Document title={`${year}년 ${mon}월 발송비 청구서 — ${row.orgName}`} author={config.accountHolder === INVOICE_UNSET ? undefined : config.accountHolder} language="ko">
      <Page size="A4" style={styles.page}>
        {/* .iv-hd: 제목·번호 / 발행처 */}
        <View style={styles.hd}>
          <View>
            <Text style={styles.title}>발송비 청구서</Text>
            <Text style={styles.meta}>{invoiceNo(month, row.orgId)} · 발행일 {todayLabel()}</Text>
          </View>
          <View style={styles.co}>
            <Text style={styles.coName}>{config.accountHolder}</Text>
            <Text style={styles.coLine}>사업자등록번호 {config.businessRegNo}</Text>
            <Text style={styles.coLine}>담당 {config.contactPerson}</Text>
          </View>
        </View>

        {/* .iv-to: 수신 업체 */}
        <View style={styles.to}>
          <Text style={styles.toName}>{row.orgName}</Text>
          <Text style={styles.toSub}>{periodLabel(month)}</Text>
        </View>

        {/* .iv-tbl */}
        <View style={styles.thRow}>
          <Text style={[styles.th, { width: COL[0] }]}>항목</Text>
          <Text style={[styles.th, styles.right, { width: COL[1] }]}>발송 건수</Text>
          <Text style={[styles.th, styles.right, { width: COL[2] }]}>단가</Text>
          <Text style={[styles.th, styles.right, { width: COL[3] }]}>금액</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.tdRow}>
            <Text style={[styles.td, { width: "100%", color: C.t3 }]}>청구할 발송 내역이 없습니다.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.name} style={styles.tdRow}>
              <Text style={[styles.td, styles.tdName, { width: COL[0] }]}>{item.name}</Text>
              <Text style={[styles.td, styles.right, { width: COL[1] }]}>{formatNumber(item.count)}건</Text>
              <Text style={[styles.td, styles.right, { width: COL[2] }]}>{formatNumber(item.unitPriceKrw)}원</Text>
              <Text style={[styles.td, styles.right, { width: COL[3] }]}>{formatNumber(item.amountKrw)}원</Text>
            </View>
          ))
        )}

        {/* .iv-sum */}
        <View style={styles.sum}>
          <View style={styles.sr}>
            <Text style={styles.srLabel}>공급가액</Text>
            <Text style={styles.srValue}>{formatNumber(row.subtotalKrw)}원</Text>
          </View>
          <View style={styles.sr}>
            <Text style={styles.srLabel}>부가세 ({invoiceVatRate(row, config)}%)</Text>
            <Text style={styles.srValue}>{formatNumber(row.vatKrw)}원</Text>
          </View>
          <View style={[styles.sr, styles.tot]}>
            <Text style={styles.totLabel}>청구 합계</Text>
            <Text style={styles.totValue}>{formatNumber(row.totalKrw)}원</Text>
          </View>
        </View>

        {/* .iv-acc */}
        <View style={styles.acc}>
          <Text style={styles.accLabel}>입금 계좌 · 기한 {config.due}</Text>
          <Text style={styles.accNo}>{config.account}</Text>
          <Text style={styles.accHolder}>예금주 {config.accountHolder}</Text>
        </View>

        {/* .iv-memo */}
        {config.notice ? <Text style={styles.memo}>{config.notice}</Text> : null}
      </Page>
    </Document>
  );
}

/** 파일 이름: {YYYY}_{MM}월분_{테넌트명}_청구서.pdf (파일 이름에 못 쓰는 글자는 _) */
export function invoiceFileName(month: string, orgName: string): string {
  const [year, mon] = month.split("-");
  const name = orgName.replace(/[\\/:*?"<>|]/g, "_").trim();
  return `${year}_${mon}월분_${name}_청구서.pdf`;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // 내려받기가 시작된 뒤에 URL을 해제한다
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadInvoicePdf(input: InvoicePdfInput): Promise<void> {
  ensureFont();
  const blob = await pdf(<InvoicePdfDocument {...input} />).toBlob();
  saveBlob(blob, invoiceFileName(input.month, input.row.orgName));
}

/** 묶음 파일 이름: {YYYY}_{MM}월분_청구서_전체.zip */
export function invoiceZipFileName(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}_${mon}월분_청구서_전체.zip`;
}

/**
 * 전체 발행: 업체마다 PDF 청구서를 만들어 ZIP 하나로 묶어 내려받는다.
 * 업체별 파일 이름은 개별 발행과 같고, 이름이 겹치면 (2)·(3)을 붙인다.
 */
export async function downloadInvoicePdfs(
  rows: PlatformOrgBilling[],
  month: string,
  config: InvoiceConfig,
  settings: PlatformSettings | undefined,
): Promise<void> {
  ensureFont();
  const files: Record<string, Uint8Array> = {};
  for (const row of rows) {
    const blob = await pdf(<InvoicePdfDocument row={row} month={month} config={config} settings={settings} />).toBlob();
    const base = invoiceFileName(month, row.orgName);
    let name = base;
    for (let index = 2; files[name]; index += 1) name = base.replace(/\.pdf$/, ` (${index}).pdf`);
    files[name] = new Uint8Array(await blob.arrayBuffer());
  }
  // PDF는 이미 압축돼 있어 다시 압축하지 않고 담기만 한다(level 0).
  const { zipSync } = await import("fflate");
  const zipped = zipSync(files, { level: 0 });
  saveBlob(new Blob([zipped], { type: "application/zip" }), invoiceZipFileName(month));
}
