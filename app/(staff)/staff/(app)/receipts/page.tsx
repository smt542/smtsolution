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
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-62px)] items-center justify-center p-6">
          <Spinner />
        </div>
      }
    >
      <ReceiptManagementContent searchParams={searchParams} />
    </Suspense>
  );
}
