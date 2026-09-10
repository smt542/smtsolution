import { Spinner } from "@/components/common/Spinner";

export default function OverdueLoading() {
  return (
    <div className="flex h-[calc(100dvh-62px)] items-center justify-center" aria-label="권한 확인 중">
      <Spinner />
    </div>
  );
}
