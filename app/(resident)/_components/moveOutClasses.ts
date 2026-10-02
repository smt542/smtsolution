// 퇴실 신청 바텀시트 — 원본 resident-home `.ms-*`(신청·희망일 변경 폼 #rhMsForm, 현황 #rhMsView, 접수 완료 #rhMsOk)
export const moveOutClasses = {
  // 신청 폼·현황 = 제목(손잡이와 함께 고정) / 가운데만 스크롤 / 버튼 고정(3차 QA, Figma 1091:4533 modal_head·modal_foot).
  // 가운데는 좌우 여백 22px을 시트 끝까지 넓혀 스크롤바가 시트 가장자리에 붙는다.
  // 제목과 가운데 사이 간격은 Figma처럼 둘로 나눈다(폼 9+9=원본 `.ms-fl` 위 18px, 현황 8+8=첫 `.ms-sum` 위 16px).
  sheet: "flex min-h-0 flex-col",
  formHead: "shrink-0 pb-[9px]",
  formBody: "-mx-[22px] min-h-0 overflow-y-auto overscroll-contain px-[22px] pt-[9px]",
  viewHead: "shrink-0 pb-2",
  viewBody: "-mx-[22px] min-h-0 overflow-y-auto overscroll-contain px-[22px] pt-2",
  // Figma modal_foot: 버튼 위 18px(submit의 mt) · 아래 15px
  foot: "shrink-0 pb-[15px]",
  title: "text-[19px] font-extrabold tracking-[-0.025em]",
  desc: "mt-[7px] text-[13px] font-semibold leading-[1.65] text-t3 [text-wrap:pretty] [&_b]:font-extrabold [&_b]:text-t1",
  fieldLabel: "mb-[7px] text-[12.5px] font-bold text-t3",
  hint: "mt-[7px] text-[11.5px] font-semibold leading-[1.55] text-t4",
  note: "mt-3.5 rounded-[14px] bg-blue-t2 px-[15px] py-[13px] [&_b]:mb-[5px] [&_b]:block [&_b]:text-[12px] [&_b]:font-extrabold [&_b]:text-blue-d [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[15px] [&_li]:text-[12px] [&_li]:font-semibold [&_li]:leading-[1.6] [&_li]:text-t2",
  // `.ms-sum` — 위 간격은 첫 줄 16px, 이어지는 줄 8px(원본 `.ms-sum + .ms-sum`)이라 호출부가 sumFirst·sumNext를 붙인다.
  // 현황 첫 줄의 16px은 viewHead·viewBody 여백이 대신하므로 거기선 sumFirst를 붙이지 않는다.
  sum: "flex items-center justify-between gap-2.5 rounded-[14px] bg-[#f7f8fa] px-4 py-[13px] text-left [&>span]:text-[12.5px] [&>span]:font-semibold [&>span]:text-t3 [&>b]:text-[14px] [&>b]:font-extrabold [&>b]:tracking-[-0.02em]",
  sumFirst: "mt-4",
  sumNext: "mt-2",
  // `.ms-btn`(비활성 --line 배경) · `.ms-btn.ghost`
  submit: "mt-[18px] w-full disabled:cursor-not-allowed disabled:bg-line disabled:text-t4",
  ghost: "mt-2 w-full",
  // 접수 완료·로딩·오류는 시트 아래 여백(원본 18px)을 직접 갖는다
  ok: "pt-1.5 pb-[18px] text-center",
  okIcon: "mx-auto mb-3.5 flex size-[60px] items-center justify-center rounded-[20px] bg-blue-t text-blue-d [&_svg]:size-[29px]",
  okTitle: "m-0 text-[19px] font-extrabold tracking-[-0.025em]",
  okDesc: "mt-2 text-[13px] font-semibold leading-[1.65] text-t3",
  error: "mt-3 text-center text-xs font-bold text-red",
  // 최소 높이 = 원본 100px + 시트 아래 여백 18px(안으로 옮겼으므로)
  state: "flex min-h-[118px] flex-col items-center justify-center gap-3 pb-[18px] pt-[18px] text-center text-[13px] text-t3 [&_b]:text-t1 [&_button]:h-10 [&_button]:rounded-[12px] [&_button]:border-0 [&_button]:bg-blue [&_button]:px-4 [&_button]:font-extrabold [&_button]:text-white",
} as const;
