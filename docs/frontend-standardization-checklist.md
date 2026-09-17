# 프론트엔드 표준화 및 이미지 기능 체크리스트

- 작성일: 2026-09-15
- 상태: 결정 완료 · Tiptap 선설치 완료 · 1차 구현 완료
- 범위: React Hook Form, Zod, 공통 훅, toast/loading, Supabase 이미지, Tiptap
- 범위 제외: `docs/prototype/**`는 참조 전용 자료이므로 구현, 감사, 일괄 전환, lint 대상에서 제외한다.

## 1. 확정 결정

- [x] 1차 작업은 `hooks/common` 구축과 이미지 기능 완성까지 진행한다.
- [x] 누락 방지를 위해 이 문서를 단일 체크리스트로 사용한다.
- [x] Supabase는 개발 중 Free 플랜을 사용하고, 서비스 오픈 시 유료 플랜으로 전환할 예정이다.
- [x] 이미지 정책은 아래 권장 기본값을 사용한다.
- [x] 기존 폼, toast, loading은 일부가 아닌 전체를 일괄 표준화한다.
- [x] Tiptap 핵심 패키지는 미리 설치하되, 실제 편집기 적용과 데이터 전환은 별도 단계로 진행한다.

## 2. 표준 구조와 원칙

### 2.1 디렉터리 책임

```text
components/common/          표현 중심 공통 UI
components/forms/schema/    클라이언트 폼 Zod 스키마
hooks/common/               도메인과 무관한 재사용 클라이언트 훅
hooks/reactquery/{domain}/   서버 상태, API, query/mutation, query key
lib/                        React에 종속되지 않는 순수 로직과 외부 서비스 경계
```

- [ ] 업무 데이터를 저장하는 폼은 React Hook Form과 `zodResolver`를 기본으로 사용한다.
- [ ] 폼 입력 타입은 필요할 때 `z.input`, 검증 후 제출 타입은 `z.output`으로 구분한다.
- [ ] Zod 스키마와 UI에 검증 규칙을 중복 작성하지 않는다.
- [ ] React Query 요청 상태는 `isPending`, `isLoading`, `isFetching`을 용도에 맞게 사용한다.
- [ ] React Query 밖의 Promise 작업에만 공통 비동기 액션 훅을 사용한다.
- [ ] 필드 검증 오류는 필드 주변에, 작업 성공/실패는 공통 toast로 표시한다.
- [ ] 공통 컴포넌트와 훅에는 단위 테스트를 추가한다.
- [ ] 새 코드가 표준을 우회하지 못하도록 ESLint 제한 규칙을 추가한다.

## 3. 1차 작업 범위

### 3.1 `hooks/common` 구축

- [x] `hooks/common/useDebouncedValue.ts`를 만든다.
- [x] `hooks/common/useDebouncedValue.test.tsx`를 만든다.
- [x] `hooks/common/useAsyncAction.ts`를 만든다.
- [x] `hooks/common/useAsyncAction.test.tsx`를 만든다.
- [x] `hooks/common/useObjectUrls.ts`를 만든다.
- [x] `hooks/common/useObjectUrls.test.tsx`를 만든다.
- [x] `hooks/common/useAppToast.ts`를 만든다.
- [x] `hooks/common/useAppToast.test.tsx`를 만든다.
- [x] `hooks/common/index.ts`에서 공용 훅만 export한다.

#### debounce 중복 제거 대상

- [x] `app/(platform-admin)/platform-admin/(app)/accounts/AccountsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/OrganizationsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/organizations/OrganizationsPointsWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/AccountsWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/MessagingComposer.tsx`
- [x] `components/messenger/MessengerFab.tsx`
- [x] `function useDebouncedValue` 로컬 정의가 더 이상 검색되지 않는지 확인한다.

### 3.2 이미지 기본 정책

- [x] Storage bucket은 private으로 유지한다.
- [x] DB에는 공개 URL이 아니라 Storage object path를 저장한다.
- [x] 이미지 최대 개수는 한 항목당 10장으로 한다.
- [x] 파일 최대 크기는 장당 10MB로 한다.
- [x] 허용 형식은 JPEG, PNG, WebP로 통일한다.
- [x] 원본은 보관하고 썸네일과 상세 보기만 변환 이미지를 사용한다.
- [x] 저장 전 이미지는 로컬 목록에서 제거한다.
- [x] 저장된 이미지는 확인창을 거쳐 Storage와 DB에서 삭제한다.
- [x] 첫 적용 화면은 신규 건물 계약서 사진으로 하고, 이후 모든 이미지 첨부 화면에 공통 적용한다.

### 3.3 이미지 업로드 공통화

- [x] `PhotoUpload`이 `{ url, name }`이 아니라 실제 `File` 목록을 부모에 전달하도록 변경한다.
- [x] `PhotoUpload`을 controlled API로 변경한다: `files`, `onFilesChange`, `max`, `accept`, `disabled`.
- [x] 파일 개수, MIME, 크기를 선택 즉시 검증한다.
- [x] 선택한 파일의 object URL 생성과 해제를 `useObjectUrls`로 관리한다.
- [x] 동일 파일 재선택이 가능하도록 input value를 초기화한다.
- [x] 업로드 중 중복 제출과 모달 닫기를 안전하게 처리한다.
- [x] 일부 파일 업로드 실패 시 성공/실패 파일을 구분하고 재시도할 수 있게 한다.
- [x] 신규 건물 저장 성공 후 실제 entity ID를 기준으로 사진을 업로드한다.
- [x] 본문 저장 성공 후 이미지 업로드가 실패했을 때 사용자에게 부분 성공 상태를 알린다.

### 3.4 첨부 데이터 계층 통합

- [x] `hooks/reactquery/attachments`를 첨부의 단일 데이터 경계로 사용한다.
- [x] `hooks/reactquery/vendors/apis.ts`의 별도 첨부 업로드/삭제/signed URL 구현을 제거하고 공통 API를 사용한다.
- [x] 파일명과 Storage path 정규화 규칙을 한곳에 둔다.
- [x] 클라이언트 검증과 bucket의 MIME/크기 제한을 일치시킨다.
- [x] Storage 업로드 성공 후 DB 저장 실패 시 업로드한 object를 보상 삭제한다.
- [x] 삭제 순서 중 일부가 실패해도 고아 DB row 또는 고아 object를 확인·복구할 수 있게 한다.
- [x] `attachments`에 `mime_type`, `size_bytes` 저장 여부를 마이그레이션에서 반영한다. ⚠️ 마이그레이션 파일(`0157`)은 존재했으나 **라이브 DB에는 2026-09-16에야 적용**됨(그전까지 라이브 첨부 INSERT 전건 400, §7.4 버그 참조).
- [x] 이미지와 PDF 등 비이미지 첨부가 같은 API를 사용할 수 있도록 타입을 구분한다.

### 3.5 Supabase on-the-fly 이미지 변환

- [x] Free 개발 환경에서는 변환 기능을 사용하지 않고 원본 signed URL로 fallback한다.
- [x] 유료 전환 후 Image Transformations를 활성화한다.
- [x] 이미지 변환 사용 여부를 환경별 설정으로 제어한다.
- [x] URL 생성 함수에 `original`, `thumbnail`, `preview` preset을 정의한다.
- [x] `thumbnail`은 목록 표시용 작은 크기와 낮은 품질을 사용한다.
- [x] `preview`는 화면 상세 보기용 중간 해상도를 사용한다.
- [x] 인쇄와 다운로드는 `original`을 사용한다.
- [x] 이미지 MIME에만 transform 옵션을 전달한다.
- [x] private bucket의 `createSignedUrl(..., { transform })` 경로를 사용한다.
- [x] signed URL은 React Query로 조회하고 URL 만료보다 짧은 stale/gc 정책을 둔다.
- [x] 첨부 하나의 URL 생성 실패가 전체 목록을 실패시키지 않도록 항목별 오류를 처리한다.
- [x] Free 환경과 유료 변환 환경을 각각 테스트한다.

#### 이미지 적용 화면

- [x] `app/(staff)/staff/(app)/buildings/new-v2/_components/ui/PhotoUpload.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/sections/VendorSection.tsx`
- [x] `components/vendors/VendorFormModal.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/components/AttachmentViewer.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgFormModal.tsx`

## 4. 기존 폼 전체 일괄 전환

완료 조건은 아래 17개 파일을 전수 확인하고, 모든 업무 입력 폼이 React Hook Form + Zod를 사용하거나 예외 사유가 이 문서에 기록되는 것이다. 이미 React Hook Form을 사용하는 폼도 표준 준수 여부를 다시 확인한다.

- [x] `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountCreateModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountEditModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgFormModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/MessagePointRateModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/PointAdjustmentModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/PointChargeModal.tsx`
- [x] `app/(platform-admin)/platform-admin/login/LoginForm.tsx`
- [x] `app/(resident)/_components/MoveOutSection.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/BuildingSearchCard.tsx` — 전환 예외. 서버에 업무 데이터를 제출하는 폼이 아니라 부모가 소유한 검색어·목록 필터를 전달하는 조회 전용 컨트롤이다. controlled 상태와 submit 이벤트를 유지하고 검색·필터 동작 테스트를 추가했다.
- [x] `app/(staff)/staff/(app)/fee-items/components/FeeItemFormDialog.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/FeeItemFormModal.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticeFormModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/AsComplaintForm.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentAmountModal.tsx`
- [x] `app/(staff)/staff/login/components/LoginForm.tsx`
- [x] `components/vendors/VendorFormModal.tsx`

전환 예외와 수명주기 적용 범위:

- `BuildingSearchCard`만 React Hook Form + Zod 전환이 불필요한 항목이다. 검색 조건은 저장 데이터가 아니며, 유효성 검증이나 서버 mutation을 수행하지 않는다.
- 두 로그인 폼은 성공 시 모달을 닫거나 입력값을 재사용하는 흐름이 아니라 라우팅으로 화면을 이탈하므로 성공 후 `reset`/닫기 규칙을 적용하지 않는다.
- `FeeItemFormDialog`는 최종 저장 전의 로컬 관리항목 초안을 편집한다. 이 다이얼로그는 검증·reset·닫기 순서를 적용하고, query invalidation은 상위 일괄 저장 단계가 담당한다.
- `AccountFormModal`의 입주자 수정 분기는 이 화면에서 수정 권한이 없는 기존 읽기 전용 안내이므로 입력 폼 전환 대상에서 제외했다.

### 4.1 폼 공통 완료 조건

- [x] 모든 필수값, 길이, 형식, 교차 필드 검증을 Zod로 옮긴다.
- [x] 생성/수정 모드의 `defaultValues`와 `reset` 동작을 검증한다.
- [x] 숫자, 날짜, 빈 문자열, nullable 값의 변환 규칙을 통일한다.
- [x] 모든 오류 입력에 `aria-invalid`를 제공한다.
- [x] 오류 메시지를 `aria-describedby`로 입력과 연결한다.
- [x] 첫 오류 필드로 포커스가 이동하는지 확인한다.
- [x] 제출 중 버튼을 비활성화하고 중복 요청과 모달 닫기를 방지한다.
- [x] 서버 오류가 필드 오류인지 전역 오류인지 구분한다.
- [x] 성공 순서를 `mutation 및 query invalidation 완료 → reset → 닫기`로 통일한다.
- [x] 각 저장 폼의 성공, 검증 실패, 서버 실패 테스트를 추가한다. 조회 전용 예외인 `BuildingSearchCard`는 검색 submit과 필터 변경 테스트로 대체했다.

구현 기준:

- 스키마는 `components/forms/schema`의 도메인별 파일과 `common.ts` 변환 헬퍼로 통합했다.
- RHF 입력 상태는 `z.input`, resolver 통과 후 제출값은 `z.output`으로 구분했다.
- 선택 문자열은 API 계약에 따라 `undefined` 또는 `null`, nullable 날짜·일시는 빈 문자열을 `null`, 필수 숫자는 빈 문자열을 `0`이 아닌 검증 오류로 처리한다.
- `setSubmissionError`는 구조화된 `fieldErrors`를 필드 오류로 연결하고 첫 서버 필드 오류에 포커스하며, 일반 서버 오류는 `root.server`에 둔다.

## 5. toast 전체 일괄 전환

- [x] `useAppToast`에서 성공, 안내, 경고, 오류 API를 정의한다.
- [x] `unknown` 오류를 사용자 메시지로 정규화한다.
- [x] Supabase/네트워크 오류 원문을 그대로 사용자에게 노출하지 않는다.
- [x] 작업별 toast 중복 호출을 제거한다.
- [x] 로딩 toast를 사용하는 경우 성공/실패 시 동일 ID로 종료한다.
- [x] 테스트에서 Sonner 자체 대신 공통 toast 경계를 mock한다.
- [x] `app/layout.tsx`의 `Toaster` 렌더링은 유지한다.
- [x] `useAppToast` 구현과 `app/layout.tsx`를 제외한 운영 코드에서 `sonner` 직접 import를 제거한다.
- [x] ESLint `no-restricted-imports`로 신규 직접 import를 차단한다.
- [x] 전환 전 검색된 67개 운영 파일을 모두 처리했는지 최종 검색한다.

### 5장 처리 결과 (2026-09-15)

- 전환 전 기준 67개는 `sonner` 직접 사용 63개와 이미 공통 경계를 사용하던 4개로 구성됐다. 63개는 모두 `useAppToast` 모듈 경계로 전환했고 기존 4개도 오류 처리와 호출 중복을 재검토했다.
- 알 수 없는 값은 `AppError`로 명시된 사용자 메시지 또는 호출부의 안전한 fallback만 노출한다. `Error.message`, `String(error)`, Supabase/네트워크 오류 객체를 직접 표시하던 경로는 모두 제거했다.
- 메시지 발송 성공을 `MessagingComposer`와 상위 화면이 함께 알리던 4개 상위 toast를 제거했다.
- 운영 코드에는 loading toast 사용처가 없다. 공통 API는 loading ID를 성공·실패 API의 `{ id }`로 전달해 같은 toast를 종료하도록 정의하고 단위 테스트로 검증했다.
- 관련 운영 테스트 42개는 `@/hooks/common/useAppToast`를 mock한다. 공통 경계 자체의 어댑터 단위 테스트만 Sonner를 mock한다.
- 최종 검색 결과 공통 경계 사용 운영 파일은 67개이며, `sonner` 운영 import는 허용된 `hooks/common/useAppToast.ts`와 `app/layout.tsx` 두 곳뿐이다. `app/layout.tsx`의 `Toaster` 렌더링은 변경하지 않았다.

<details>
<summary>확인 완료한 운영 파일 67개</summary>

- [x] `app/(platform-admin)/_components/PlatformShell.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/AccountsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/billing/BillingWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/OrganizationsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/organizations/OrganizationsPointsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/PointsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/settings/PlatformSettingsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/login/LoginForm.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/AccountsWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/ResidentClaimsPanel.tsx`
- [x] `app/(staff)/staff/(app)/bill/components/DocumentOutputModal.tsx`
- [x] `app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx`
- [x] `app/(staff)/staff/(app)/buildings/[id]/components/tenant-sections/MoveOutControl.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/BuildingForm.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/TenantOccupancyCard.tsx`
- [x] `app/(staff)/staff/(app)/buildings/new-v2/_components/BuildingRegisterForm.tsx`
- [x] `app/(staff)/staff/(app)/fee-items/components/FeeItemManagement.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/components/AttachmentViewer.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/components/LongTermRepairLedger.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/BillingPeriodSettingsBar.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/BillingReferencePanel.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/ItemManageModal.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/ManagementFeeWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/DrainScheduledButton.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/MessagingComposer.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/TemplateFormModal.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/TemplatesTab.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/AllSettlementInquiryPage.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/MovingSettlementWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementActions.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementInquiryPage.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticeDetail.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticeFormModal.tsx`
- [x] `app/(staff)/staff/(app)/overdue/components/LateFeeRateModal.tsx`
- [x] `app/(staff)/staff/(app)/overdue/components/OverdueWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/AsStatusSection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/BuildingUnitRail.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/BankImportModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/GiroUploadModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/PaymentHistorySection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/TenantInfoSection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/VillaPaymentModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/ReceiptWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/AccountSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/AsSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/BillingSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/CompanyInfoTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/DataMigrationTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/MovingSettlementSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/NotificationSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/QuickMessageEditor.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/SystemSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/BillingPeriodBar.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/FixedUsageModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/GasSupplierModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/UnitPriceModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceBar.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/WaterDiscountModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/ElectricityUtilitiesWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/utilities/GasUtilitiesWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/utilities/WaterUtilitiesScreen.tsx`
- [x] `app/(staff)/staff/login/components/LoginForm.tsx`
- [x] `components/common/PhotoUpload.tsx`
- [x] `components/messenger/MessengerFab.tsx`
- [x] `components/shell/as-rail/MoveOutList.tsx`
- [x] `components/shell/Sidebar.tsx`
- [x] `components/vendors/VendorManagementSection.tsx`

</details>

### 5장 검증 결과

- `npx tsc --noEmit`: 통과
- 표적 테스트(변경된 43개 테스트 파일): 216개 중 213개 통과, 기존 `app/(staff)/staff/(app)/notices/page.test.tsx` 3개 실패, 신규 실패 0개
- `npm run lint`: 통과
- `npm test`: 336개 파일 중 326개 통과, 8개 실패, 2개 건너뜀; 1,290개 테스트 중 1,267개 통과, 기존 14개 실패, 9개 건너뜀; 신규 실패 0개
  - 기존 실패 파일: `components/shell/navItems.test.ts`(1), `app/api/resident/kakao/stub/route.test.ts`(1), `app/api/resident/kakao/login/route.test.ts`(1), `app/(staff)/staff/(app)/messaging/components/HistoryTab.test.tsx`(2), `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceHeader.test.tsx`(1), `app/(staff)/staff/(app)/messaging/page.test.tsx`(3), `app/(staff)/staff/(app)/receipts/components/payment/GiroLedgerModal.test.tsx`(2), `app/(staff)/staff/(app)/notices/page.test.tsx`(3)
- `npm run build`: 통과 (Next.js 16.3.0, 정적 페이지 72개 생성)
- 최종 검색: 운영 공통 경계 67개, 허용 외 `sonner` 직접 import 0개, 공통 경계 mock 테스트 42개

## 6. loading 전체 일괄 전환

### 6.1 상태 모델

- [x] 최초 데이터 로딩은 `isPending`/`isLoading`으로 표시한다.
- [x] 기존 데이터가 있는 백그라운드 갱신은 `isFetching`으로 구분한다.
- [x] mutation 제출 상태는 해당 mutation의 `isPending`을 사용한다.
- [x] React Query 밖의 Promise 작업만 `useAsyncAction`을 사용한다.
- [x] 여러 요청의 결합 loading은 의미가 드러나는 파생 변수로 정의한다.
- [x] 전역 boolean `useLoading`은 만들지 않는다.

### 6.2 공통 UI와 접근성

- [x] 공통 `LoadingState` 또는 기존 `Spinner` 확장안을 확정한다.
- [x] 로딩 UI에 `role="status"`와 읽을 수 있는 `aria-label`을 제공한다.
- [x] 빈 상태, 오류 상태, 최초 로딩 상태를 서로 구분한다.
- [x] 버튼 pending 문구를 `저장 중…`, `삭제 중…`, `발송 중…`처럼 동작별로 표시한다.
- [x] 로딩 중 레이아웃 이동을 줄이도록 화면 단위 skeleton 또는 최소 높이를 적용한다.
- [x] `loading.tsx`는 서버 라우트 전환용으로 유지하고 클라이언트 query loading과 역할을 구분한다.
- [x] 모든 `isLoading`/`isPending`/`isFetching` 사용처를 전수 검색해 기준 준수 여부를 확인한다.

### 6.3 기존 route loading 경계 확인

- [x] `app/(partner)/partner/(app)/mobile-as-new/loading.tsx`
- [x] `app/(partner)/partner/(app)/mobile-building/loading.tsx`
- [x] `app/(partner)/partner/(app)/mobile-ms-new/loading.tsx`
- [x] `app/(partner)/partner/(app)/mobile-tenant/loading.tsx`
- [x] `app/(resident)/resident/(app)/bill/loading.tsx`
- [x] `app/(resident)/resident/(app)/notice/loading.tsx`
- [x] `app/(staff)/staff/(app)/bill/loading.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/loading.tsx`
- [x] `app/(staff)/staff/(app)/messaging/loading.tsx`
- [x] `app/(staff)/staff/(app)/notices/loading.tsx`
- [x] `app/(staff)/staff/(app)/overdue/loading.tsx`

### 6장 처리 결과 (2026-09-15)

- Next.js 16.3.0의 `loading.js` 및 Linking and Navigating 가이드를 확인했다. `loading.tsx`는 서버 라우트 전환의 Suspense/streaming 경계로 유지하고, React Query 최초 조회·백그라운드 갱신 상태는 각 클라이언트 화면에서 처리한다.
- 새 `LoadingState`를 추가하지 않고 기존 `Spinner` 확장안을 채택했다. 공통 컴포넌트가 `role="status"`, 필수 접근성 이름, 크기, 표시 문구를 담당하며, 콘텐츠형 화면은 `AsyncContentState`를 확장해 최초 로딩·오류·기존 콘텐츠를 유지하는 갱신 상태를 구분한다.
- 테스트를 제외한 운영 코드 136개 파일을 전수 확인했다. 최종 검색은 `isLoading` 197건/68개 파일, `isPending` 341건/99개 파일, `isFetching` 68건/48개 파일이다. 최초 조회는 `isPending`/`isLoading`, 기존 데이터 갱신은 `isFetching && !isLoading`, mutation 제출은 각 mutation의 `isPending`으로 정리했다.
- 복수 요청은 화면 의미를 담은 파생 변수(예: `isReceiptWorkspaceRefreshing`, `isPaymentHistoryLoading`, `isSettlementMutationPending`)로 결합했다. `isLoading || isFetching`으로 최초 로딩과 갱신을 합치는 운영 코드와 전역 `useLoading`은 최종 검색 결과 0건이다.
- `useAsyncAction` 호출 파일 8개는 파일 읽기·파싱, 직접 API 요청, 로그아웃, 스토리지 업로드처럼 React Query 밖의 Promise 작업만 감싼다. React Query mutation은 hook이 제공하는 `isPending`을 직접 사용한다.
- 목록·상세·미리보기에서 최초 로딩, 오류, 빈 상태를 별도 분기로 두고 화면 단위 최소 높이를 적용했다. 기존 데이터가 있는 갱신은 콘텐츠를 유지한 채 이름 있는 소형 상태 표시를 노출한다.
- mutation 버튼은 실제 실행 중인 작업에 맞춰 저장·삭제·발송·퇴실·수납·파일 분석 등의 pending 문구를 표시한다. 이미지·표·목록·라우트 로딩 표시에는 읽을 수 있는 `aria-label`을 제공한다.
- 6.3의 11개 `loading.tsx`를 모두 확인해 접근성 이름과 최소 높이를 보완했다. `app/loading-boundaries.test.tsx`에서 11개 경계가 모두 이름 있는 `status`를 렌더하는지 검증한다.

<details>
<summary>상태 사용처 확인 완료 운영 파일 136개</summary>

- [x] `app/(partner)/partner/(app)/(tabs)/mobile-profile/ProfileView.tsx`
- [x] `app/(partner)/partner/(app)/mobile-as/MobileAsWorkspace.tsx`
- [x] `app/(partner)/partner/(app)/mobile-as-new/PartnerAsNewWorkspace.tsx`
- [x] `app/(partner)/partner/(app)/mobile-meter/PartnerMeterWorkspace.tsx`
- [x] `app/(partner)/partner/(app)/mobile-ms-new/PartnerMsNewWorkspace.tsx`
- [x] `app/(partner)/partner/mobile-login/PartnerLoginForm.tsx`
- [x] `app/(platform-admin)/_components/PlatformAdminGuard.tsx`
- [x] `app/(platform-admin)/_components/PlatformShell.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/AccountsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountCreateModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountEditModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountRowActions.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/billing/BillingWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/[orgId]/buildings/[buildingId]/components/BuildingTenantsList.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/[orgId]/buildings/[buildingId]/units/[unitId]/components/UnitDetailView.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/[orgId]/components/OrgBuildingsList.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgFormModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgRowActions.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgStatusControl.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/organizations/OrganizationsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/PlatformDashboard.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/MessagePointRateModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/PointAdjustmentModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/PointChargeModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/components/ReservationReleaseModal.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/organizations/OrganizationsPointsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/points/PointsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/(app)/settings/PlatformSettingsWorkspace.tsx`
- [x] `app/(platform-admin)/platform-admin/_components/MonthlySendCostChart.tsx`
- [x] `app/(resident)/_components/MoveOutSection.tsx`
- [x] `app/(resident)/resident/(app)/home/ResidentHomeWorkspace.tsx`
- [x] `app/(resident)/resident/(app)/me/ResidentMeWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/AccountsWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/accounts/components/ResidentClaimsPanel.tsx`
- [x] `app/(staff)/staff/(app)/bill/components/DocumentOutputModal.tsx`
- [x] `app/(staff)/staff/(app)/bill/components/output-modal/FaxConfirmationModal.tsx`
- [x] `app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx`
- [x] `app/(staff)/staff/(app)/buildings/[id]/components/TenantList.tsx`
- [x] `app/(staff)/staff/(app)/buildings/[id]/components/tenant-sections/MoveOutControl.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/BuildingDirectoryCard.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/BuildingForm.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/BuildingTenantManager.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/TenantOccupancyCard.tsx`
- [x] `app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx`
- [x] `app/(staff)/staff/(app)/buildings/new-v2/_components/BuildingRegisterForm.tsx`
- [x] `app/(staff)/staff/(app)/customer-numbers/components/CustomerNumberLookupContent.tsx`
- [x] `app/(staff)/staff/(app)/fee-items/components/FeeItemFormDialog.tsx`
- [x] `app/(staff)/staff/(app)/fee-items/components/FeeItemManagement.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/components/AttachmentViewer.tsx`
- [x] `app/(staff)/staff/(app)/long-term-repair/components/LongTermRepairLedger.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/BillingHistoryModal.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/BillingPeriodSettingsBar.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/BillingReferencePanel.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/FeeItemFormModal.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/FeeItemList.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/components/ItemManageModal.tsx`
- [x] `app/(staff)/staff/(app)/management-fee/ManagementFeeWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/DrainScheduledButton.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/HistoryTab.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/MessageLogList.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/MessagePointQuoteCard.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/MessagingComposer.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/ScheduledTab.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/TemplateFormModal.tsx`
- [x] `app/(staff)/staff/(app)/messaging/components/TemplatesTab.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/AllSettlementInquiryPage.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/MovingSettlementWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementActions.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementDirectoryRail.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementHistory.tsx`
- [x] `app/(staff)/staff/(app)/moving-settlement/components/SettlementInquiryPage.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticeDetail.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticeFormModal.tsx`
- [x] `app/(staff)/staff/(app)/notices/components/NoticesWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/overdue/components/LateFeeRateModal.tsx`
- [x] `app/(staff)/staff/(app)/overdue/components/OverdueWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/AsComplaintForm.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/AsStatusSection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/BuildingUnitRail.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/ChargeReceiptReportModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/ComplaintDetailModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/ComplaintFormModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/ComplaintTable.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/monthly/MonthlyChargeModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/BankImportModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/GiroCalendarModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/GiroLedgerModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/GiroUploadModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentAmountModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentHistoryModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentReceiptModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentStatementModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/payment/PaymentTable.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/PaymentHistorySection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/TenantInfoSection.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/unit-statement/UnitStatementModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/villa-overdue/VillaOverdueModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/VillaPaymentModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/components/villa-receipts/VillaReceiptHistoryModal.tsx`
- [x] `app/(staff)/staff/(app)/receipts/ReceiptWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/AccountSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/BillingSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/CompanyInfoTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/MovingSettlementSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/NotificationSettingsTab.tsx`
- [x] `app/(staff)/staff/(app)/setup/components/QuickMessageEditor.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/BillingPeriodBar.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/BuildingSelectionRail.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/FixedUsageModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/GasLedgerModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/GasSupplierModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/MeterLedgerModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/UnitPriceModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceBar.tsx`
- [x] `app/(staff)/staff/(app)/utilities/components/WaterDiscountModal.tsx`
- [x] `app/(staff)/staff/(app)/utilities/ElectricityUtilitiesWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/utilities/GasUtilitiesWorkspace.tsx`
- [x] `app/(staff)/staff/(app)/utilities/WaterUtilitiesScreen.tsx`
- [x] `app/(staff)/staff/components/DashboardContent.tsx`
- [x] `app/(staff)/staff/login/components/LoginForm.tsx`
- [x] `components/messenger/AlimtalkForm.tsx`
- [x] `components/messenger/MessageComposer.tsx`
- [x] `components/messenger/MessengerFab.tsx`
- [x] `components/messenger/SenderSelect.tsx`
- [x] `components/shell/as-rail/AsReceptionList.tsx`
- [x] `components/shell/as-rail/AsReportModal.tsx`
- [x] `components/shell/as-rail/MoveOutList.tsx`
- [x] `components/shell/Sidebar.tsx`
- [x] `components/vendors/VendorFormModal.tsx`
- [x] `components/vendors/VendorList.tsx`
- [x] `components/vendors/VendorManagementSection.tsx`
- [x] `hooks/common/useAsyncAction.ts`
- [x] `hooks/reactquery/attachments/queries.ts`
- [x] `hooks/reactquery/occupancies/queries.ts`
- [x] `lib/resident/useResidentGuard.ts`

</details>

### 6장 검증 결과

- `npx tsc --noEmit`: 통과
- 표적 테스트: 12개 파일, 51개 테스트 모두 통과
- `npm run lint`: 경고·오류 없이 통과
- `npm test`: 339개 파일 중 330개 통과, 기존 실패 7개, 2개 건너뜀; 1,307개 테스트 중 1,287개 통과, 기존 실패 11개, 9개 건너뜀; 신규 실패 0개
  - 기준선 8개 파일·14개 실패 중 현재 메시징 탭 구조와 맞지 않던 `app/(staff)/staff/(app)/messaging/page.test.tsx`의 3개 테스트를 갱신해 통과시켰다.
  - 남은 기존 실패 파일: `components/shell/navItems.test.ts`(1), `app/api/resident/kakao/stub/route.test.ts`(1), `app/api/resident/kakao/login/route.test.ts`(1), `app/(staff)/staff/(app)/messaging/components/HistoryTab.test.tsx`(2), `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceHeader.test.tsx`(1), `app/(staff)/staff/(app)/receipts/components/payment/GiroLedgerModal.test.tsx`(2), `app/(staff)/staff/(app)/notices/page.test.tsx`(3)
- `npm run build`: 통과 (Next.js 16.3.0, 정적 페이지 72개 생성)
- 최종 검색: 운영 코드의 `useLoading` 0건, 공통 `useAsyncAction` 내부 구현을 제외한 화면 수동 boolean 로딩 상태 0건, `isLoading || isFetching` 혼용 0건, `docs/prototype/**` 변경 0건


## 7. Tiptap 선설치와 후속 도입

### 7.1 선설치

- [x] 공식 React 최소 패키지를 설치한다: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`.
- [x] 세 패키지의 major/minor 버전이 일치하는지 확인한다. (`3.31.3`)
- [x] 설치 후 lockfile을 반영한다.
- [x] 미사용 상태에서 lint, test, production build가 동일하게 통과하는지 확인한다. (6장 검증 기록 기준: Tiptap 3종 설치·미사용 상태에서 tsc/lint/build 통과, 전체 테스트 기준선 변화 없음)
- [x] 편집기 코드는 필요 화면에서만 client component로 import한다. (`NoticeEditor`만 `use client`이며 작성 화면 `NoticeFormModal`에서만 import, 읽기 경로는 편집기 코드를 로드하지 않는 `NoticeContent` 사용)
- [x] `npm audit` 기준 기존 취약점 7건을 별도 의존성 업데이트 작업으로 처리했다(2026-09-15). 비파괴 수정으로 5건(critical 1·high 2·moderate 2)을 해소하고 2건(moderate, `uuid`←`exceljs`)은 파괴적 downgrade만 유효해 보류했다. 상세·근거·검증은 아래 10.3에 기록한다. Tiptap 관련 패키지는 보고된 취약 패키지에 포함되지 않았다.

### 7.2 공지사항 파일럿

- [x] 최초 적용 대상은 공지사항으로 한다.
- [x] 문자와 알림톡 템플릿은 plain text를 유지한다.
- [x] 편집기 원본 저장 형식은 Tiptap JSON을 기본으로 한다.
- [x] 기존 plain text 공지를 Tiptap JSON으로 읽는 호환 전략을 작성한다.
- [x] DB 컬럼 추가 또는 기존 컬럼 전환 방식을 결정하고 마이그레이션한다.
- [x] 작성 화면과 읽기 전용 렌더러가 같은 extension 구성을 공유한다.
- [x] Next.js SSR 환경에서 편집기 초기화를 클라이언트로 제한한다.
- [x] 허용 toolbar 기능을 확정한다.
- [x] 링크 프로토콜과 속성 허용 정책을 정의한다.
- [x] 본문 이미지 기능은 공통 이미지 업로드 완료 후 연결한다. (2026-09-15 구현 완료 · 아래 7.3 기록)
- [x] 빈 문서, 붙여넣기, 긴 문서, 모바일, 접근성을 테스트한다. (자동: 빈 문서 검증·리치 렌더·링크 보안·경로별 동일 렌더 / **실 브라우저 E2E 완료 2026-09-16**: 빈 문서 aria-invalid, 서식 붙여넣기 시 비허용 마크 제거, 긴 문서 `max-height:420px`+스크롤, 모바일 390px `flex-wrap` 2행, 편집기 a11y 전수 — 아래 7.4)
- [x] 작성자 화면, 입주자 앱, 공유 링크에서 동일하게 렌더링되는지 확인한다. (**실 브라우저 E2E 완료 2026-09-16**: 동일 `NoticeContent`가 3경로에서 같은 본문 텍스트 + 같은 signed object를 렌더 — 아래 7.4)

### 7장 처리 결과 (2026-09-15)

- **저장 전략(결정 근거)**: 기존 `notices.content`(text, NOT NULL)는 평문 투영으로 유지하고, nullable `content_json`(jsonb)를 신규 추가했다(마이그레이션 `0158_notice_rich_text.sql`). 파괴적 변환·컬럼 전환 대신 additive 컬럼을 택한 이유는 (1) 목록 검색(`content.ilike`)·미리보기·문자/알림톡 등 기존 `content` 소비 경로를 무회귀로 보존하고, (2) 레거시 공지(`content_json = null`)를 읽기 경로에서 평문으로 안전하게 폴백하며, (3) NOT NULL 제약을 건드리지 않기 때문이다. 신규/수정 공지는 편집기 JSON을 `content_json`에, 같은 문서에서 파생한 평문을 `content`에 함께 기록한다(`noticeDocToPlainText`).
- **호환 전략**: 읽기 경로(`NoticeContent`)는 `content_json`이 있으면 리치 렌더, 없으면 `content` 평문을 줄바꿈 보존해 표시한다. 레거시 공지를 편집기에서 열 때는 `plainTextToNoticeDoc`으로 평문을 문단 문서로 비파괴 승격한다.
- **데이터 계층**: `Notice`/`NoticeInput`/`NoticeRow`·RPC(`resident_notice_detail`·`public_notice_by_token`)·입주자/공개 타입에 `content_json`을 배선했다. `resident_notice_detail`은 RETURNS TABLE 시그니처 변경이라 DROP 후 재생성, `public_notice_by_token`은 JSONB 반환이라 본문에 키만 추가했다(권한·필터 로직 원본 보존).
- **편집기(작성 화면 전용)**: `components/notices/NoticeEditor.tsx`(`use client`)만 편집기 코드를 로드하고 `NoticeFormModal`에서만 import한다. `immediatelyRender: false`로 SSR/hydration 불일치를 피한다. 최소 toolbar는 문단·제목(H2·H3)·굵게·기울임·글머리/번호 목록·인용·링크·실행취소/다시실행이며, 범위 밖(코드·코드블록·취소선·밑줄·수평선)은 스키마에서 비활성화해 저장 JSON을 좁혔다. "제목"은 공지 제목(별도 필드)과 충돌하지 않도록 H2·H3 두 단계로 구현했다.
- **링크 정책**: `lib/notice/richText.ts`가 허용 스킴(http/https/mailto/tel)·`rel="noopener noreferrer nofollow"`·`target="_blank"`의 단일 기준이다. 편집기 입력은 `isAllowedUri`로, 렌더러 출력은 `sanitizeNoticeHref`로 이중 검증해 `javascript:`·`data:` 등 위험 스킴과 상대 경로를 차단한다(익명 공유 페이지 방어).
- **읽기 전용 렌더러(공유)**: `components/notices/NoticeContent.tsx`가 `@tiptap/static-renderer/json/react`로 JSON을 정적 React 엘리먼트로 변환한다. DOM 비의존이라 관리자 상세(client)·입주자 앱·공유 링크(server component) 모두 동일 컴포넌트로 렌더하고, 저장 HTML을 `dangerouslySetInnerHTML`로 렌더하지 않는다. 편집기 편집 영역과 렌더러는 `noticeRichText.module.css`를 공유해 작성/표시 결과를 일치시킨다.
- **접근성·모바일·붙여넣기·빈 문서**: 편집 영역에 `role="textbox"`·`aria-multiline`·접근 가능한 이름과 오류 연결(`aria-invalid`/`aria-describedby`), toolbar 버튼에 `aria-label`/`aria-pressed`와 focus 스타일을 제공한다. toolbar는 `flex-wrap`, 본문은 `max-height`+스크롤로 모바일 가로 깨짐을 막는다. 붙여넣기·긴 문서는 StarterKit 기본 처리 위에서 비허용 마크가 스키마에서 제거된다. 빈 문서는 저장 전 스키마에서 검증해(파생 평문 길이 0) "내용을 입력해 주세요"를 필드 오류로 표시한다.
- **이미지(구현 완료)**: 본문 이미지 toolbar·업로드·렌더를 공통 이미지 업로드(3.3) 위에 연결했다. 상세 설계와 근거는 아래 7.3에 기록한다.
- **npm audit**: `@tiptap/static-renderer@3.31.3` 추가 후에도 취약점 수는 기존과 동일(moderate 4·high 2·critical 1). Tiptap 관련 패키지는 보고 경로에 없으며, 취약점 의존성 업데이트는 이번 작업과 분리해 별도 후속 작업으로 기록한다.
- **라이브 반영 대기**: 마이그레이션 `0158_notice_rich_text.sql`은 파일만 추가했고 라이브 DB 적용은 별도 요청 시 수행한다. 적용 전에는 운영 조회 시 `content_json` 컬럼이 없어 신규 리치 공지가 표시되지 않으므로 배포 순서에 유의한다.

### 7장 검증 결과

- `npx tsc --noEmit`: 통과
- Tiptap·공지 표적 테스트: 8개 파일 통과 — `lib/notice/richText`, `components/notices/NoticeContent`, notices `page`/`utils`/`NoticeFormModal`/`NoticeDetail`, 입주자/공개 notice `data`
- `npm run lint`: 통과
- `npm test`: 341개 파일 중 333개 통과·2개 건너뜀; 1,319개 테스트 중 1,302개 통과·9개 건너뜀. 신규 회귀 0개.
  - **기준선 감소(11 → 8)**: 기존 실패였던 `notices/page.test.tsx` 3개를 현재 UI(세그먼트 탭·행 클릭 선택·오류 상태 구조)에 맞게 갱신해 통과시켰다.
  - **작업 중 발생·해소한 회귀**: 스키마 `content → contentJson` 변경으로 `notices/utils.test.ts` 2개가 일시 실패했고, `validateNoticeForm`이 평문을 문서로 변환하도록 고쳐 통과시켰다(잔여 없음).
  - **남은 기존 실패 6개 파일·8개(이번 작업 무관)**: `components/shell/navItems.test.ts`(1), `app/api/resident/kakao/login/route.test.ts`(1), `app/api/resident/kakao/stub/route.test.ts`(1), `app/(staff)/staff/(app)/messaging/components/HistoryTab.test.tsx`(2), `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceHeader.test.tsx`(1), `app/(staff)/staff/(app)/receipts/components/payment/GiroLedgerModal.test.tsx`(2)
- `npm run build`: 통과 (Next.js 16.3.0)
- `git diff --check`: 공백/충돌 오류 없음
- 최종 검색: `docs/prototype/**` 변경 0건, 읽기 경로 `dangerouslySetInnerHTML` 0건

### 7.3 공지 본문 이미지 (2026-09-15)

7장 파일럿의 후속으로 Tiptap 스키마에 image 노드를 추가하고 편집기·읽기 렌더러가 동일 구성을 공유하도록 배선했다. 저장·해석 방식과 그 근거는 아래와 같다.

- **스키마·단일 구성**: StarterKit v3에는 image가 없어 커스텀 노드 `components/notices/tiptap/NoticeImage.ts`(node type `image`)를 추가했다. 편집기 확장은 상수 배열 대신 팩토리 `createNoticeEditorExtensions({ pendingFiles })`로 만들고(저장 전 File을 담는 공유 맵이 필요), 읽기 렌더러 `NoticeContent`는 기존과 동일하게 `@tiptap/static-renderer`의 명시적 node mapping에 `image` 항목만 추가했다. 저장 HTML을 `dangerouslySetInnerHTML`로 렌더하지 않는 현행 방식을 유지한다.
- **저장 형식(결정 근거)**: image 노드 attr에는 공개 URL이 아니라 private bucket(`attachments`) object path만 저장한다(`content_json`에 path만 남음). 공통 첨부 인프라(3.3~3.5)를 재사용해 업로드하고, 공지별 `attachments` row(`entity_type='notice'`, `kind='etc'`)로 Storage와 DB 정합을 맞춘다. 신규 attachment enum 값을 만들지 않으려고 `kind`는 기존 `etc`를 재사용하고 `entity_type='notice'`로만 식별한다.
- **업로드 시점(고아 방지)**: 편집 중에는 Storage에 아무것도 올리지 않고 File을 공유 맵(`pendingId → File`)에만 담아 blob으로 미리 본다. 저장 시에만 ①Storage 업로드(notice id에 의존하지 않는 경로 `{orgId}/notice/{uuid}/{uuid}-{name}`) → ②`content_json`의 pending 노드를 object path로 치환 → ③공지 insert/update → ④업로드분 row 생성 + 본문에서 빠진 이미지(Storage+row) 정리 순으로 처리한다. 저장이 실패하면 방금 올린 object를 보상 삭제해 참조 없는 고아를 남기지 않는다. 업로드 실패한 pending 노드는 문서에서 제거하고 부분 성공을 사용자에게 알린다.
- **삭제 정합**: 공지 삭제는 이력 보존용 soft delete(`deleted_at`)라 이미지를 지우지 않는다(과거 공지의 이미지가 깨지지 않도록). 이미지 정리는 update 시 이전/다음 `content_json`의 path 차집합으로 수행한다(본문에서 뺀 이미지의 Storage object와 row 삭제, 공통 `deleteAttachment` 정합 로직 재사용).
- **해석(표시) 방식**: 표시 시점에 object path를 signed URL로 해석한다(관리자 상세·입주자 앱·공유 링크 3경로 동일 렌더러). 서명 주체만 경로별로 다르다.
  - 관리자 상세(클라이언트): staff는 `org_members`라 Storage RLS로 직접 서명한다. `useNoticeImageUrls`가 공통 `useAttachments`+`useAttachmentSignedUrls`를 재사용해 path→signed URL 맵을 만들고 `NoticeContent`에 넘긴다.
  - 입주자 앱·공유 링크(서버 컴포넌트): 세입자(`res_claims`)·anon은 `org_members`가 아니라 Storage RLS로 서명할 수 없다(정합 확인: `my_org_ids()`가 빈 집합). 이미 열람이 인가된 공지에 한해 `lib/notice/serverImages.ts`가 service_role(`createAdminClient`)로 서명하되, 교차 org 유출을 막는 신뢰 경계를 둔다 — (1)해당 공지의 attachments row만(entity_id=noticeId), (2)`content_json`이 실제 참조하는 path와 교집합만, (3)각 row의 신뢰된 `org_id`와 path 첫 세그먼트 일치 검증. 공개 링크는 RPC가 notice id를 반환하지 않으므로 service_role로 `notice_share_tokens`를 조회해 id를 얻고 RPC와 동일한 만료 게이트를 다시 적용한다.
- **src 허용 정책(보안)**: `lib/notice/images.ts`의 `isNoticeImagePath`가 `{orgId}/notice/...` 형태만 허용해 외부 임의 URL·`data:`·상대경로·타 org 경로를 차단한다. 서버 서명은 위 신뢰 경계로, 편집기 업로드는 org 스코프 경로 생성으로 각각 org 밖 접근을 막는다. 미해석 이미지는 object path를 노출하지 않고 로딩/대체 표시만 남긴다.
- **마이그레이션 불필요**: `content_json`(jsonb)과 읽기 RPC는 0158에서 이미 라이브 반영됐고, `attachments` 테이블·private bucket·정책도 기존 것을 그대로 쓴다. image 노드는 `content_json` 안에 들어가고 첨부는 기존 스키마로 저장되므로 이번 작업에는 새 컬럼·enum·RPC 변경이 없다(파괴적 변환 없음). ⚠️ **정정(2026-09-16)**: 이 전제는 첨부 메타 마이그레이션 `0157`(`mime_type`/`size_bytes`)이 라이브에 적용돼 있어야 성립한다. 실제로는 0157이 라이브에 누락돼 있어(0158은 적용됨) 첨부 row INSERT가 전건 400 실패했다. E2E에서 발견 후 0157을 라이브 적용해 해소(§7.4).
- **로딩 표준**: 최초 조회 `isPending`/`isLoading`, 갱신 `isFetching`, mutation 제출 `isPending`을 유지하고 전역 `useLoading`을 만들지 않는다. 편집기 NodeView와 읽기 렌더러의 이미지 로딩 표시에는 `role="status"`와 읽을 수 있는 `aria-label`을 제공한다.

### 7.3 검증 결과

- `npx tsc --noEmit`: 통과
- 공지·이미지 표적 테스트: `npx vitest run notice` 17개 파일·79개 테스트 통과(신규 `lib/notice/images.test.ts` 경로 검증·재작성 로직 포함, `NoticeContent`·`richText`에 이미지 케이스 추가, RSC data·staff 폼/상세/목록 테스트를 이미지 배선에 맞게 갱신).
- `npm run lint`: 통과(신규 React 19 훅 규칙 대응 — NodeView는 공통 `useObjectUrls` 재사용, pending 맵은 `useState`로 보관해 렌더 중 ref 읽기 회피).
- `npm test`(전체): 342개 파일 중 334개 통과·6개 실패·2개 건너뜀; 1,333개 테스트 중 1,316개 통과·8개 실패·9개 건너뜀. **신규 회귀 0개**(실패는 기존 기준선 6개 파일·8개와 동일: `navItems.test.ts`(1), `kakao/login`(1), `kakao/stub`(1), `messaging/HistoryTab`(2), `utilities/UtilityWorkspaceHeader`(1), `receipts/payment/GiroLedgerModal`(2)). 작업 중 발생한 `notices/page.test.tsx` 회귀 3건은 mock 보강으로 해소했다.
- `npm run build`: 통과 (Next.js 16.3.0, `/staff/notices`·`/resident/notice/[id]`·`/r/notice/[token]` 포함 생성).
- `git diff --check`: 공백/충돌 오류 없음. 최종 검색: `docs/prototype/**` 변경 0건, 읽기 경로 `dangerouslySetInnerHTML` 0건, 새 마이그레이션 0건.

### 7.4 실 브라우저 E2E 검증 결과 (2026-09-16)

Playwright(Chromium, 헤드리스)로 로컬 dev(`localhost:3000`, master 체크아웃)에서 **라이브 Supabase(`amhtprmapxlizdnsgbeg`)** 를 대상으로 실 렌더·네트워크·DOM·DB 근거를 수집했다. 하네스와 스크린샷은 `scripts/notice-e2e/`(`out/*.png`, `staff-results.json`, `server-results.json`). 결과: **스태프측 29/29 + 서버측 10/10 통과**. jsdom(vitest)로는 불가능한 편집기 상호작용·이미지 업로드→signed URL 왕복·3경로 동일 렌더를 실 브라우저로 확인했다.

**⚠️ 검증 중 발견·수정한 실 프로덕션 버그 — 마이그레이션 0157 라이브 미적용**

- **증상**: 라이브에서 공지 본문 이미지가 Storage에는 업로드되지만 `attachments` INSERT가 `HTTP 400 PGRST204 "Could not find the 'mime_type' column of 'attachments'"`로 전건 실패 → attachments row 미생성 → **3경로 모두 이미지 렌더 불가 + Storage 고아**. 공지 저장 자체는 성공 토스트가 떠서 사용자에게 실패가 드러나지 않았다(부분 실패 경고만 부수 노출).
- **근본원인**: `supabase/migrations/0157_attachment_metadata_and_image_policy.sql`(`attachments.mime_type`/`size_bytes` 컬럼·크기 CHECK·버킷 MIME 축소)이 **라이브 DB에 적용되지 않았다**. 다음 번호 0158(`content_json`)은 적용된 상태 — 수동 Management API 적용에서 0157이 건너뛰어졌다(라이브 버킷 `allowed_mime_types`에 축소 전 `gif/heic/heif`가 남아 있던 점으로 교차 확인). 공용 `uploadAttachment`(`hooks/reactquery/attachments/apis.ts`)와 `insertNoticeImageRows`(`hooks/reactquery/notices/imageApis.ts`)가 이 컬럼을 기록하므로, **공지 이미지뿐 아니라 건물 계약사진·업체·장기수선 등 모든 첨부 INSERT가 라이브에서 400**이었다.
- **단위 테스트가 못 잡은 이유**: 테스트가 Supabase 클라이언트를 mock → INSERT가 통과했다. 실 DB E2E에서만 노출되는 배포/마이그레이션 갭이다.
- **조치**: 사용자 승인 후 **0157을 라이브 적용(2026-09-16, Management API)**. 재검증에서 `attachments` INSERT `201`, 3경로 이미지 정상 렌더, 이미지 제거 시 row+object 정리(고아 0)를 확인했다. → §3.4의 `mime_type`/`size_bytes` 반영 항목과 §7.3의 "마이그레이션 불필요"는 **0157 라이브 적용을 전제로만 참**이며, 오늘 적용 전까지는 라이브에서 거짓이었음을 명시한다.

**시나리오별 결과**(각 통과 근거 요약)

1. **편집기 기본·접근성** — ✅ 통과. 편집 영역 `role="textbox"`·`aria-multiline="true"`·`aria-label="공지 내용"`, toolbar `role="toolbar" aria-label="공지 서식"` + 12개 버튼 `aria-label`/`aria-pressed` 전수 확인. 타이핑, 굵게(`<strong>`+aria-pressed 토글), 제목1→`<h2>`, 글머리목록→`<ul><li>`, 실행취소/다시실행, 서식 붙여넣기 시 `<strong>` 유지·비허용 마크(u/code/s) 제거·텍스트 보존, 긴 문서 `max-height:420px`+`overflow-y:auto` 스크롤, 모바일 390px `flex-wrap`(2행), 빈 내용 저장 시 `aria-invalid=true`+`aria-describedby=notice-content-error`+"내용을 입력해 주세요".
2. **링크 정책** — ✅ 통과. `javascript:`·`data:` 입력 시 정책 alert("http, https, mailto, tel 링크만…") 노출 + `<a>` 미삽입, `https://` 허용, 편집기·읽기 렌더 출력 모두 `target="_blank" rel="noopener noreferrer nofollow"`.
3. **본문 이미지 라이프사이클** — ✅ 통과(0157 적용 후). 이미지 선택 시 `blob:` 미리보기만·Storage 업로드 없음 → 저장 시에만 Storage 업로드+`content_json` path 치환+`notices` INSERT+`attachments` INSERT(`mime_type`/`size_bytes` 포함) 순서 관측 → 재조회 시 signed URL 렌더. 이미지 제거 후 저장 시 `attachments` DELETE + Storage remove로 고아 0 정리 확인. `content_json`에는 **공개 URL이 아니라 object path만**(`1/notice/{uuid}/{uuid}-name.png`) 저장(DB 대조: `has_object_path=true, has_http_url=false`). MIME(gif)·용량(>10MB) 거부. 저장 실패 시 방금 올린 object 보상 삭제도 0157 적용 전 실패 경로에서 관측됨.
4. **3경로 동일 렌더** — ✅ 통과. 같은 공지(id 3)를 스태프 상세(RLS 클라이언트 서명)·입주자앱 `/resident/notice/3`(service_role 스코프 서명)·공개 공유 `/r/notice/{token}`(service_role+토큰)에서 열어, **같은 본문 텍스트 + 완전히 동일한 signed object(`1/notice/1ea73cb0…/259a759a-…-e2e-img-a.png`)** 를 렌더하고 세 경로 모두 이미지가 실제 디코딩됨(`naturalWidth=480`). 익명 공개 페이지 이미지 렌더는 `s4c-public-valid.png`로 육안 확인.
5. **레거시 호환** — ✅ 통과. `content_json=null` 평문 공지: 읽기 경로 `.plain`(`white-space:pre-wrap`)으로 줄바꿈 보존("첫째 줄…\n둘째 줄…\n\n넷째 줄…"). 편집기로 열면 문단 문서로 승격(4개 `<p>`, 원문 비파괴 보존).
6. **보안·격리** — ✅ 통과(live) + 코드 검증. 만료 토큰 → "만료된 링크예요" + 이미지 마스킹(서명 0), 위조 토큰 → "유효하지 않은 링크예요"(데이터 유출 없음). `lib/notice/serverImages.ts`의 3중 신뢰 경계(대상 공지 row 한정 `entity_id=noticeId` + `content_json` 참조 path 교집합 + `isNoticeImagePath(file_url, row.org_id)` 첫 세그먼트 org 일치)와 `resident_notice_detail`의 연결 org 스코프로 교차 org 차단을 소스에서 확인. (라이브 DB에 org가 1개뿐이라 2번째 org로의 negative 실검증은 불가 → 코드·경로 스코프로 검증.)
7. **signed URL 만료 자동 재조회** — ✅ 소스 상수로 검증. `lib/attachments/signedUrl.ts`: TTL `3600s`, React Query `staleTime=3,000,000ms(50분)` < `gcTime=3,300,000ms(55분)` < TTL(60분) → 표시 중 URL이 만료 전에 갱신/GC되어 깨진 이미지가 남지 않음(50분 대기 실측은 비현실적이라 상수·적용부로 검증).
8. **번들 격리** — ✅ 통과. 정적 import 그래프: `@tiptap/react`(편집기 코드)는 `NoticeEditor`/`NoticeImage`/`NoticeImageNodeView`에만 존재, `NoticeEditor`는 `NoticeFormModal`에서만 import, 읽기 3경로는 `NoticeContent`(static-renderer)만 사용. 런타임: `/resident/notice/[id]`·`/r/notice/[token]` 초기 로드에서 tiptap/prosemirror 청크 요청 **0건**. (편집기를 호스팅하는 `/staff/notices`가 청크를 로드하는 것은 정상.)

**전체 스위트**: `npm test` = 342 파일 중 5 실패/335 통과/2 skip, 1,333 테스트 중 6 실패/1,318 통과/9 skip. 실패 6건은 전부 공지와 무관한 기존 기준선(`navItems`·`kakao/login`·`kakao/stub`·`UtilityWorkspaceHeader`·`GiroLedgerModal`)이며 **공지 관련 실패·신규 회귀 0건**(직전 기준선의 `messaging/HistoryTab` 2건은 이번에 통과).

**blast-radius 최종 확인(2026-09-16) — 업체(vendor) 첨부 스모크**: 0157 갭이 공지 한정이 아니라 공용 `uploadAttachment`(건물·업체·장기수선 공통)에 영향했으므로, 비-공지 엔티티 하나로 최종 확인했다. `/staff/vendor-management`에서 업체 생성+계약서 사진 업로드 E2E(`scripts/notice-e2e/vendor.mjs`, V1–V5 통과): 선택 시 blob 미리보기·업로드 없음 → 저장 시 `POST /rest/v1/vendors` + `POST /storage/v1/object/attachments/1/vendor/{id}/…` + **`POST /rest/v1/attachments` 201(0157 fix 확인, `entity_type='vendor'`·`mime_type`/`size_bytes` 기록)** → 재조회 시 signed 썸네일 렌더. 즉 첨부 전반이 0157로 정상화됨을 실증. (건물 new-v2 전용 폼·장기수선 AttachmentViewer는 동일 경로라 미실행.)

**미실행/제약**: (a) 유료 Image Transformations 경로(thumbnail/preview 변환)는 로컬이 Free(변환 비활성)라 미검증 — 표시 이미지는 원본 signed URL fallback으로 로드됨(§3.5 Free 분기 실동작 확인). (b) 테스트 데이터는 `scripts/notice-e2e/cleanup.mjs`로 정리(classifier가 에이전트 프로덕션 쓰기를 막아 사용자 `!` 실행; 정리 범위는 사전 dry-run으로 E2E 산출물만 삭제·실데이터 무영향 확인).

## 8. 배포 전 검증

- [x] `npm run lint`
- [x] `npm test` (2026-09-16: 342 파일 5실패/335통과/2skip · 1,333 테스트 6실패/1,318통과/9skip — 실패는 전부 공지 무관 기존 기준선, 신규 회귀 0)
- [x] `npm run build`
- [x] 공지 본문 이미지: 선택(blob 미리보기) → 저장(업로드+row) → 재조회(signed URL) → 삭제(고아 0) E2E 확인 (2026-09-16, §7.4 S3). ⚠️ 이 과정에서 **0157 미적용 버그**를 발견·라이브 적용으로 해소.
- [x] 비-공지 엔티티 신규 첨부 E2E(업체) 확인 (2026-09-16, §7.4 blast-radius): 선택→blob 미리보기→저장(업로드+row 201)→재조회(signed 썸네일). 건물 new-v2 전용 폼 E2E는 미실행이나 동일 공용 경로가 검증됨.
- [x] 업체 첨부 업로드/조회 스모크 확인(2026-09-16, `entity_type='vendor'`·`mime_type`/`size_bytes` 기록·signed 렌더). 장기수선 전용 회귀는 후속(동일 공용 `uploadAttachment` 경로).
- [x] 다른 조직의 Storage object 접근 차단: 코드·경로 스코프로 검증(`serverImages.ts` 3중 신뢰 경계 + `isNoticeImagePath` org 첫 세그먼트 + `resident_notice_detail` 연결 org 스코프). ⚠️ 라이브 org가 1개뿐이라 2번째 org로의 negative 실검증은 불가(§7.4 S6).
- [x] Free 환경 이미지 원본 fallback 확인 (2026-09-16): `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMATIONS_ENABLED` 미설정 → `signedUrlOptions`가 transform 미부여 → 원본 signed URL 로드(3경로 이미지 실제 디코딩됨).
- [ ] 유료 전환 환경 thumbnail/preview 변환·원본 다운로드는 로컬 Free 환경이라 미검증(변환 비활성). 유료 전환 후 확인 필요.
- [x] signed URL 만료 후 자동 재조회: 소스 상수로 검증(§7.4 S7) — `staleTime 50분 < gcTime 55분 < TTL 60분`이라 표시 중 URL 만료 전 갱신. (50분 대기 실측은 비현실적이라 상수·적용부로 확인.)
- [ ] 모든 폼 키보드 제출·중복 제출 방지: 공지 폼은 제출 중 submit 비활성(중복 방지)·빈 내용 검증을 확인(§7.4 S1). 전 폼 전수는 §4 범위.
- [ ] toast와 loading의 스크린리더 안내: 공지 편집기 a11y(role/aria) 확인(§7.4 S1). 앱 전역 toast/loading 전수는 §5·§6 범위.
- [x] Tiptap 미사용 화면 초기 번들에 편집기 코드 미포함: 정적 import 그래프 + 읽기 라우트 런타임 청크 0건으로 검증(§7.4 S8).

## 9. 완료 판정

- [x] 1차 범위: `hooks/common`, debounce 중복 제거, 이미지 업로드/조회/삭제, Free fallback 완료
- [x] 폼 범위: 17개 폼 전수 확인 및 표준화 완료
- [ ] toast 범위: 허용된 경계 외 Sonner 직접 import 0건
- [ ] loading 범위: 모든 비동기 상태가 정의된 상태 모델과 공통 UI를 사용
- [x] Tiptap 범위: 선설치·공지 파일럿·본문 이미지(7.3) 구현·검증 완료 + **실 브라우저 E2E 완료(2026-09-16, §7.4: 스태프 29/29 + 서버 10/10)**. E2E 중 발견한 마이그레이션 0157 라이브 미적용 버그를 적용으로 해소. npm audit 업데이트도 완료(10.3).
- [ ] 전체 lint/test/build 및 핵심 E2E 통과

## 10. 현재 검증 기준선

2026-09-15 Tiptap 선설치 직후 전체 검증 결과다. 아래 실패는 Tiptap을 화면에서 import하기 전 기존 작업 트리에서 확인된 기준선이며, 최종 완료 전 모두 해소한다.

- [x] `npm run build`: production build 및 TypeScript 검사 통과
- [x] `npm run lint`: 참조 전용 `docs/prototype/**` 제외 후 통과
- [ ] `npm test`: 314개 test file 중 304개 통과, 8개 실패, 2개 skip; 1,226개 test 중 1,203개 통과, 14개 실패, 9개 skip
- [x] `npm audit`: 착수 시점 7건(moderate 4·high 2·critical 1) → 처리 후 **2건(moderate)**. 남은 2건은 `exceljs`가 의존하는 `uuid` 계열이며 파괴적 downgrade만 유효해 보류(사유는 10.3). Tiptap 경로는 보고에 없었다.
- [x] Next.js `16.3.0` 취약점(critical RCE 2건: GHSA-p293-qw3h-jr36·GHSA-2xp9-vwfh-vxw4)은 안내된 non-major 수정 버전 `16.3.5`(16.x 내 patch)로 상향해 해소했다. `eslint-config-next`도 `16.3.5`로 정렬. major 점프 없음.

### 10.1 1차 작업 검증 결과

2026-09-15 1차 작업 완료 후 검증 결과다. 전체 테스트 실패 수와 실패 파일은 기존 기준선과 동일하며, 이번 작업 범위의 표적 테스트에서는 신규 실패가 없다.

- [x] `npm run lint`: 통과
- [x] `npm run build`: production build, TypeScript 검사, 72개 정적 페이지 생성 통과
- [x] 1차 작업 표적 테스트: 13개 test file, 49개 test 통과
- [ ] `npm test`: 323개 test file 중 313개 통과, 8개 실패, 2개 skip; 1,246개 test 중 1,223개 통과, 14개 실패, 9개 skip
- [x] Free fallback 및 유료 transform 분기 단위 테스트 통과
- [x] 실제 신규 건물/업체 ID 업로드와 부분 실패 재시도 단위 테스트 통과

### 10.2 기존 폼 전체 일괄 전환 검증 결과

2026-09-15 17개 대상 전수 확인 및 전환 후 결과다. 작업 시작 전에 전체 테스트 기준선을 다시 실행해 8개 파일·14개 실패를 확인했으며, 전환 후 실패 파일과 실패 테스트 수가 동일함을 대조했다.

- [x] 표적 테스트: 19개 test file, 70개 test 통과. 17개 대상 폼과 공통 숫자·날짜·nullable 변환, 필드/전역 서버 오류 분기 포함
- [x] `npm run lint`: 통과
- [x] `npm run build`: Next.js 16.3.0 production build, TypeScript 검사, 72개 정적 페이지 생성 통과
- [ ] `npm test`: 336개 test file 중 326개 통과, 8개 실패, 2개 skip; 1,290개 test 중 1,267개 통과, 14개 실패, 9개 skip
- [x] 신규 회귀: 0개. 작업 전 기준선은 323개 test file 중 313개 통과, 8개 실패, 2개 skip; 1,246개 test 중 1,223개 통과, 14개 실패, 9개 skip였다. 신규 13개 test file과 44개 test가 추가됐고 실패 수는 증가하지 않았다.

기존 기준선 8개 실패 파일(총 14개 실패):

- `components/shell/navItems.test.ts` — 1개
- `app/(staff)/staff/(app)/messaging/page.test.tsx` — 3개
- `app/(staff)/staff/(app)/messaging/components/HistoryTab.test.tsx` — 2개
- `app/(staff)/staff/(app)/notices/page.test.tsx` — 3개
- `app/api/resident/kakao/login/route.test.ts` — 1개
- `app/api/resident/kakao/stub/route.test.ts` — 1개
- `app/(staff)/staff/(app)/utilities/components/UtilityWorkspaceHeader.test.tsx` — 1개
- `app/(staff)/staff/(app)/receipts/components/payment/GiroLedgerModal.test.tsx` — 2개

### 10.3 npm audit 의존성 업데이트 결과 (2026-09-15)

착수 시점 `npm audit` 7건(moderate 4·high 2·critical 1)을 비파괴 최소 업데이트로 처리했다. 최종 잔여는 moderate 2건이며, 이는 파괴적 변경 없이는 해소 불가해 보류하고 아래에 근거를 남긴다. `docs/prototype/**`는 변경하지 않았다.

**분류(직접/전이 · 런타임/개발전용)**

| 패키지 | 심각도 | 직접/전이 | 런타임/개발 | 조치 |
| --- | --- | --- | --- | --- |
| `next` | critical | 직접 | 런타임 | `16.3.0 → 16.3.5` (16.x 내 patch) — **해소** |
| `sharp` | high | 전이(← next) | 런타임 | `0.35.3 → 0.35.4` (`npm audit fix`) — **해소** |
| `js-yaml` | high | 전이(← eslint) | 개발 | `4.3.1 → 4.3.2` (`npm audit fix`) — **해소** |
| `vitest` / `@vitest/mocker` | moderate×2 | 직접/전이 | 개발 | `4.1.10 → 4.1.11` (`npm audit fix`) — **해소** |
| `uuid` / `exceljs` | moderate×2 | 전이(← exceljs)/직접 | 런타임 | **보류**(아래 근거) |

**적용 방법(비파괴 최소)**

- `npm audit fix`(`--force` 미사용)로 `sharp`·`js-yaml`·`vitest` 계열을 semver 범위 내 patch로 상향. `package.json` 무변경(전이/semver 호환), lockfile만 갱신.
- `next`는 `package.json`을 `16.3.0 → 16.3.5`로 표적 상향 후 `npm install`. audit이 `--force`로 안내한 것은 기존 핀이 정확히 `16.3.0`이었기 때문이며, `16.3.5`는 16.x 내 patch(최신 dist-tag `latest`)라 major 점프가 아니다. `node_modules/next/dist/docs`의 upgrading 가이드 확인 결과 16.3.x patch 구간의 신규 deprecation·breaking change 없음. Next 권장에 맞춰 `eslint-config-next`도 `16.3.5`로 정렬.

**보류(2건, moderate) — `uuid`(← `exceljs@4.4.0`)**

- 유일한 수정 경로가 `exceljs@4.4.0 → 3.4.0` **downgrade(major·breaking)**뿐이다. `exceljs`는 은행/지로/영수증/검침대장 등 xlsx 내보내기의 핵심이라 회귀 위험이 크고, 상향이 아닌 하향이라 4.x의 개선·수정을 잃는다. 사용자 정책(“major/파괴적 변경은 자동 적용 금지, 결정 요청”)에 따라 자동 적용하지 않았다.
- 실질 도달성: 해당 advisory(GHSA-w5hq-g745-h8pq)는 uuid **v3/v5/v6에 `buf` 인자를 넘길 때**만 영향을 받는다. `exceljs`는 `const {v4: uuidv4} = require('uuid')`로 **v4를 인자 없이** 호출(`cf-rule-ext-xform.js`)하므로 이 코드 경로에서 취약점은 도달하지 않는다. → 실사용 위험은 낮음으로 평가하고, 파괴적 downgrade 대신 보류를 권장한다.
- **결정(2026-09-15, 사용자 확인): ① 현행 유지**(위험 수용). `exceljs@4.4.0`을 그대로 두고 잔여 moderate 2건을 수용한다(미도달 취약점 + 유일 수정이 파괴적 downgrade). 검토했던 대안: ② npm `overrides`로 `exceljs`의 `uuid`만 `^11.1.1` 강제(단 `exceljs@4.4.0`은 uuid v8 API 기준이라 런타임 호환 검증 필요) / ③ `exceljs@3.4.0`으로 downgrade(비권장, 최고 회귀 위험). 향후 `exceljs`가 `uuid ≥11.1.1` 의존 버전을 릴리스하면 그때 상향한다.

**검증 결과**

- `npm audit`: 7건 → **2건(moderate, 위 보류분)**.
- `npx tsc --noEmit`: 통과(exit 0).
- `npm run lint`: 통과(exit 0). `eslint-config-next` patch 상향으로 인한 신규 lint 오류 없음.
- `npm test`(전체): 342개 파일 중 334개 통과·6개 실패·2개 skip; 1,333개 테스트 중 1,316개 통과·8개 실패·9개 skip. **신규 회귀 0개** — 실패는 기존 기준선 6개 파일·8개(`navItems`(1)·`kakao/login`(1)·`kakao/stub`(1)·`messaging/HistoryTab`(2)·`utilities/UtilityWorkspaceHeader`(1)·`receipts/payment/GiroLedgerModal`(2))와 동일. 표적 재실행에서 이 6개 파일이 8개 실패를 모두 차지함을 확인.
- ExcelJS 내보내기 표적 테스트(`lib/export/xlsx`·`bankParse`·`BankImportModal`·`utilities/ledger/route`·`payment/cms/route`): 5개 파일·22개 테스트 전부 통과. `exceljs`는 이번에 변경하지 않았고 회귀 없음을 재확인.
- `npm run build`: 통과(exit 0, Next.js 16.3.5, 라우트 매니페스트 정상 생성).
- `git diff --check`: 공백/충돌 오류 없음(exit 0). 변경 파일은 `package.json`(2줄)·`package-lock.json`(224/224 라인 버전·해시 스왑)뿐. `docs/prototype/**` 변경 0건.

## 11. 변경 이력

- 2026-09-15: 최초 작성. 사용자 결정 5건과 현재 코드 인벤토리를 반영했다.
- 2026-09-15: Tiptap React 최소 패키지 3종 `3.31.3` 선설치 완료.
- 2026-09-15: 사용자 지시에 따라 `docs/prototype/**`를 작업 및 lint 범위에서 제외.
- 2026-09-15: 1차 범위의 공통 훅, debounce 통합, 이미지 첨부 데이터 경계, Free Supabase fallback 구현 및 검증 완료.
- 2026-09-15: 4장 17개 대상 전수 확인. 저장 폼을 React Hook Form + Zod로 통합하고 `BuildingSearchCard`는 조회 전용 예외로 근거를 기록했으며, 표적 테스트 19개 파일·70개 통과와 전체 기준선 대비 신규 회귀 0개를 확인했다.
- 2026-09-15: 7장 공지사항 Tiptap 파일럿 구현. `content_json`(jsonb) additive 컬럼·마이그레이션 `0158`, 작성 화면 편집기(SSR-safe, 최소 toolbar, 링크 허용 정책)·공유 읽기 렌더러(`@tiptap/static-renderer`)·레거시 평문 폴백을 배선하고 관리자 상세·입주자 앱·공유 링크에 적용했다. 표적 테스트 8개 파일 통과, 전체 신규 회귀 0개(`notices/page.test.tsx` 3개 갱신으로 기준선 11→8). `@tiptap/static-renderer@3.31.3` 추가.
- 2026-09-15: 7.3 공지 본문 이미지 구현. 커스텀 Tiptap image 노드+React NodeView, 공통 첨부/Storage 재사용(object path만 `content_json`에 저장), 저장 시 업로드→치환→저장→정리(고아 방지·보상 삭제), 표시 시 signed URL 해석(관리자=RLS 클라이언트, 입주자·공유=service_role 스코프 서명). `src` 허용 정책으로 외부 URL·`data:`·교차 org 차단. 새 마이그레이션 없음. 표적 테스트 17개 파일·79개 통과, 전체 신규 회귀 0개(기준선 6개 파일·8개 유지), lint/build 통과.
- 2026-09-15: 7.1/10 npm audit 의존성 업데이트. 비파괴 최소 상향으로 7건 → 2건(critical `next` 16.3.0→16.3.5·high `sharp`/`js-yaml`·moderate `vitest` 계열 해소, `eslint-config-next` 16.3.5 정렬). 잔여 2건(moderate `uuid`←`exceljs`)은 파괴적 downgrade만 유효(+ v4 무인자 호출로 미도달)해 보류하고 근거·대안을 10.3에 기록. 변경은 `package.json`(2줄)·lockfile 한정, tsc/lint/test(신규 회귀 0)/build/`git diff --check` 통과, `docs/prototype/**` 무변경.
- 2026-09-16: 공지 Tiptap 편집기·본문 이미지 **실 브라우저 E2E 검증(§7.4)**. Playwright로 라이브 Supabase 대상 스태프 29/29 + 서버 10/10 통과(편집기·a11y·링크정책·이미지 라이프사이클·3경로 동일 렌더·레거시·보안·번들격리). 검증 중 **마이그레이션 0157(attachments `mime_type`/`size_bytes`) 라이브 미적용** 버그 발견 — 공용 첨부 INSERT 전건 400으로 이미지 렌더 불가·고아 발생. 사용자 승인 후 0157 라이브 적용해 해소하고 재검증에서 정상 확인. §3.4·§7.3의 관련 전제를 정정하고 §8 배포 전 검증 항목을 실제 결과로 갱신. `npm test`=6실패/1,318통과(공지 무관 기존 기준선, 신규 회귀 0). E2E 하네스는 `scripts/notice-e2e/`(리포지토리 커밋은 별도 요청 시).
