import { Spinner } from "@/components/common";

export default function BillLoading() {
  return (
    <div className="flex min-h-[calc(100vh-62px)] items-center justify-center bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
      <Spinner label="고지서 화면 불러오는 중" />
    </div>
  );
}
