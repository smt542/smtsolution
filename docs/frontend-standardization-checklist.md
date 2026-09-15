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
- [x] `attachments`에 `mime_type`, `size_bytes` 저장 여부를 마이그레이션에서 반영한다.
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

- [ ] 최초 데이터 로딩은 `isPending`/`isLoading`으로 표시한다.
- [ ] 기존 데이터가 있는 백그라운드 갱신은 `isFetching`으로 구분한다.
- [ ] mutation 제출 상태는 해당 mutation의 `isPending`을 사용한다.
- [ ] React Query 밖의 Promise 작업만 `useAsyncAction`을 사용한다.
- [ ] 여러 요청의 결합 loading은 의미가 드러나는 파생 변수로 정의한다.
- [ ] 전역 boolean `useLoading`은 만들지 않는다.

### 6.2 공통 UI와 접근성

- [ ] 공통 `LoadingState` 또는 기존 `Spinner` 확장안을 확정한다.
- [ ] 로딩 UI에 `role="status"`와 읽을 수 있는 `aria-label`을 제공한다.
- [ ] 빈 상태, 오류 상태, 최초 로딩 상태를 서로 구분한다.
- [ ] 버튼 pending 문구를 `저장 중…`, `삭제 중…`, `발송 중…`처럼 동작별로 표시한다.
- [ ] 로딩 중 레이아웃 이동을 줄이도록 화면 단위 skeleton 또는 최소 높이를 적용한다.
- [ ] `loading.tsx`는 서버 라우트 전환용으로 유지하고 클라이언트 query loading과 역할을 구분한다.
- [ ] 모든 `isLoading`/`isPending`/`isFetching` 사용처를 전수 검색해 기준 준수 여부를 확인한다.

### 6.3 기존 route loading 경계 확인

- [ ] `app/(partner)/partner/(app)/mobile-as-new/loading.tsx`
- [ ] `app/(partner)/partner/(app)/mobile-building/loading.tsx`
- [ ] `app/(partner)/partner/(app)/mobile-ms-new/loading.tsx`
- [ ] `app/(partner)/partner/(app)/mobile-tenant/loading.tsx`
- [ ] `app/(resident)/resident/(app)/bill/loading.tsx`
- [ ] `app/(resident)/resident/(app)/notice/loading.tsx`
- [ ] `app/(staff)/staff/(app)/bill/loading.tsx`
- [ ] `app/(staff)/staff/(app)/long-term-repair/loading.tsx`
- [ ] `app/(staff)/staff/(app)/messaging/loading.tsx`
- [ ] `app/(staff)/staff/(app)/notices/loading.tsx`
- [ ] `app/(staff)/staff/(app)/overdue/loading.tsx`

## 7. Tiptap 선설치와 후속 도입

### 7.1 선설치

- [x] 공식 React 최소 패키지를 설치한다: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`.
- [x] 세 패키지의 major/minor 버전이 일치하는지 확인한다. (`3.31.3`)
- [x] 설치 후 lockfile을 반영한다.
- [ ] 미사용 상태에서 lint, test, production build가 동일하게 통과하는지 확인한다.
- [ ] 편집기 코드는 필요 화면에서만 client component로 import한다.
- [ ] `npm audit` 기준 기존 취약점 7건을 별도 의존성 업데이트 작업으로 처리한다. Tiptap 3종은 보고된 취약 패키지에 포함되지 않는다.

### 7.2 공지사항 파일럿

- [x] 최초 적용 대상은 공지사항으로 한다.
- [x] 문자와 알림톡 템플릿은 plain text를 유지한다.
- [x] 편집기 원본 저장 형식은 Tiptap JSON을 기본으로 한다.
- [ ] 기존 plain text 공지를 Tiptap JSON으로 읽는 호환 전략을 작성한다.
- [ ] DB 컬럼 추가 또는 기존 컬럼 전환 방식을 결정하고 마이그레이션한다.
- [ ] 작성 화면과 읽기 전용 렌더러가 같은 extension 구성을 공유한다.
- [ ] Next.js SSR 환경에서 편집기 초기화를 클라이언트로 제한한다.
- [ ] 허용 toolbar 기능을 확정한다.
- [ ] 링크 프로토콜과 속성 허용 정책을 정의한다.
- [ ] 본문 이미지 기능은 공통 이미지 업로드 완료 후 연결한다.
- [ ] 빈 문서, 붙여넣기, 긴 문서, 모바일, 접근성을 테스트한다.
- [ ] 작성자 화면, 입주자 앱, 공유 링크에서 동일하게 렌더링되는지 확인한다.

## 8. 배포 전 검증

- [x] `npm run lint`
- [ ] `npm test`
- [x] `npm run build`
- [ ] 신규 건물 사진 선택 → 미리보기 → 저장 → 재조회 → 삭제 E2E를 확인한다.
- [ ] 업체와 장기수선 첨부의 업로드/조회/삭제 회귀 테스트를 수행한다.
- [ ] 다른 조직의 Storage object를 읽거나 삭제할 수 없는지 RLS를 확인한다.
- [ ] Free 환경에서 이미지 원본 fallback을 확인한다.
- [ ] 유료 전환 환경에서 thumbnail/preview 변환과 원본 다운로드를 확인한다.
- [ ] signed URL 만료 후 자동 재조회 여부를 확인한다.
- [ ] 모든 폼에서 키보드 제출과 중복 제출 방지를 확인한다.
- [ ] toast와 loading의 스크린리더 안내를 확인한다.
- [ ] Tiptap 미사용 화면의 초기 번들에 편집기 코드가 포함되지 않는지 확인한다.

## 9. 완료 판정

- [x] 1차 범위: `hooks/common`, debounce 중복 제거, 이미지 업로드/조회/삭제, Free fallback 완료
- [x] 폼 범위: 17개 폼 전수 확인 및 표준화 완료
- [ ] toast 범위: 허용된 경계 외 Sonner 직접 import 0건
- [ ] loading 범위: 모든 비동기 상태가 정의된 상태 모델과 공통 UI를 사용
- [ ] Tiptap 범위: 선설치 검증 완료, 공지사항 파일럿은 별도 완료 표시
- [ ] 전체 lint/test/build 및 핵심 E2E 통과

## 10. 현재 검증 기준선

2026-09-15 Tiptap 선설치 직후 전체 검증 결과다. 아래 실패는 Tiptap을 화면에서 import하기 전 기존 작업 트리에서 확인된 기준선이며, 최종 완료 전 모두 해소한다.

- [x] `npm run build`: production build 및 TypeScript 검사 통과
- [x] `npm run lint`: 참조 전용 `docs/prototype/**` 제외 후 통과
- [ ] `npm test`: 314개 test file 중 304개 통과, 8개 실패, 2개 skip; 1,226개 test 중 1,203개 통과, 14개 실패, 9개 skip
- [ ] `npm audit`: moderate 4건, high 2건, critical 1건. Tiptap 경로가 아닌 기존 Next.js/ExcelJS/Vitest 계열에서 보고됨
- [ ] Next.js `16.3.0` 취약점은 현재 안내된 non-major 수정 버전을 검토하고 별도 업데이트한다.

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

## 11. 변경 이력

- 2026-09-15: 최초 작성. 사용자 결정 5건과 현재 코드 인벤토리를 반영했다.
- 2026-09-15: Tiptap React 최소 패키지 3종 `3.31.3` 선설치 완료.
- 2026-09-15: 사용자 지시에 따라 `docs/prototype/**`를 작업 및 lint 범위에서 제외.
- 2026-09-15: 1차 범위의 공통 훅, debounce 통합, 이미지 첨부 데이터 경계, Free Supabase fallback 구현 및 검증 완료.
- 2026-09-15: 4장 17개 대상 전수 확인. 저장 폼을 React Hook Form + Zod로 통합하고 `BuildingSearchCard`는 조회 전용 예외로 근거를 기록했으며, 표적 테스트 19개 파일·70개 통과와 전체 기준선 대비 신규 회귀 0개를 확인했다.
