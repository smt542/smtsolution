import type { ReactNode } from "react";

type ResidentScreenFrameProps = {
  variant: "public" | "legal";
  header: ReactNode;
  children: ReactNode;
};

const variantStyles = {
  public: {
    page: "flex min-h-0 flex-1 flex-col bg-bg",
    header: "flex flex-none items-center justify-between gap-3 bg-white px-5 pb-[15px] pt-[calc(env(safe-area-inset-top)+17px)] text-xs font-bold text-t3",
    content: "min-h-0 flex-1 overflow-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4",
  },
  legal: {
    page: "flex min-h-0 flex-1 flex-col bg-white",
    header: "flex flex-none items-center gap-2 border-b border-line2 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+12px)] [&_a]:flex [&_a]:size-[38px] [&_a]:items-center [&_a]:justify-center [&_a]:rounded-xl [&_a]:text-t2 [&_a]:no-underline [&_a]:hover:bg-bg [&_a_svg]:size-[22px] [&_h1]:m-0 [&_h1]:text-[17px] [&_h1]:font-extrabold [&_h1]:tracking-[-0.02em]",
    content: "min-h-0 flex-1 overflow-auto px-6 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[22px] text-t2 [&_h2]:mb-2 [&_h2]:mt-[26px] [&_h2]:text-[15px] [&_h2]:font-extrabold [&_h2]:tracking-[-0.02em] [&_p]:mb-2 [&_p]:text-[13.5px] [&_p]:font-medium [&_p]:leading-[1.75] [&_ol]:mb-2 [&_ol]:pl-[18px] [&_ol]:list-decimal [&_ul]:mb-2 [&_ul]:pl-[18px] [&_ul]:list-disc [&_li]:mb-[5px] [&_li]:text-[13.5px] [&_li]:font-medium [&_li]:leading-[1.75]",
  },
} as const;

export default function ResidentScreenFrame({
  variant,
  header,
  children,
}: ResidentScreenFrameProps) {
  const variantStyle = variantStyles[variant];

  return (
    <div className={variantStyle.page}>
      <header className={variantStyle.header}>{header}</header>
      <main className={variantStyle.content}>{children}</main>
    </div>
  );
}
