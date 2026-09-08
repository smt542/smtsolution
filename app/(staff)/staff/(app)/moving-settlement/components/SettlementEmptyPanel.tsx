import { SettlementActionBar } from "./SettlementActionBar";

export function SettlementEmptyPanel({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
          <h2 className="text-[15px] font-extrabold text-t1">이사정산 입력</h2>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center px-[20px] py-[34px] text-center">
          <div>
            <p className="text-[15px] font-bold text-t1">건물과 호실을 선택해 주세요</p>
            <p className="mt-[5px] text-[13px] leading-[20px] text-t3">
              선택한 세대의 이사정산 내역을
              <br />
              여기에서 작성해요
            </p>
          </div>
        </div>
        <div className="flex h-[50px] shrink-0 items-center justify-end border-t border-[#dce1e7] bg-[#f7f9fa] px-[18px]">
          <span className="text-[12px] font-bold text-t2">총 요금액</span>
          <strong className="ml-[8px] text-[19px] font-extrabold text-t1">-</strong>
        </div>
      </section>
      <SettlementActionBar
        onSave={onAction}
        onMidMoveout={onAction}
        onMoveout={onAction}
        onPrint={onAction}
        onBlankPrint={() => window.print()}
        onDelete={onAction}
      />
    </div>
  );
}
