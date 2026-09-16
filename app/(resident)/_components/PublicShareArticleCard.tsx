import type { ReactNode } from "react";

type PublicShareArticleCardProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  metadata: ReactNode;
  children: ReactNode;
};

export default function PublicShareArticleCard({
  eyebrow,
  title,
  metadata,
  children,
}: PublicShareArticleCardProps) {
  return (
    <article className="rounded-[18px] border border-line bg-white px-5 py-[22px] shadow-[0_8px_24px_rgb(15_23_42_/_5%)]">
      <p className="mb-2 text-xs font-extrabold text-blue-d">{eyebrow}</p>
      <h1 className="m-0 text-[22px] font-bold leading-[1.35] tracking-[-0.035em] text-t1">{title}</h1>
      <p className="mt-3 text-[13px] text-t3">{metadata}</p>
      {children}
    </article>
  );
}
