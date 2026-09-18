import type { BillPageData } from "./types";
import type { OutputDocumentType } from "./types";

interface ErrorResponse {
  error?: string;
}

export async function fetchBillPageData(output?: OutputDocumentType): Promise<BillPageData> {
  const query = output ? `?output=${encodeURIComponent(output)}` : "";
  const response = await fetch(`/api/bill/page-data${query}`, { cache: "no-store" });
  const result = (await response.json().catch(() => null)) as BillPageData | ErrorResponse | null;

  if (!response.ok) {
    throw new Error(result && "error" in result && result.error
      ? result.error
      : "서류 발행 정보를 불러오지 못했습니다.");
  }

  return result as BillPageData;
}
