import Image from "next/image";
import type { OutputDocumentType } from "../types";

interface DocumentCardDefinition {
  type: OutputDocumentType;
  icon: string;
  title: string;
  description: string;
}

interface DocumentCardGroup {
  title: string;
  cards: DocumentCardDefinition[];
}

const groups: DocumentCardGroup[] = [
  {
    title: "고지서 출력",
    cards: [
      {
        type: "giro",
        icon: "/figma-assets/bill/document-giro.svg",
        title: "지로 고지서",
        description: "지로 용지에 맞춰 출력합니다 · QR·회사명·자동이체 표시 자동 포함",
      },
    ],
  },
  {
    title: "부속 서류",
    cards: [
      {
        type: "adjustment",
        icon: "/figma-assets/bill/document-adjustment.svg",
        title: "조정명세서",
        description: "전월 대비 조정 내역을 건물별로 출력합니다",
      },
      {
        type: "autoDebit",
        icon: "/figma-assets/bill/document-autodebit.svg",
        title: "자동이체 세대 출력",
        description: "자동이체 세대 목록과 청구 금액을 출력합니다",
      },
    ],
  },
  {
    title: "발송",
    cards: [
      {
        type: "fax",
        icon: "/figma-assets/bill/document-fax.svg",
        title: "팩스 발송",
        description: "건물주·관계처에 팩스로 발송합니다",
      },
    ],
  },
];

export function DocumentCards() {
  return (
    <div className="flex flex-col gap-[16px]">
      {groups.map((group) => {
        const headingId = `document-group-${group.title}`;

        return (
          <section key={group.title} aria-labelledby={headingId} className="flex flex-col gap-[9px]">
            <div className="px-[2px]">
              <h2
                id={headingId}
                className="text-[12.5px] font-extrabold leading-[19px] tracking-[0.01em] text-[#8b95a1]"
              >
                {group.title}
              </h2>
            </div>

            <div className="flex flex-col gap-[9px]">
              {group.cards.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  data-output-document={card.type}
                  className="group flex h-[78px] w-full items-center gap-[14px] rounded-[15px] border border-[#e8ebee] bg-white px-[18px] py-[16px] text-left transition-colors hover:border-[#14a497]/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#e2f5f1]"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-[44px] shrink-0 items-center justify-center rounded-[13px] bg-[#e2f5f1]"
                  >
                    <Image src={card.icon} alt="" width={22} height={22} className="size-[22px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <strong className="block text-[15px] font-extrabold leading-[18px] tracking-[-0.02em] text-[#191f28]">
                      {card.title}
                    </strong>
                    <span className="block pt-[4px] text-[12.5px] font-normal leading-[19px] text-[#8b95a1]">
                      {card.description}
                    </span>
                  </span>

                  <Image
                    aria-hidden="true"
                    src="/figma-assets/bill/chevron-right.svg"
                    alt=""
                    width={18}
                    height={18}
                    className="size-[18px] shrink-0 transition-transform group-hover:translate-x-px"
                  />
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
