import { SettlementActionBar } from "./SettlementActionBar";

export function SettlementEmptyPanel({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
          <h2 className="text-[15px] font-extrabold text-t1">이사정산 입력</h2>
        </div>
        {/* 원본 `.ms-body{padding:16px 18px 20px}` > `.ms-empty{gap:5px;padding:34px 20px}` */}
        <div className="flex min-h-0 flex-1 flex-col px-[18px] pb-[20px] pt-[16px]">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[5px] px-[20px] py-[34px] text-center text-t3">
            <p className="text-[15px] font-bold leading-[18px] text-t1">건물과 호실을 선택해 주세요</p>
            <p className="text-[13px] leading-[1.55]">
              선택한 세대의 이사정산 내역을
              <br />
              여기에서 작성해요
            </p>
          </div>
        </div>
        {/* 원본 `.ms-foot>span{display:flex;align-items:baseline;gap:6px}` */}
        <div className="flex h-[50px] shrink-0 items-center justify-end border-t border-[#dce1e7] bg-[#f7f9fa] px-[18px]">
          <span className="flex items-baseline gap-[6px]">
            <span className="text-[12px] font-bold leading-[15px] text-t2">총 요금액</span>
            <strong className="text-[19px] font-extrabold leading-[23px] tracking-[-0.02em] text-t1">
              —
            </strong>
          </span>
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
