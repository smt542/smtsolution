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
import { formatBillAmount, PROGRAM_COMPANY_NAME, type FaxDocumentData } from "./document";

/**
 * 팩스용 A4 고지서 PDF 서버 렌더러 — **서버 전용, 메모리 버퍼만**.
 *
 * 한글 렌더링을 위해 재배포 가능한 Noto Sans KR(woff)을 애플리케이션에 포함해 등록한다.
 * 생성된 PDF는 파일로 저장하지 않고 Buffer로만 반환한다.
 */

let fontRegistered = false;
function ensureFont(): void {
  if (fontRegistered) return;
  Font.register({
    family: "NotoSansKR",
    src: require.resolve("@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff"),
  });
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansKR", fontSize: 10, padding: 28, color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderColor: "#000", paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: 700 },
  sub: { fontSize: 10, marginTop: 3 },
  addr: { fontSize: 8, color: "#555", marginTop: 2 },
  qrCaption: { fontSize: 7, textAlign: "center", marginTop: 2 },
  infoRow: { flexDirection: "row", marginTop: 12, borderWidth: 1, borderColor: "#000" },
  infoCell: { flex: 1, padding: 6, borderRightWidth: 1, borderColor: "#999" },
  infoLabel: { fontSize: 8, color: "#555" },
  infoValue: { fontSize: 11, marginTop: 2 },
  amountBox: { marginTop: 16, borderWidth: 2, borderColor: "#000", padding: 14, alignItems: "center" },
  amountLabel: { fontSize: 8, color: "#555" },
  amount: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  tableHead: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#000", backgroundColor: "#f1f1f1", marginTop: 16 },
  th: { flex: 1, padding: 5, fontSize: 9 },
  thRight: { flex: 1, padding: 5, fontSize: 9, textAlign: "right" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd" },
  td: { flex: 1, padding: 5 },
  tdRight: { flex: 1, padding: 5, textAlign: "right" },
  section: { marginTop: 14, flexDirection: "row", justifyContent: "space-between" },
  notice: { marginTop: 12, borderWidth: 1, borderColor: "#ccc", padding: 8, fontSize: 8 },
  footer: { marginTop: 16, borderTopWidth: 1, borderColor: "#000", paddingTop: 6, fontSize: 8, color: "#555" },
});

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${year}년 ${Number(month)}월분`;
}

function FaxDocument({ doc, qrDataUrl }: { doc: FaxDocumentData; qrDataUrl: string }) {
  const notice = [doc.customerNotice, doc.unitNotice].filter(Boolean).join("\n");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>관리비 고지서</Text>
            <Text style={styles.sub}>
              {doc.building.name} · {periodLabel(doc.period)}
            </Text>
            <Text style={styles.addr}>{doc.building.address ?? "주소 미등록"}</Text>
          </View>
          <View>
            {/* @react-pdf/renderer Image는 HTML img가 아니며 alt를 지원하지 않는다. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} style={{ width: 60, height: 60 }} />
            <Text style={styles.qrCaption}>고지서 확인 QR</Text>
          </View>
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
          <Text style={styles.amountLabel}>당월 납부 금액</Text>
          <Text style={styles.amount}>{formatBillAmount(doc.amount)}</Text>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.th}>부과 항목</Text>
          <Text style={styles.thRight}>금액</Text>
        </View>
        {doc.items.map((item) => (
          <View style={styles.row} key={item.feeItemId}>
            <Text style={styles.td}>{item.name}</Text>
            <Text style={styles.tdRight}>{formatBillAmount(item.amount)}</Text>
          </View>
        ))}

        <View style={styles.section}>
          <View>
            <Text style={{ fontWeight: 700 }}>납부 계좌</Text>
            {doc.accounts.length === 0 ? (
              <Text style={{ marginTop: 3, color: "#777" }}>등록된 출력 계좌 없음</Text>
            ) : (
              doc.accounts.map((account, index) => (
                <Text style={{ marginTop: 3 }} key={`${account.bank}-${index}`}>
                  {account.bank} {account.acct} ({account.holder})
                </Text>
              ))
            )}
          </View>
          <View>
            <Text style={{ fontWeight: 700 }}>납기일</Text>
            <Text style={{ marginTop: 3 }}>{doc.dueDate ?? "________________"}</Text>
          </View>
        </View>

        {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}

        <Text style={styles.footer}>발행 회사 · {doc.companyName || PROGRAM_COMPANY_NAME}</Text>
      </Page>
    </Document>
  );
}

/** 팩스 문서 데이터를 단일 A4 페이지 PDF 버퍼로 렌더링한다. 디스크에 저장하지 않는다. */
export async function renderFaxPdf(doc: FaxDocumentData): Promise<Buffer> {
  if (!doc.unitNo || !doc.period || !doc.building?.name) {
    throw new Error("fax document is missing required fields");
  }
  ensureFont();
  const qrDataUrl = await QRCode.toDataURL(doc.qrPayload, { margin: 0, width: 120 });
  return renderToBuffer(<FaxDocument doc={doc} qrDataUrl={qrDataUrl} />);
}
