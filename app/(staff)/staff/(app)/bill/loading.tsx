import { Spinner } from "@/components/common";

export default function BillLoading() {
  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
      <Spinner />
    </div>
  );
}
