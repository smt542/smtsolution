import { Checkbox } from "@/components/common";
import type { ChecklistItem } from "@/hooks/reactquery/movingSettlement";

export function ChecklistSection({
  items,
  checked,
  onChange,
}: {
  items: ChecklistItem[];
  checked: Record<number, boolean>;
  onChange: (id: number, checked: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-extrabold text-t1">시설점검 체크리스트</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-t3">등록된 점검 항목이 없습니다.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              checked={checked[item.id] ?? false}
              onChange={(event) => onChange(item.id, event.target.checked)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
