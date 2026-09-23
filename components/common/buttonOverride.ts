/**
 * 공통 버튼(웹 `Button`, 현장 `PartnerButton`, 세입자 `ResidentButton`)이 함께 쓰는 양보 규칙.
 * 겉모양(size·variant)은 엔트리포인트마다 정본이 달라 각자 정의하지만, 호출부 className과
 * 기본값이 부딪칠 때의 처리는 한 곳에서 관리한다.
 *
 * 호출부가 같은 유틸리티를 직접 지정했으면 컴포넌트 기본값을 뺀다. 둘 다 남기면 Tailwind
 * 명시도가 같아 승자가 CSS 생성 순서로 정해져 결과가 불확정해지기 때문이다.
 *
 * 색·크기 전반을 병합하지는 않는다(그건 `tailwind-merge`의 일이고, 규격을 제한하려는
 * 공통 버튼의 방침과 어긋난다). 호출부가 실제로 덮어써야 했던 것만 대상으로 한다.
 *
 * 비활성 표시는 속성별이 아니라 통째로 양보한다. 호출부가 직접 정의했다면 그쪽이 의도한
 * 전체 표현이지, 컴포넌트 기본값과 섞으라는 뜻이 아니기 때문이다. 다만 `disabled:cursor-*`는
 * 시각 표현이 아니므로 양보를 유발하지 않는다 — 커서만 지정했다고 회색 처리를 잃으면 안 된다.
 *
 * 그림자도 양보한다. 정본은 `.hf-btn.pri`에 인라인 `box-shadow:none`을 주는 곳이 있다
 * (공과금 "전체 이월", 수납 "자동수납"). 호출부가 접두사 없는 `shadow-*`(예: `shadow-none`)를
 * 주면 기본 그림자를 뺀다. `disabled:shadow-none` 같은 상태 접두사는 기본 상태를 건드리지
 * 않으므로 양보를 유발하지 않는다.
 */
export function dropOverridden(defaults: string, className: string): string {
  if (!className) return defaults;
  const yieldDisabled = /\bdisabled:(bg|text|opacity|border)-/.test(className);
  const yieldHover = className.includes("hover:bg-");
  const yieldShadow = /(^|\s)shadow-/.test(className);
  return defaults
    .split(" ")
    .filter((c) => !(yieldDisabled && c.startsWith("disabled:")))
    .filter((c) => !(yieldHover && c.startsWith("hover:bg-")))
    .filter((c) => !(yieldShadow && c.startsWith("shadow-")))
    .join(" ");
}
