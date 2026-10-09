import type { BillPrintOptions, PrintableAccount } from "@/lib/bill/document";

export type OutputDocumentType = "giro" | "adjustment" | "autoDebit" | "fax";

export interface BillBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
  /** 고지서 부과 그룹 유형(`basic_extra.groupType`, 1~5). 출력 모달 '그룹' 필터가 쓴다. */
  basicExtra: { groupType?: string | null } | null;
}

export interface BillPageData {
  orgId: number;
  buildings: BillBuilding[];
  companyName: string;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  /** setup_config 고지서 출력 옵션(수도 단가·관리비 기간·증감량·연체료 합산). */
  printOptions: BillPrintOptions;
}
