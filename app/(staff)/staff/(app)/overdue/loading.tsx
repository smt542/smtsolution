import { Spinner } from "@/components/common";

export default function OverdueLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-62px)] items-center justify-center">
      <Spinner label="미납 관리 화면 불러오는 중" />
    </div>
  );
}
