import type { PrintableAccount } from "@/lib/bill/document";

export type OutputDocumentType = "giro" | "adjustment" | "autoDebit" | "fax";

export interface BillBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
}

export interface BillPageData {
  orgId: number;
  buildings: BillBuilding[];
  companyName: string;
  accounts: PrintableAccount[];
  customerNotice: string | null;
}
