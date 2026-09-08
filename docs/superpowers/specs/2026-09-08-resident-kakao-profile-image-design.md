# 세입자앱 카카오 프로필 사진 연동 (`/resident/me`)

> 2026-09-08 설계. 세입자 프로필 아바타에 카카오 프로필 사진을 표시한다. 선택 동의 항목이라, 사진이 있으면 표시하고 없으면 기존 글자 아바타로 폴백한다.

## 목표 / 동작
- `/resident/me` 헤더의 아바타(현재: 이름 첫 글자 + 청록 배경)를, **카카오 프로필 사진이 있으면 사진**으로, **없으면 지금처럼 글자 아바타**로 표시한다.
- 카카오 프로필 사진은 **선택 동의 항목**(사용자가 콘솔에서 scope 추가 완료). 동의하지 않으면 URL이 내려오지 않으므로 자연히 글자 아바타가 된다.

## 사용자 결정
- **저장 방식 = 카카오 URL 직접 저장** (Supabase Storage 복사 아님). 로그인 때마다 갱신, 탈퇴 시 identity 삭제로 자동 정리.
- **기본 이미지 처리 = 카카오가 주는 이미지를 그대로 표시**. 동의만 했으면 커스텀이든 카카오 회색 기본이든 그대로 보여준다. `is_default_image` 특별 분기 없음. **URL이 아예 없을 때만**(동의 안 함) 글자 아바타. → 로직 단순.
- **스코프 = `/resident/me` 하나뿐** (아바타가 있는 유일한 화면; 홈/기타는 텍스트라 무변경).

## 데이터 모델 — 마이그 `0145_resident_profile_image.sql`
- `resident_identities`에 `profile_image_url text` 컬럼 추가(nullable).
- 같은 마이그에서 `resident_get_profile()` drop+recreate: 0141 구조 유지 + 반환 테이블에 `profile_image_url text` 1필드 추가, `ri.profile_image_url` select. (grants/security definer 등 0141과 동일.)
- 다음 마이그 = 0146.

## 캡처 (로그인 시 저장)
- `app/api/resident/kakao/callback/route.ts`: `kakao_account.profile.thumbnail_image_url`(110px, 52px 아바타에 적합) 추출 → 있으면 그 URL, 없으면(동의 안 함) `null`. `mintResidentSession(...)`에 `profileImage`로 전달.
- `lib/resident/session.ts` `mintResidentSession`: `profileImage?: string | null` 파라미터 추가. `resident_identities` upsert에 포함하되 **name/phone과 동일한 `undefined` 시맨틱**(undefined면 upsert 객체에서 생략 → 기존값 유지; url/null이면 명시 갱신). → 스텁 재로그인 시 이미지 안 지워짐.
- `app/api/resident/kakao/stub/route.ts`: 테스트용 `profileImage?: string` optional 필드 추가(UI 검증용). 값 검증은 문자열 정도만.

## 프런트
- `hooks/reactquery/residentProfile/apis.ts`: `ResidentProfileRow`에 `profile_image_url: string | null`, `ResidentProfile`에 `profileImageUrl: string | null` + `rowToProfile` 매핑.
- `app/(resident)/resident/me/page.tsx`: `.av` 렌더 분기 — `profile.profileImageUrl`가 있으면 `<img className={styles.av} src={url} alt="" referrerPolicy="no-referrer" />`, 없으면 현재 글자 아바타(`<div className={styles.av}>{avatarChar}</div>`, 불변).
- `me.module.css`: `.av`가 `<img>`일 때 `object-fit: cover`로 52px 정사각·라운드(16px) 유지(글자 케이스와 동일 크기).

## 회원탈퇴
- 추가 작업 없음. `resident_withdraw`(0063)가 `resident_identities` 행 삭제 시 URL도 함께 사라짐(파일 저장 아님).

## 검증
- **UI 렌더링**: 스텁 `profileImage`에 test 이미지 URL → `<img>` 표시 / 미전달·null → 글자 아바타 (:3001, 201호 세입자).
- **실제 카카오 사진**: 실 OAuth 필요. 로컬 `.env.local`에 카카오 키가 있어 본인 카카오로 로그인하면 확인 가능(Redirect URI 등록 시). 프로덕션은 OAuth 오픈 시 자동 반영.
- tsc 0 · eslint 0 · 기존 vitest 그린 · next build(선택). 신규 단위테스트는 프로젝트 정책상 작성하지 않음.

## 제약 / 메모
- 실 카카오 OAuth가 프로덕션 미오픈 상태 → **실제 사진은 OAuth 활성화 후 자동 흐름**. 이번 작업 = 플러밍 + 스텁 테스트.
- Kakao CDN(https) 이미지를 `<img>`로 직접 표시 → `next/image` 도메인 설정 불필요.
- `referrerPolicy="no-referrer"`로 핫링크 이슈 예방.
