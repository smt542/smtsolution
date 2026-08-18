"use client";

export type OutputDocumentType = "giro" | "adjustment" | "autoDebit" | "fax";

interface DocumentCardsProps {
  onOpen: (type: OutputDocumentType) => void;
  onOpenA4: () => void;
}

interface DocumentCardDefinition {
  type: OutputDocumentType;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

interface DocumentCardGroup {
  title: string;
  description: string;
  cards: DocumentCardDefinition[];
}

const groups: DocumentCardGroup[] = [
  {
    title: "고지서 출력",
    description: "확정된 부과 자료로 세대별 고지서를 발행합니다.",
    cards: [
      { type: "giro" as const, icon: "▦", title: "지로 고지서", description: "QR·자동이체 표시가 포함된 지로형 고지서" },
    ],
  },
  {
    title: "부속 서류",
    description: "부과 검토와 자동이체 업무에 필요한 서류입니다.",
    cards: [
      { type: "adjustment" as const, icon: "±", title: "조정명세서", description: "전월 대비 세대별 부과 조정 내역" },
      { type: "autoDebit" as const, icon: "↓", title: "자동이체 세대 출력", description: "기존 수납 CMS 엑셀을 건물별로 내려받기" },
    ],
  },
  {
    title: "발송",
    description: "외부 채널을 통한 문서 발송 기능입니다.",
    cards: [
      { type: "fax" as const, icon: "↗", title: "팩스 발송", description: "팩스번호가 등록된 선택 세대 일괄 발송" },
    ],
  },
];

export function DocumentCards({ onOpen, onOpenA4 }: DocumentCardsProps) {
  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`document-group-${group.title}`}>
          <div className="mb-3">
            <h2 id={`document-group-${group.title}`} className="text-base font-extrabold text-t1">
              {group.title}
            </h2>
            <p className="mt-1 text-sm text-t3">{group.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.cards.map((card) => (
              <button
                key={card.type}
                type="button"
                onClick={() => onOpen(card.type)}
                className="group min-h-36 rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-t text-xl font-black text-brand">
                    {card.icon}
                  </span>
                  {card.badge && (
                    <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-t3">
                      {card.badge}
                    </span>
                  )}
                </div>
                <strong className="mt-5 block text-base text-t1 group-hover:text-brand">{card.title}</strong>
                <span className="mt-1.5 block text-sm leading-5 text-t3">{card.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="legacy-document-group">
        <div className="mb-3">
          <h2 id="legacy-document-group" className="text-base font-extrabold text-t1">기존 서식</h2>
          <p className="mt-1 text-sm text-t3">기존 A4 고지서 발행·문자 발송 흐름을 그대로 사용할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={onOpenA4}
          className="w-full rounded-2xl border border-dashed border-line bg-surface p-5 text-left shadow-card transition hover:border-brand/40 md:max-w-md"
        >
          <strong className="text-base text-t1">A4 관리비 고지서</strong>
          <span className="mt-1.5 block text-sm text-t3">기존 세대 선택·미리보기·인쇄 화면 열기</span>
        </button>
      </section>
    </div>
  );
}
