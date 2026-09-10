import type { PrintableAccount } from "@/lib/bill/document";

export interface BillBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
}

export interface BillPageData {
  buildings: BillBuilding[];
  companyName: string;
  accounts: PrintableAccount[];
  customerNotice: string | null;
}
