import type {
  SettlementInquiryRow,
  SettlementInquiryType,
  UpdateSettlementInquiryRow,
} from "@/hooks/reactquery/movingSettlement";
import { AllInquiryTable } from "./AllInquiryTable";
import { UtilityInquiryTable } from "./UtilityInquiryTable";

export interface SettlementInquiryTableProps {
  type: SettlementInquiryType;
  rows: SettlementInquiryRow[];
  total?: number;
  edits: Record<number, UpdateSettlementInquiryRow>;
  onEdit: (
    row: SettlementInquiryRow,
    patch: Partial<UpdateSettlementInquiryRow>,
  ) => void;
}
export function SettlementInquiryTable(props: SettlementInquiryTableProps) {
  const { type, ...rest } = props;
  if (type === "all") {
    return <AllInquiryTable type={type} {...rest} />;
  }
  return <UtilityInquiryTable type={type} {...rest} />;
}
