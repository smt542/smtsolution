interface CarryOverConfirmModalProps {
  open: boolean;
  year: number;
  month: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CarryOverConfirmModal({
  open,
  year,
  month,
  onCancel,
  onConfirm,
}: CarryOverConfirmModalProps) {
  if (!open) return null;
  const next = new Date(year, month, 1);
  const nextYear = next.getFullYear();
  const nextMonth = next.getMonth() + 1;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-scrim p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="carry-over-title" aria-describedby="carry-over-description" className="w-full max-w-[400px] rounded-[20px] bg-white px-6 pb-5 pt-6 shadow-2xl">
        <h2 id="carry-over-title" className="text-[17px] font-extrabold leading-6 text-t1">{year}년 {month}월분 이월을 진행할까요?</h2>
        <p id="carry-over-description" className="mt-2 text-[13.5px] leading-5 text-t3">모든 건물의 {month}월분이 {nextYear === year ? "" : `${nextYear}년 `}{nextMonth}월분으로 이월됩니다.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[11px] bg-bg text-[13.5px] font-bold text-t2 hover:bg-line2">취소</button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-[11px] bg-teal text-[13.5px] font-bold text-white hover:bg-brand-dark">이월</button>
        </div>
      </section>
    </div>
  );
}
