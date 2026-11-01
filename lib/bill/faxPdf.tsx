import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import {
  chargePeriodLabel,
  formatBillAmount,
  giroSettlementRows,
  meterSummary,
  PROGRAM_COMPANY_NAME,
  type FaxDocumentData,
} from "./document";
import { NOTO_SANS_KR_WOFF_BASE64 } from "./fonts/notoSansKr";

/**
 * 팩스용 A4 고지서 PDF 서버 렌더러 — **서버 전용, 메모리 버퍼만**.
 *
 * 한글 렌더링을 위해 재배포 가능한 Noto Sans KR(OFL) woff를 base64로 애플리케이션에 포함해 등록한다.
 * (Turbopack는 .woff 모듈을 번들하지 못하므로 파일 경로 대신 임베드 Buffer를 사용한다.)
 * 생성된 PDF는 파일로 저장하지 않고 Buffer로만 반환한다.
 */

let fontRegistered = false;
function ensureFont(): void {
  if (fontRegistered) return;
  Font.register({
    family: "NotoSansKR",
    src: `data:font/woff;base64,${NOTO_SANS_KR_WOFF_BASE64}`,
  });
  fontRegistered = true;
}

/**
 * A4 한 장 고정(2026-11-01 QA #25): 팩스는 페이지 수만큼 과금되고(50원/장) 미리보기도 한 장이라,
 * 크기를 배율(k)로 묶어 두고 내용이 넘치면 배율을 단계적으로 줄여 다시 렌더한다(renderFaxPdf).
 * Noto Sans KR 기본 줄 간격이 커서 lineHeight를 명시한다.
 */
function createStyles(k: number) {
  const px = (value: number) => Math.round(value * k * 100) / 100;
  return StyleSheet.create({
    page: { fontFamily: "NotoSansKR", fontSize: px(9), lineHeight: 1.25, paddingVertical: px(24), paddingHorizontal: 28, color: "#111" },
    header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderColor: "#000", paddingBottom: px(6) },
    title: { fontSize: px(16), lineHeight: 1.25, fontWeight: 700 },
    sub: { fontSize: px(9), marginTop: px(2) },
    addr: { fontSize: px(7.5), color: "#555", marginTop: px(1) },
    qr: { width: px(56), height: px(56) },
    qrCaption: { fontSize: px(6.5), textAlign: "center", marginTop: px(1) },
    infoRow: { flexDirection: "row", marginTop: px(8), borderWidth: 1, borderColor: "#000" },
    infoCell: { flex: 1, paddingVertical: px(4), paddingHorizontal: 6, borderRightWidth: 1, borderColor: "#999" },
    infoLabel: { fontSize: px(7.5), color: "#555" },
    infoValue: { fontSize: px(10), lineHeight: 1.25, marginTop: px(1) },
    amountBox: { marginTop: px(8), borderWidth: 2, borderColor: "#000", paddingVertical: px(6), alignItems: "center" },
    amountLabel: { fontSize: px(7.5), color: "#555" },
    amount: { fontSize: px(18), lineHeight: 1.25, fontWeight: 700, marginTop: px(2) },
    tableHead: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#000", backgroundColor: "#f1f1f1", marginTop: px(8) },
    th: { flex: 1, paddingVertical: px(2.5), paddingHorizontal: 5, fontSize: px(8.5) },
    thRight: { flex: 1, paddingVertical: px(2.5), paddingHorizontal: 5, fontSize: px(8.5), textAlign: "right" },
    row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc" },
    td: { flex: 1, paddingVertical: px(1.5), paddingHorizontal: 5 },
    tdRight: { flex: 1, paddingVertical: px(1.5), paddingHorizontal: 5, textAlign: "right" },
    section: { marginTop: px(8), flexDirection: "row", justifyContent: "space-between" },
    lineGap: { marginTop: px(1.5) },
    notice: { marginTop: px(8), borderWidth: 1, borderColor: "#ccc", padding: px(6), fontSize: px(7.5) },
    footer: { marginTop: px(8), borderTopWidth: 1, borderColor: "#000", paddingTop: px(4), fontSize: px(7.5), color: "#555" },
  });
}
type FaxStyles = ReturnType<typeof createStyles>;

/** 배율 단계. 앞에서부터 렌더해 1페이지에 들어오는 첫 단계를 쓴다(마지막 단계는 넘치면 잘라서라도 1페이지). */
const FAX_SCALES = [1, 0.88, 0.76, 0.66, 0.58, 0.5] as const;

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${year}년 ${Number(month)}월분`;
}

function FaxDocument({
  doc,
  qrDataUrl,
  styles,
  wrap,
}: {
  doc: FaxDocumentData;
  qrDataUrl: string | null;
  styles: FaxStyles;
  wrap: boolean;
}) {
  const notice = [doc.customerNotice, doc.unitNotice].filter(Boolean).join("\n");
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap={wrap}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>관리비 고지서</Text>
            <Text style={styles.sub}>
              {doc.building.name} · {periodLabel(doc.period)}
            </Text>
            <Text style={styles.addr}>{doc.building.address ?? "주소 미등록"}</Text>
            {doc.printOptions.billingPeriod && chargePeriodLabel(doc.chargeStartDate, doc.chargeEndDate) ? (
              <Text style={styles.addr}>관리비 기간 · {chargePeriodLabel(doc.chargeStartDate, doc.chargeEndDate)}</Text>
            ) : null}
          </View>
          {qrDataUrl ? (
            <View>
              {/* @react-pdf/renderer Image는 HTML img가 아니며 alt를 지원하지 않는다. */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qrDataUrl} style={styles.qr} />
              <Text style={styles.qrCaption}>고지서 확인 QR</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>호수</Text>
            <Text style={styles.infoValue}>
              {doc.dong ? `${doc.dong} ` : ""}
              {doc.unitNo}호
            </Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>세대주</Text>
            <Text style={styles.infoValue}>{doc.householdName || "-"}</Text>
          </View>
          <View style={[styles.infoCell, { borderRightWidth: 0 }]}>
            <Text style={styles.infoLabel}>납부 방식</Text>
            <Text style={styles.infoValue}>{doc.autoDebit ? "자동이체" : "일반납부"}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>납기내 금액</Text>
          <Text style={styles.amount}>{formatBillAmount(doc.settlement.payInDue)}</Text>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.th}>부과 항목</Text>
          <Text style={styles.thRight}>금액</Text>
        </View>
        {doc.items.map((item) => {
          const meter = meterSummary(item.name, doc.meters, doc.period, doc.printOptions);
          return (
            <View style={styles.row} key={item.feeItemId}>
              <Text style={styles.td}>{meter ? `${item.name} (${meter})` : item.name}</Text>
              <Text style={styles.tdRight}>{formatBillAmount(item.amount)}</Text>
            </View>
          );
        })}
        {giroSettlementRows(doc.settlement).map((row) => (
          <View style={styles.row} key={row.label}>
            <Text style={[styles.td, { fontWeight: 700 }]}>{row.label}</Text>
            <Text style={[styles.tdRight, { fontWeight: 700 }]}>{row.amount === null ? "" : formatBillAmount(row.amount)}</Text>
          </View>
        ))}

        <View style={styles.section}>
          <View>
            <Text style={{ fontWeight: 700 }}>납부 계좌</Text>
            {doc.accounts.length === 0 ? (
              <Text style={[styles.lineGap, { color: "#777" }]}>등록된 출력 계좌 없음</Text>
            ) : (
              doc.accounts.map((account, index) => (
                <Text style={styles.lineGap} key={`${account.bank}-${index}`}>
                  {account.bank} {account.acct} ({account.holder})
                </Text>
              ))
            )}
          </View>
          <View>
            <Text style={{ fontWeight: 700 }}>납기일</Text>
            <Text style={styles.lineGap}>{doc.dueDate ?? "________________"}</Text>
          </View>
        </View>

        {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}

        <Text style={styles.footer}>발행 회사 · {doc.companyName || PROGRAM_COMPANY_NAME}</Text>
      </Page>
    </Document>
  );
}

/** PDF 버퍼의 페이지 객체 수(`/Type /Page`, `/Pages` 제외). */
export function countPdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

/** 내용 분량으로 시작 배율을 고른다(불필요한 재렌더를 줄이는 추정치일 뿐, 최종 판단은 페이지 수 확인). */
function initialScaleIndex(doc: FaxDocumentData): number {
  const notice = [doc.customerNotice, doc.unitNotice].filter(Boolean).join("\n");
  const noticeLines = notice.length === 0 ? 0 : notice.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 70)), 0);
  const load = doc.items.length + noticeLines * 0.7 + Math.max(0, doc.accounts.length - 1);
  if (load <= 26) return 0;
  if (load <= 32) return 1;
  if (load <= 40) return 2;
  return 3;
}

/**
 * 팩스 문서 데이터를 **A4 한 장** PDF 버퍼로 렌더링한다. 디스크에 저장하지 않는다.
 * 넘치면 배율을 줄여 다시 렌더하고, 마지막 배율에서도 넘치면 페이지 분할을 끄고(wrap=false) 한 장으로 고정한다.
 */
export async function renderFaxPdf(doc: FaxDocumentData): Promise<Buffer> {
  if (!doc.unitNo || !doc.period || !doc.building?.name) {
    throw new Error("fax document is missing required fields");
  }
  ensureFont();
  // 공개 고지서 URL이 없으면(서명 미발급·기준 주소 없음) QR을 생략한다.
  const qrDataUrl = doc.qrPayload ? await QRCode.toDataURL(doc.qrPayload, { margin: 0, width: 120 }) : null;
  for (let index = initialScaleIndex(doc); index < FAX_SCALES.length; index += 1) {
    const pdf = await renderToBuffer(
      <FaxDocument doc={doc} qrDataUrl={qrDataUrl} styles={createStyles(FAX_SCALES[index])} wrap />,
    );
    if (countPdfPages(pdf) <= 1) return pdf;
  }
  const smallest = createStyles(FAX_SCALES[FAX_SCALES.length - 1]);
  return renderToBuffer(<FaxDocument doc={doc} qrDataUrl={qrDataUrl} styles={smallest} wrap={false} />);
}
