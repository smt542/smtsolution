import { notFound } from "next/navigation";
import {
  SETTLEMENT_INQUIRY_TYPES,
  isSettlementInquiryType,
} from "@/hooks/reactquery/movingSettlement/inquiryTypes";
import { SettlementInquiryPage } from "../../components/SettlementInquiryPage";
import { AllSettlementInquiryPage } from "../../components/AllSettlementInquiryPage";

export function generateStaticParams() {
  return SETTLEMENT_INQUIRY_TYPES.map((type) => ({ type }));
}

export default async function MovingSettlementInquiryRoute({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!isSettlementInquiryType(type)) notFound();
  if (type === "all") return <AllSettlementInquiryPage />;
  return <SettlementInquiryPage type={type} />;
}
