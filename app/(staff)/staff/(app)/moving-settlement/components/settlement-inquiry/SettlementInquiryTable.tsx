import type {
  SettlementInquiryRow,
  UpdateSettlementInquiryRow,
} from "@/hooks/reactquery/movingSettlement";
import { UtilityInquiryTable } from "./UtilityInquiryTable";
import type { UtilityInquiryType } from "./utilityInquiryColumns";

// `all` 은 라우트에서 AllSettlementInquiryPage 로 따로 빠지므로 여기로 오지 않는다.
export interface SettlementInquiryTableProps {
  type: UtilityInquiryType;
  rows: SettlementInquiryRow[];
  total?: number;
  edits: Record<number, UpdateSettlementInquiryRow>;
  onEdit: (
    row: SettlementInquiryRow,
    patch: Partial<UpdateSettlementInquiryRow>,
  ) => void;
}

export function SettlementInquiryTable(props: SettlementInquiryTableProps) {
  return <UtilityInquiryTable {...props} />;
}
