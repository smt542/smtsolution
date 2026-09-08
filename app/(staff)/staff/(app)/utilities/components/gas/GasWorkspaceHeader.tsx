import { MenuIcon, PrinterIcon } from "@/components/icons";

interface GasWorkspaceHeaderProps {
  onOpenLedger: () => void;
  onOpenCarryOver: () => void;
}

export function GasWorkspaceHeader({
  onOpenLedger,
  onOpenCarryOver,
}: GasWorkspaceHeaderProps) {
  return (
    <header className="flex h-[62px] shrink-0 items-center border-b border-line bg-white px-6">
      <MenuIcon variant="building-register" className="size-5 text-t3" />
      <div className="ml-4 leading-none">
        <p className="text-[11px] font-semibold text-t3">공과금 관리</p>
        <h1 className="mt-1 text-[16px] font-extrabold text-t1">가스</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenLedger}
          className="flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-white px-3 text-[12.5px] font-bold text-t2 transition-colors hover:bg-bg"
        >
          <PrinterIcon className="size-4" />
          검침대장 출력
        </button>
        <button
          type="button"
          onClick={onOpenCarryOver}
          className="h-9 rounded-[9px] bg-teal px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-teal-d"
        >
          전체 이월
        </button>
      </div>
    </header>
  );
}
