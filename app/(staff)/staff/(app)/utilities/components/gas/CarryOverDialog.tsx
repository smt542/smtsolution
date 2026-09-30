interface CarryOverDialogProps {
  open: boolean;
  year: number;
  month: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function CarryOverDialog({ open, year, month, onClose, onConfirm }: CarryOverDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="carry-over-title" className="h-[157px] w-[400px] rounded-2xl bg-white p-6 shadow-[0_18px_45px_rgba(23,31,40,0.24)]">
        <h2 id="carry-over-title" className="text-[18px] font-extrabold leading-5 text-t1">{year}년 {month}월분 이월을 진행할까요?</h2>
        <p className="mt-2 text-[12.5px] font-medium text-t3">모든 건물의 {month}월분이 {month === 12 ? 1 : month + 1}월분으로 이월됩니다.</p>
        <div className="mt-[25px] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 min-w-[60px] rounded-[11px] bg-bg px-4 text-[13.5px] font-bold text-t2 hover:bg-line">취소</button>
          <button type="button" onClick={onConfirm} className="h-10 min-w-[60px] rounded-[11px] bg-teal px-4 text-[13.5px] font-bold text-white hover:bg-teal-d">이월</button>
        </div>
      </section>
    </div>
  );
}
