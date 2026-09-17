import { Button } from "@/components/common";

interface CarryOverDialogProps {
  open: boolean;
  period: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function nextPeriod(period: string): { current: string; next: string } {
  const [year, month] = period.split("-").map(Number);
  const current = `${year}년 ${month}월분`;
  const date = new Date(Date.UTC(year, month, 1));
  return {
    current,
    next: `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월분`,
  };
}

export function CarryOverDialog({ open, period, onCancel, onConfirm }: CarryOverDialogProps) {
  if (!open) return null;
  const label = nextPeriod(period);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-4" role="presentation" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="carry-over-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-[400px] rounded-[20px] bg-white px-6 pb-5 pt-6 shadow-[0_30px_35px_rgba(0,0,0,0.4)]"
      >
        <h2 id="carry-over-title" className="text-[15px] font-extrabold leading-[20px] tracking-[-0.2px] text-t1">
          {label.current} 이월을 진행할까요?
        </h2>
        <p className="mt-2 text-[12px] font-medium leading-[17px] text-t3">
          모든 건물의 {label.current.replace(/^\d+년 /, "")}이 {label.next.replace(/^\d+년 /, "")}으로 이월됩니다.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" onClick={onConfirm}>
            이월
          </Button>
        </div>
      </section>
    </div>
  );
}
