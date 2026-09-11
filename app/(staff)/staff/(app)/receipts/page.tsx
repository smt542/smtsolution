import { Suspense } from "react";
import { Spinner } from "@/components/common";
import {
  ReceiptManagementContent,
  type ReceiptSearchParams,
} from "./ReceiptManagementContent";

export default function ReceiptManagementPage({
  searchParams,
}: {
  searchParams: Promise<ReceiptSearchParams>;
}) {
  return (
    <Suspense fallback={<Spinner />}>
      <ReceiptManagementContent searchParams={searchParams} />
    </Suspense>
  );
}
