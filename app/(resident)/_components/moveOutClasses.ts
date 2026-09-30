// 퇴실 신청 바텀시트 — 원본 resident-home `.ms-*`(신청·희망일 변경 폼 #rhMsForm, 현황 #rhMsView, 접수 완료 #rhMsOk)
export const moveOutClasses = {
  title: "text-[19px] font-extrabold tracking-[-0.025em]",
  desc: "mt-[7px] text-[13px] font-semibold leading-[1.65] text-t3 [text-wrap:pretty] [&_b]:font-extrabold [&_b]:text-t1",
  fieldLabel: "mb-[7px] mt-[18px] text-[12.5px] font-bold text-t3",
  hint: "mt-[7px] text-[11.5px] font-semibold leading-[1.55] text-t4",
  note: "mt-3.5 rounded-[14px] bg-blue-t2 px-[15px] py-[13px] [&_b]:mb-[5px] [&_b]:block [&_b]:text-xs [&_b]:font-extrabold [&_b]:text-blue-d [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[15px] [&_li]:text-xs [&_li]:font-semibold [&_li]:leading-[1.6] [&_li]:text-t2",
  // `.ms-sum` — 위 간격은 첫 줄 16px, 이어지는 줄 8px(원본 `.ms-sum + .ms-sum`)이라 호출부가 sumFirst·sumNext를 붙인다
  sum: "flex items-center justify-between gap-2.5 rounded-[14px] bg-[#f7f8fa] px-4 py-[13px] text-left [&>span]:text-[12.5px] [&>span]:font-semibold [&>span]:text-t3 [&>b]:text-sm [&>b]:font-extrabold [&>b]:tracking-[-0.02em]",
  sumFirst: "mt-4",
  sumNext: "mt-2",
  // `.ms-btn`(비활성 --line 배경) · `.ms-btn.ghost`
  submit: "mt-[18px] w-full disabled:cursor-not-allowed disabled:bg-line disabled:text-t4",
  ghost: "mt-2 w-full",
  ok: "pt-1.5 text-center",
  okIcon: "mx-auto mb-3.5 flex size-[60px] items-center justify-center rounded-[20px] bg-blue-t text-blue-d [&_svg]:size-[29px]",
  okTitle: "m-0 text-[19px] font-extrabold tracking-[-0.025em]",
  okDesc: "mt-2 text-[13px] font-semibold leading-[1.65] text-t3",
  error: "mt-3 text-center text-xs font-bold text-red",
  state: "flex min-h-[100px] flex-col items-center justify-center gap-3 pt-[18px] text-center text-[13px] text-t3 [&_b]:text-t1 [&_button]:h-10 [&_button]:rounded-[12px] [&_button]:border-0 [&_button]:bg-blue [&_button]:px-4 [&_button]:font-extrabold [&_button]:text-white",
} as const;
