import type {
  SettlementInquiryRow,
  SettlementInquiryType,
} from "@/hooks/reactquery/movingSettlement";

export type UtilityInquiryType = Exclude<SettlementInquiryType, "all">;
type NumericField =
  | "elecPreviousReading"
  | "elecCurrentReading"
  | "elecUsage"
  | "elecCharge"
  | "gasPreviousReading"
  | "gasCurrentReading"
  | "gasUsage"
  | "gasCharge"
  | "waterPreviousReading"
  | "waterCurrentReading"
  | "waterUsage"
  | "waterCharge";
type PaidDateField = "elecPaidDate" | "gasPaidDate" | "waterPaidDate";

export interface UtilityInquiryFieldMapping {
  previousReading: Extract<keyof SettlementInquiryRow, NumericField>;
  currentReading: Extract<keyof SettlementInquiryRow, NumericField>;
  usage: Extract<keyof SettlementInquiryRow, NumericField>;
  charge: Extract<keyof SettlementInquiryRow, NumericField>;
  paidDate: Extract<keyof SettlementInquiryRow, PaidDateField>;
  paidDateLabel: string;
}

export interface UtilityInquiryColumn {
  key:
    | "no"
    | "location"
    | "buildingName"
    | "buildingAddress"
    | "unitNo"
    | "moveOutDate"
    | "meterNo"
    | "customerNo"
    | "previousReading"
    | "currentReading"
    | "usage"
    | "charge"
    | "paidDate";
  label: string;
  width: number;
  align: "left" | "right";
}

const COLUMN_DEFINITIONS: Omit<UtilityInquiryColumn, "label">[] = [
  { key: "no", width: 48.6875, align: "right" },
  { key: "location", width: 110.75, align: "left" },
  { key: "buildingName", width: 140.453125, align: "left" },
  { key: "buildingAddress", width: 316.71875, align: "left" },
  { key: "unitNo", width: 57.4375, align: "left" },
  { key: "moveOutDate", width: 142.078125, align: "left" },
  { key: "meterNo", width: 140.453125, align: "left" },
  { key: "customerNo", width: 151.265625, align: "left" },
  { key: "previousReading", width: 71.765625, align: "right" },
  { key: "currentReading", width: 71.765625, align: "right" },
  { key: "usage", width: 61.828125, align: "right" },
  { key: "charge", width: 118.84375, align: "right" },
  { key: "paidDate", width: 199.953125, align: "left" },
];

const FIELD_MAPPINGS: Record<UtilityInquiryType, UtilityInquiryFieldMapping> = {
  electric: {
    previousReading: "elecPreviousReading",
    currentReading: "elecCurrentReading",
    usage: "elecUsage",
    charge: "elecCharge",
    paidDate: "elecPaidDate",
    paidDateLabel: "한전입금일",
  },
  gas: {
    previousReading: "gasPreviousReading",
    currentReading: "gasCurrentReading",
    usage: "gasUsage",
    charge: "gasCharge",
    paidDate: "gasPaidDate",
    paidDateLabel: "도시가스입금일",
  },
  water: {
    previousReading: "waterPreviousReading",
    currentReading: "waterCurrentReading",
    usage: "waterUsage",
    charge: "waterCharge",
    paidDate: "waterPaidDate",
    paidDateLabel: "상수도입금일",
  },
};

const BASE_LABELS: Record<UtilityInquiryColumn["key"], string> = {
  no: "NO",
  location: "소재지",
  buildingName: "건물명",
  buildingAddress: "건물 주소",
  unitNo: "호실",
  moveOutDate: "해약일자",
  meterNo: "계기번호",
  customerNo: "고객번호",
  previousReading: "최종검침",
  currentReading: "이주검침",
  usage: "사용량",
  charge: "정산요금",
  paidDate: "입금일",
};

export function getUtilityInquiryFieldMapping(
  type: UtilityInquiryType,
): UtilityInquiryFieldMapping {
  return FIELD_MAPPINGS[type];
}

export function getUtilityInquiryColumns(
  type: UtilityInquiryType,
): UtilityInquiryColumn[] {
  const fields = FIELD_MAPPINGS[type];
  return COLUMN_DEFINITIONS.map((column) => ({
    ...column,
    label: column.key === "paidDate" ? fields.paidDateLabel : BASE_LABELS[column.key],
  }));
}

