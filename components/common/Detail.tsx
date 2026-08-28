import type { ReactNode } from "react";

/**
 * 상세/이력 화면의 라벨-값 한 쌍. `<dl>` 안에서 사용한다.
 * 값이 비면(falsy) "—"로 대체한다.
 */
export function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-t3">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-t1">{value || "—"}</dd>
    </div>
  );
}

/**
 * 제목이 달린 inset 박스. 내부에 `DetailField`들을 2열 `<dl>` 그리드로 배치한다.
 */
export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-bg/60 p-4">
      <h3 className="mb-3 text-sm font-extrabold text-t1">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}
