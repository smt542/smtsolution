export const partnerLoginClasses = {
  wrap: "flex min-h-0 flex-1 flex-col overflow-auto",
  logo: "flex justify-center px-6 pb-0.5 pt-10",
  // 원본(727×519) 비율 고정 — 최적화된 256px 이미지(256×183)의 반올림 비율로 높이가 0.17px 커지는 것 방지
  logoImg: "aspect-[727/519] h-auto w-[168px]",
  form: "flex flex-col gap-3 px-6 pt-[30px]",
  label: "mb-2 block text-[13px] font-bold text-t2",
  input: "h-[54px] w-full rounded-[14px] border border-line bg-white px-4 text-base font-medium text-t1 outline-none transition focus:border-blue focus:ring-[3px] focus:ring-blue-t",
  pwWrap: "relative [&_input]:pr-[52px]",
  eye: "absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-[11px] bg-transparent [&_svg]:size-5",
  eyeOff: "text-t4",
  eyeOn: "text-blue",
  err: "rounded-[11px] bg-red-t px-[13px] py-[11px] text-[13px] font-semibold leading-[1.5] text-red",
  auto: "flex cursor-pointer select-none items-center gap-[9px] px-0.5 py-1",
  // 정본 #mlAutoBox: 켜면 배경·테두리 청록 + 흰 체크(켬/끔 클래스는 하나만 붙인다)
  autoBox: "flex size-[22px] flex-none items-center justify-center rounded-[7px] border-[1.6px] [&_svg]:size-[13px]",
  autoBoxOff: "border-line bg-white [&_svg]:opacity-0",
  autoBoxOn: "border-blue bg-blue [&_svg]:opacity-100",
  autoLabel: "text-sm font-semibold text-t2",
  spacer: "min-h-6 flex-1",
  foot: "flex flex-col gap-3.5 px-6 pb-[30px] pt-[18px]",
  help: "text-center text-[12.5px] font-medium leading-[1.7] text-t4",
} as const;
