export interface AttachmentPrintItem {
  key: string;
  url: string;
  fileName: string;
}

interface AttachmentPrintSheetProps {
  /** 머리글 앞머리("영수증"·"공사사진") */
  kindLabel: string;
  /** 머리글 뒷머리("2026년 수선충당금 적립금 (1월분) · 2026.01.31 · 번호 1") */
  description: string;
  items: readonly AttachmentPrintItem[];
}

/**
 * 원본 출력물은 A4 세로·여백 14mm 흰 바탕이다. 용지 설정은 @page로만 지정할 수 있고,
 * 앱 body의 회색 배경은 "배경 그래픽" 인쇄 옵션을 켜면 따라 나오므로 함께 덮는다.
 */
const PRINT_CSS = "@page{size:A4 portrait;margin:14mm}@media print{html,body{background:#fff}}";

/**
 * 첨부(영수증·공사사진) 인쇄 시트. 머리글은 첫 장에만 찍고 한 장에 사진 하나씩 채운다.
 * 원본은 줄높이가 normal 기준이다. 앱 기본 1.5를 그대로 두면 머리글이 세로로 늘어난다.
 */
export function AttachmentPrintSheet({ kindLabel, description, items }: AttachmentPrintSheetProps) {
  return (
    <section
      className="hidden bg-white text-black leading-[normal] print:block"
      aria-label={`${kindLabel} 인쇄물`}
      data-testid="attachment-print"
    >
      <style>{PRINT_CSS}</style>

      <h1 className="text-[11.25pt] font-bold">{`${kindLabel} · ${description}`}</h1>
      <p className="mt-[5pt] mb-[12pt] text-[8.625pt] text-[#5B6673]">{items.length}장</p>

      {items.map((item, index) => (
        <figure key={item.key} className="break-inside-avoid break-after-page last:break-after-auto">
          {/*
            원본은 사진을 좌측 위에 붙이고 최대 236mm까지만 키운다. 고정 크기 박스에
            넣으면 세로 사진이 가운데로 밀리므로, 실제 비율을 쓰는 img로 둔다
            (next/image는 가로·세로를 알아야 하는데 첨부 메타에는 없다).
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={`${kindLabel} ${index + 1}`} className="block max-h-[236mm] max-w-full" />
          <figcaption className="mt-[4.5pt] text-[7.875pt] text-t3">{`${index + 1}. ${item.fileName}`}</figcaption>
        </figure>
      ))}
    </section>
  );
}
