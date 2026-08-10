import type { Metadata } from "next";

export const metadata: Metadata = { title: "대시보드 · 관리비서" };

// PRD dashboard.md — 로그인 후 첫 진입. 오늘 처리할 업무 요약 + 각 기능 진입점.
// (입주예정일 팝업·실데이터 요약은 후속. 현재는 placeholder.)
export default function DashboardPage() {
  const cards = [
    { label: "오늘 입주예정", hint: "입주예정일이 오늘인 세대" },
    { label: "미처리 AS", hint: "접수·처리 대기 민원" },
    { label: "미납 세대", hint: "납기 초과 세대" },
  ];
  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-t1">대시보드</h1>
      <p className="mt-1.5 text-sm text-t3">오늘 처리할 업무 요약이 여기에 표시됩니다.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-surface p-5 shadow-card">
            <div className="text-sm font-semibold text-t3">{c.label}</div>
            <div className="mt-2 text-3xl font-extrabold text-t1 num">—</div>
            <div className="mt-1 text-xs text-t4">{c.hint}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-t4">※ 요약 지표·입주예정 알림은 데이터 연동 후 활성화됩니다.</p>
    </div>
  );
}
