import type { XlsxColumn } from "@/lib/export/xlsx";

const STATUS_LABEL: Record<string, string> = {
  pending: "미결",
  completed: "완결",
  on_hold: "보류",
  repeat: "반복",
};

export interface AsStatusExportRow {
  receivedAt: string;
  buildingName: string;
  unitNo: string;
  title: string;
  content: string;
  status: string;
  resolution: string;
}

function formatReceivedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildAsStatusWorkbookData(rows: AsStatusExportRow[]): {
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
} {
  return {
    columns: [
      { header: "접수일", key: "receivedAt", width: 14 },
      { header: "건물명", key: "buildingName", width: 24 },
      { header: "호실명", key: "unitNo", width: 16 },
      { header: "접수내용", key: "content", width: 48 },
      { header: "상태", key: "status", width: 10 },
      { header: "처리결과", key: "resolution", width: 42 },
    ],
    rows: rows.map((row) => ({
      receivedAt: formatReceivedAt(row.receivedAt),
      buildingName: row.buildingName,
      unitNo: row.unitNo,
      content: [row.title, row.content].filter(Boolean).join("\n"),
      status: STATUS_LABEL[row.status] ?? row.status,
      resolution: row.resolution,
    })),
  };
}
