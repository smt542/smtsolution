"use client";

interface GiroStampOverlaysProps {
  reissue?: boolean;
  waterCutoff?: boolean;
  autoDebit?: boolean;
}

/**
 * Stamps are intentionally positioned over the giro sheet. They must never
 * participate in the document flow because they represent ink on the paper.
 */
export function GiroStampOverlays({ reissue = false, waterCutoff = false, autoDebit = false }: GiroStampOverlaysProps) {
  return (
    <>
      {reissue && (
        <div
          aria-label="재발행 도장"
          data-testid="giro-stamp-reissue"
          className="pointer-events-none absolute left-[24%] top-[12.5%] z-20 whitespace-nowrap text-[34px] font-extrabold tracking-[0.12em] text-black"
        >
          재 발 행 용
        </div>
      )}

      {waterCutoff && (
        <div
          aria-label="단수 도장"
          data-testid="giro-stamp-water-cutoff"
          className="pointer-events-none absolute left-[52%] top-[35.5%] z-20 w-[33%] -translate-x-1/2 rounded-[50%] border-[3px] border-[#E03131] px-[8px] py-[14px] text-center text-[#E03131] opacity-[0.92]"
        >
          <div className="text-[19px] font-extrabold tracking-[0.02em]">단수·단수·예고</div>
          <div className="mt-[3px] text-[9.5px] font-bold leading-[1.35]">
            납기일이 지나면 예고없이
            <br />
            단수 목수 있습니다
          </div>
        </div>
      )}

      {autoDebit && (
        <div
          aria-label="자동이체 도장"
          data-testid="giro-stamp-auto-transfer"
          className="pointer-events-none absolute left-[30.8%] top-[57.4%] z-20 rounded-[6px] border-[2px] border-[#E03131] px-[10px] py-[2px] text-[15px] font-extrabold tracking-[0.06em] text-[#E03131] opacity-[0.92]"
        >
          자동이체
        </div>
      )}
    </>
  );
}
