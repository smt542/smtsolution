import type { BillPageData } from "./types";

interface ErrorResponse {
  error?: string;
}

export async function fetchBillPageData(): Promise<BillPageData> {
  const response = await fetch("/api/bill/page-data", { cache: "no-store" });
  const result = (await response.json().catch(() => null)) as BillPageData | ErrorResponse | null;

  if (!response.ok) {
    throw new Error(result && "error" in result && result.error
      ? result.error
      : "서류 발행 정보를 불러오지 못했습니다.");
  }

  return result as BillPageData;
}
