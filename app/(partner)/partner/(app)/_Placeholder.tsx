export function PartnerPlaceholder({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="text-lg font-extrabold text-t1">{title}</div>
      <div className="text-sm font-semibold text-t3">{desc ?? "준비 중이에요"}</div>
    </div>
  );
}
