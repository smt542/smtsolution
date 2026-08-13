export const SETTLEMENT_INQUIRY_TYPES = ["water", "electric", "gas", "all"] as const;

export type SettlementInquiryType = (typeof SETTLEMENT_INQUIRY_TYPES)[number];

export function isSettlementInquiryType(value: string): value is SettlementInquiryType {
  return SETTLEMENT_INQUIRY_TYPES.some((type) => type === value);
}
