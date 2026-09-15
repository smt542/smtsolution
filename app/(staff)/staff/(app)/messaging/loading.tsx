import { Spinner } from "@/components/common";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-62px)] items-center justify-center p-6">
      <Spinner label="메시지 화면 불러오는 중" />
    </div>
  );
}
