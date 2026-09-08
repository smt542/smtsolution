# 워크포스 겸직 Capabilities 모델 (Staff Capabilities)

- 날짜: 2026-09-08
- 상태: **DRAFT — 시작만 됨. 다음 세션에서 브레인스토밍으로 미해결 질문 확정 → 플랜 → 구현.**
- 선행: 크로스-persona 인가 게이트 트랙 완료([[cross-persona-authz-gate-status]], 스펙 `2026-09-08-cross-persona-authz-gate-design.md`). 게이트는 **가산(HAS persona) semantics**로 이 모델을 코드변경 없이 수용하도록 이미 설계됨.

> ⚠️ 이 문서는 **초안**이다. 5절의 스키마 선택과 6절 미해결 질문은 다음 세션에서 사용자와 확정한다. 확정 전 구현 금지.

## 1. 문제

"사무실 직원이 현장도 뛰는" **겸직**을 현재 스키마로 표현할 수 없다. `org_members` PK가 `(org_id, user_id)`(`0000_p0_auth_foundation.sql:44`)라 **한 사람은 같은 org에서 staff_type을 하나만** 가진다(`manager_staff` XOR `field_staff` XOR `support_staff`). 그래서 한 계정이 사무실 웹앱(/staff)과 현장 모바일앱(/partner)을 **동시에 쓸 수 없다**.

## 2. 확정된 결정 (2026-09-08)

**정식 capabilities 모델** 채택: 계정별로 **여러 자격(사무실+현장)을 선택적·양방향**으로 부여. (대안이던 "사무실⊇현장 전원 정책"·"겸직 보류"는 기각.)

## 3. 현재 상태 (변경 대상 파악)

- **스키마**: `org_members(org_id, user_id, role org_member_role, staff_type staff_type, feature_permissions jsonb, affiliation text)`. `staff_type` enum = `manager_staff|field_staff|support_staff|tenant`(`0002`). `feature_permissions`는 이미 **jsonb 배열**로 다중값 권한을 저장(패턴 참고점).
- **persona 술어**(게이트가 사용, 이번 트랙에서 신설): `current_user_is_manager_staff()`·`current_user_is_field_partner()`(`0147`)가 **`staff_type` 단일값**을 검사. `current_user_is_platform_admin()`은 `role` 검사.
- **로그인 라우팅**: `app/api/staff/login`은 `staff_type='manager_staff'` 멤버십만, `app/api/partner/login`은 `staff_type IN ('field_staff','support_staff')`만 세션 발급. (⚠️다음 세션에서 정확한 필터 로직 재확인.)
- **프로비저닝**: `/staff/accounts`가 `provision_member` RPC로 멤버 생성(staff_type 단일 지정). (⚠️RPC 시그니처·UI 배선 재확인 필요.)
- **게이트 seam**: 페이지/API 게이트는 위 술어 함수만 호출 → **술어 바디만 바꾸면 상위 코드 무변경**으로 capabilities 연동.

## 4. 설계 원칙

- persona 판정의 **유일 seam = 술어 함수**. capabilities 도입은 술어 바디를 "단일 staff_type" → "capabilities 보유 검사"로 바꾸는 것이 핵심.
- 로그인·프로비저닝·표시(display)까지 파급되므로, 마이그레이션은 **무중단·하위호환**(기존 staff_type 데이터 보존 + 백필)으로.

## 5. 스키마 선택 (⚠️OPEN — 다음 세션 확정)

세 후보. **권장 = Option B**(기존 `feature_permissions jsonb` 패턴과 일관·최소 변경).

- **Option A — 정규화 조인 테이블** `org_member_capabilities(org_id, user_id, capability staff_type)`, PK 3열.
  - 장점: 정규화·쿼리 명확. 단점: 새 테이블·조인·RLS 정책 추가.
- **Option B — jsonb 배열 컬럼**(권장) `org_members.staff_capabilities jsonb`(값=staff_type enum 문자열 배열), 기존 `feature_permissions jsonb`와 동일 스타일.
  - 술어: `... where m.staff_capabilities ? 'manager_staff'`(jsonb contains). 장점: 스키마 최소·코드베이스 일관·마이그 간단. 단점: 비정규화(FK 검증 약).
- **Option C — boolean 플래그** `is_manager_staff/is_field_staff/is_support_staff`.
  - 장점: 명시적. 단점: 자격 추가 시 컬럼 증가·경직.

## 6. 미해결 질문 (⚠️다음 세션 확정)

1. **스키마**: A/B/C 중 택1(권장 B).
2. **백필**: 기존 `staff_type` → capabilities 초기값(예: `staff_capabilities = [staff_type]`). `tenant` staff_type는 제외?(워크포스만 대상)
3. **staff_type 컬럼 처리**: (a) 유지+표시/기본값용으로 잔존, capabilities가 authoritative / (b) 단계적 폐기. 전환 중 이중 소스 정합.
4. **로그인 라우팅**: staff 로그인=`manager_staff` capability 보유자 통과, partner 로그인=`field/support` capability 보유자 통과. 겸직자는 양쪽 로그인 가능. 로그인 후 "어느 앱" 선택 UX 필요?
5. **술어 갱신**: `current_user_is_manager_staff`·`current_user_is_field_partner`를 capabilities 소스로. 신규 마이그(다음 번호, 커밋직전 origin/master+로컬 max 재확인, 현재 0147 적용됨·다음 0148+).
6. **프로비저닝 UI**(`/staff/accounts`): 단일 라디오 → 다중 선택(체크박스) 자격 부여. `provision_member` RPC 확장.
7. **feature_permissions와의 관계**: 자격(capability)과 기능권한(permission)은 별개 축인가?(자격=어느 앱 접근, 권한=앱 내 기능) — 유지 권장.
8. **partner 담당건물 등 현장 데이터**: 겸직자가 현장 자격 획득 시 담당건물 배정 흐름 영향?

## 7. 비목표

- persona 게이트 재작업(이미 완료·seam 준비됨).
- role(`org_member_role`) 모델 변경(capability는 staff_type 축에 국한; role/platform_admin은 별개).
- 세입자(resident) 신원 모델(res_claims)과 무관.

## 8. 다음 세션 시작점

1. `superpowers:brainstorming`으로 6절 미해결 질문 확정(특히 스키마 A/B/C, staff_type 폐기 여부, 로그인 UX).
2. 현재 구현 재확인(recon): `app/api/staff/login`·`app/api/partner/login` 필터, `provision_member` RPC, `/staff/accounts` UI 배선.
3. 확정 후 이 스펙 완성 → `superpowers:writing-plans`로 구현 플랜(마이그 → 술어 갱신 → 로그인 → 프로비저닝 UI → 검증).
4. 브랜치 `feat/staff-capabilities`에서 이어간다.
