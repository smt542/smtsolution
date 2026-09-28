"use client";

import type { CSSProperties } from "react";
import { PrintSheet } from "@/components/common/PrintSheet";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { PAYMENT_METHOD_LABEL } from "../receiptFormat";
import type { HistoryDisplayRow } from "./paymentHistoryRows";

const PRINT_CSS = "@page { size: A4 portrait; margin: 16mm; }";

const cellStyle: CSSProperties = {
  border: "1px solid #000",
  padding: "2mm 3mm",
};

// 정본 라벨 칸은 굵기 없는 td(배경만 #F2F2F2).
const receiptLabelStyle: CSSProperties = {
  ...cellStyle,
  backgroundColor: "#F2F2F2",
};

const receiptHeaderStyle: CSSProperties = {
  ...cellStyle,
  backgroundColor: "#EDEDED",
  fontWeight: 700,
  padding: "1.6mm 2mm",
  textAlign: "center",
};

const receiptBodyStyle: CSSProperties = {
  ...cellStyle,
  padding: "1.6mm 2mm",
};

function formatAmount(value: number | null | undefined): string {
  return value === null || value === undefined || value === 0
    ? ""
    : value.toLocaleString("ko-KR");
}

function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).replaceAll("-", "/") : "";
}

function formatPeriod(value: string): string {
  return value.slice(0, 7);
}

export function UnitReceiptPrint({
  orgId,
  buildingName,
  unitLabel,
  tenantName,
  rows,
  onClose,
}: {
  orgId: number;
  buildingName: string;
  unitLabel: string;
  tenantName: string | null;
  rows: HistoryDisplayRow[];
  onClose: () => void;
}) {
  const { data: setupConfig, isLoading: isConfigLoading } = useSetupConfig(orgId);
  const { data: me, isLoading: isMeLoading } = useMe();
  // 회사명(설정 → 조직명)이 채워진 뒤에 인쇄한다. 캐시가 비어 있으면 조회가 끝날 때까지 기다린다.
  const ready = !isConfigLoading && !isMeLoading;

  const companyName = setupConfig?.companyName?.trim() || me?.orgName?.trim() || "";
  const printableRows = rows.filter((row) => row.payment && row.payment.amount > 0);
  const totals = printableRows.reduce(
    (sum, row) => ({
      charged: sum.charged + (row.rowSummary?.charged ?? 0),
      lateFee: sum.lateFee + row.lateFee,
      amount: sum.amount + (row.payment?.amount ?? 0),
    }),
    { charged: 0, lateFee: 0, amount: 0 },
  );

  return (
    <PrintSheet id="unit-receipt-print" css={PRINT_CSS} ready={ready} onDone={onClose}>
      {/* 정본 `#unit-receipt-print` — 영수증은 모달 없이 바로 인쇄한다. */}
      <div style={{ maxWidth: "150mm", margin: "0 auto" }} data-testid="unit-receipt-print-content">
        <h1
          style={{
            textAlign: "center",
            fontSize: "16pt",
            fontWeight: 700,
            letterSpacing: "0.08em",
            margin: "0 0 8mm",
          }}
        >
          영 수 증
        </h1>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10pt",
            marginBottom: "6mm",
          }}
        >
          <tbody>
            <tr>
              <td style={{ ...receiptLabelStyle, width: "26mm" }}>건물</td>
              <td style={cellStyle}>{buildingName}</td>
              <td style={{ ...receiptLabelStyle, width: "20mm" }}>호실</td>
              <td style={cellStyle}>{unitLabel}</td>
            </tr>
            <tr>
              <td style={receiptLabelStyle}>세대주</td>
              <td colSpan={3} style={cellStyle}>{tenantName ?? ""}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
          <thead>
            <tr>
              <th style={receiptHeaderStyle}>년월</th>
              <th style={receiptHeaderStyle}>당월계</th>
              <th style={receiptHeaderStyle}>연체료</th>
              <th style={receiptHeaderStyle}>수납액</th>
              <th style={receiptHeaderStyle}>수납일자</th>
              <th style={receiptHeaderStyle}>은행</th>
            </tr>
          </thead>
          <tbody>
            {printableRows.map((row) => {
              const payment = row.payment;
              if (!payment) return null;
              return (
                <tr key={row.key}>
                  <td style={{ ...receiptBodyStyle, textAlign: "center" }}>{formatPeriod(row.rowPeriod)}</td>
                  <td style={{ ...receiptBodyStyle, textAlign: "right" }}>{formatAmount(row.rowSummary?.charged)}</td>
                  <td style={{ ...receiptBodyStyle, textAlign: "right" }}>{formatAmount(row.lateFee)}</td>
                  <td style={{ ...receiptBodyStyle, textAlign: "right" }}>{formatAmount(payment.amount)}</td>
                  <td style={{ ...receiptBodyStyle, textAlign: "center" }}>{formatDate(payment.paidAt)}</td>
                  <td style={{ ...receiptBodyStyle, textAlign: "center" }}>
                    {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td style={{ ...receiptBodyStyle, backgroundColor: "#F2F2F2", fontWeight: 700, textAlign: "center" }}>합계</td>
              <td style={{ ...receiptBodyStyle, backgroundColor: "#F2F2F2", fontWeight: 700, textAlign: "right" }}>
                {formatAmount(totals.charged)}
              </td>
              <td style={{ ...receiptBodyStyle, backgroundColor: "#F2F2F2", fontWeight: 700, textAlign: "right" }}>
                {formatAmount(totals.lateFee)}
              </td>
              <td style={{ ...receiptBodyStyle, backgroundColor: "#F2F2F2", fontWeight: 700, textAlign: "right" }}>
                {formatAmount(totals.amount)}
              </td>
              {/* 정본 칸은 border만 준 td라 padding은 브라우저 기본값 1px(앱은 preflight가 0으로 지움). */}
              <td colSpan={2} style={{ border: "1px solid #000", padding: "1px" }} />
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: "12mm", textAlign: "right", fontSize: "10pt" }}>{companyName}</div>
      </div>
    </PrintSheet>
  );
}
