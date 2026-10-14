## 케이스별 결과
| ID | 케이스 | 유형 | 우선순위 | 결과 | 중요도 | 확인 내용 | 개선 방안 | 캡처 |
|---|---|---|---|:---:|:---:|---|---|---|
| OM2-001 | IP 기준 로그인 실패 일시 잠금 | 예외 | P1 | **보류** | - | IP 잠금 영향으로 마지막에 별도 실행 예정. 코드/DB 분석만 함: `lib/auth/loginRateLimit.ts:11` IP 버킷 10분 10회 → 15분 잠금, `app/api/staff/login/route.ts:46-51` 잠금 시 429 + `Retry-After` 응답, 폼은 `errors.root` 영역에 사유 표시(`LoginForm.tsx:84`). DB 함수 `login_rate_limit_hit` 배포 확인. 계정 영구 잠금 로직은 없음 | - | |
| OM2-002 | 아이디 기준 실패 20회 경계 | 경계값 | P1 | **보류** | - | IP 잠금 영향으로 마지막에 별도 실행 예정. 코드 분석: `loginRateLimit.ts:13` 아이디 버킷 15분 20회 → 15분 잠금, 인증 전에 check 하므로 19회 상태에서는 정답 로그인 허용, 성공 시 버킷 reset(`recordLoginSuccess`) | - | |
| OM2-003 | 자동 로그인(아이디 기억) 저장·해제 | 상태전이 | P3 | **O** | - | 기본 type=password → 눈 아이콘 후 type=text. 자동 로그인 체크 로그인→로그아웃 시 아이디 `tc2a_office1` 자동 입력·체크 유지, 비밀번호 공란. 체크 해제 로그인→로그아웃 시 아이디 공란, localStorage `erp_login_remembered_id` 제거됨 | - | [img](captures/OM2-003_remembered_id.png) |
| OM2-004 | 임시 비밀번호 계정의 첫 로그인 강제 변경 | 상태전이 | P1 | **O** | - | 테스트 계정 tc2a_office1(임시 1234) 로그인 시 `/staff/change-password` 진입. 주소창 `/staff/buildings` 접근 시 다시 change-password로 돌아옴. `다른 계정으로 로그인`(로그아웃) 시 로그인 화면 이동. 변경 완료(5678) 후 `/staff/receipts` 진입, 재로그인 시 변경 화면 없이 바로 업무 화면 | - | [img](captures/OM2-004_change_password_screen.png) |
| OM2-005 | 회원가입·비밀번호 찾기 부재와 계정 문의 안내 | 정상 | P3 | **O** | - | LNB 없음, 좌측 브랜드 패널 "관리비서" + 우측 폼 2단. 회원가입·비밀번호 찾기 없음. "계정 문의는 마스터 관리자에게 요청해 주세요. / 문의 : 042-632-8770" 표시 | - | [img](captures/OM2-005_login_layout.png) |
| OM2-006 | 담당자 필터·검색 재조회와 결과 없음 | 정상 | P2 | **O** | - | `TC2A` 입력만 하고 2초 대기 시 목록 10곳 유지, 조회 RPC 0회. Enter 후 재조회되어 2곳. 사무 담당자 칩 `이중재` → 1곳, `관리자` → 7곳(단일 선택, 활성 칩 1개). 없는 건물명 → "조건에 맞는 건물이 없습니다." + 0곳 | - | [img](captures/OM2-006_manager_filter.png) |
| OM2-007 | 건물 목록 정렬·페이지당 건수 경계 | 경계값 | P3 | **△** | - | 조직 건물이 10개라 21개 사전조건은 갖추지 못함(타 그룹 화면에 영향이 있어 11개를 추가 생성하지 않음). 등록일 최신순 정렬과 230px 고정 높이·헤더 sticky 세로 스크롤은 확인함. 페이지가 1개면 페이지네이션과 10/20/50 드롭다운이 아예 렌더되지 않음(`BuildingDirectoryCard.tsx:170` `totalPages > 1`). 코드상 선택지는 10/20/50, 기본값은 20 | 1페이지일 때도 페이지당 건수 드롭다운은 노출 검토(`BuildingDirectoryCard.tsx:170` 조건을 페이지 번호에만 적용) | |
| OM2-008 | 입주민 관리카드 키보드 진입과 미저장 닫기 확인 | 상태전이 | P2 | **X** | 보통 | 입주민 행 포커스 후 Enter → 모달이 아니라 `/staff/buildings/33/tenants/73` 상세 페이지로 이동(dialog 0개). Space도 같은 처리(`TenantOccupancyCard.tsx:151-154`). 행 클릭 시 출력 모달은 열리지 않음(정상). 모달 Esc 미저장 확인은 모달이 없어 확인 불가. 상세 페이지 `목록으로`에서는 미저장 확인이 동작함 | 정책(3.3)대로 행 클릭·Enter·Space 시 `TenantForm`을 감싼 관리카드 모달 열기. `TenantOccupancyCard.tsx:150,154`의 `router.push`를 모달 open state로 교체하고, 닫기·배경·Esc 시 dirty 확인 | [img](captures/OM2-008_enter_navigates.png) |
| OM2-009 | 선택 건물 입주자카드 엑셀과 반출 감사 로그 | 정합성 | P2 | **X** | 보통 | `/api/buildings/33/tenant-cards`에서 `입주자카드_20261014.xlsx` 다운로드. 컬럼은 호실명/입주자명/룸타입/인원/입주일, 행 수 정상. `access_log`에 EXPORT_XLSX(target building 33, row_count 1) 기록됨. 다만 HQ `/platform-admin/audit-logs`는 `audit_log`만 조회해 반출 기록이 화면에 나오지 않음(audit_log의 EXPORT_* 0건) | `platform_list_audit_logs`(0277)에 `access_log`를 UNION하거나 `lib/audit/accessLog.ts:67`에서 audit_log에도 기록. 라벨 매핑(`hooks/reactquery/platform/auditLogs.ts:71-72`)은 이미 있음 | |
| OM2-010 | 출력 모달 초기 선택·미선택 상태·전량 인쇄 | 정상 | P2 | **△** | 낮음 | 건물 미선택: "왼쪽에서 건물을 선택해 주세요", `둘 다 인쇄` disabled. TC2A 건물 선택 후 열면 초기 선택, 2026년·10월 기본값, 연도 2019~2026, 카드 `총 1장`. Esc로 닫으면 body overflow가 hidden→visible로 돌아옴. 전량 인쇄는 코드로 확인(`printSequence`). 확정 부과 세대 3개 사전조건은 없어 부과내역서 `-` 표시는 미확인. 인쇄 @page 여백이 11mm로 정책의 여백 0과 다름(`TenantOutputModal.tsx:37`) | `TenantOutputModal.tsx:37`의 `@page { margin: 11mm }`를 정책대로 `margin: 0`으로 바꾸거나 정책을 갱신 | [img](captures/OM2-010_modal_no_building.png) |
| OM2-011 | 건물 코드 순차 자동 채번(최댓값+1) | 계산 | P1 | **△** | - | 조직에 이미 코드 999(롯데타워)가 있어 "최댓값+1" 모드를 실측할 수 없음. 코드를 130으로 바꿔 저장하는 것은 됨(TC2A-삭제빌딩). 다음 기본값은 빈 번호 모드에 따라 006. `next_building_code()`(0308)의 `max+1` 로직은 코드로 확인 | - | |
| OM2-012 | 999 이후 빈 번호 채번 | 경계값 | P2 | **O** | - | 최댓값이 999이고 001~004를 타 그룹이 사용 중이라 기본값 005. 그대로 저장한 뒤 재진입하니 006(빈 번호 중 최소). 000은 쓰지 않고 001부터 채번함 | - | [img](captures/OM2-012_saved_default.png) |
| OM2-013 | 건물 코드 숫자 3자리 형식 검증 | 검증 | P1 | **X** | 보통 | `1234` 입력 시 `123`, `1A2` 입력 시 `12`로 바뀜(입력 단계에서 걸러져 저장 시도 불가). `12`로 저장하면 토스트 "건물 코드를 숫자 3자리로 입력해 주세요."만 뜨고 필드 근처 오류 표시와 aria-invalid가 없으며 포커스도 버튼에 그대로 있음. 입력값은 유지됨. 유효 코드(005, 130) 저장은 됨 | `BuildingRegisterForm.tsx:126-128`에서 형식 오류를 `codeError`처럼 필드 오류 state로 넘기고(`BasicInfoSection` TextField `error`), 코드 입력에 focus/scrollIntoView | [img](captures/OM2-013_code12_toast.png) |
| OM2-014 | 삭제된 건물 코드 포함 중복 차단 | 검증 | P1 | **△** | - | 활성 코드 103, 삭제된 코드 101 모두 필드 아래 "이미 사용 중인 건물 코드예요…" 표시와 저장 차단 토스트가 뜨고 입력값 유지. DB 유니크 인덱스 `buildings_org_id_code_key (org_id, code)`로 삭제 건 포함 조직 내 중복 불가 확인. 다른 조직 코드 저장(3단계)은 단일 조직 계정이라 수행 불가 | - | [img](captures/OM2-014_dup_deleted_code.png) |
| OM2-015 | 섹션·아코디언 접기 시 입력 유지와 이탈 확인 | 상태전이 | P2 | **O** | - | 전기 고객번호 카드 2개(E-111/E-222)가 아코디언과 `5. 부가 정보` 섹션 토글 후에도 유지됨. 건물주명도 유지. 섹션 6개(기본 정보~건물 메모), 섹션·아코디언 버튼 aria-expanded 반영. 뒤로가기 시 "저장하지 않고 나가시겠습니까?" → 나가기 후 목록 이동 | - | [img](captures/OM2-015_leave_confirm.png) |
| OM2-016 | 적립금·공과금 선택지와 공동전기 축소형 | 검증 | P3 | **O** | - | 적립금 유형: 적립금/장기수선충당금/기타/없음. 수도 고지기간: 당월/전월/전전월, 계산법: 기본/인원/시조례/시+톤당/시+인원/기타. 공용전기 카드는 계산·계산법·고지기간 출력이 없음(select 4개, 전기는 7개). 계약서 사진 10장 제한은 같은 공용 `PhotoUpload`(VendorCard `max=10`)로, OM2-049에서 11번째 거부를 실측함 | - | |
| OM2-017 | 건물 상시 공지문의 세입자 앱 홈 노출·해제 | 정합성 | P1 | **X** | 높음 | 상세에서 "분리수거는 화·금요일입니다" 저장, 토스트 "저장되었습니다." 확인. DB `buildings.basic_extra.standingNotice`에 저장되고 RPC `resident_building_notice()`도 연결 건물만 반환하도록 구현돼 있음. 그런데 세입자 홈(`ResidentHomeWorkspace.tsx`)이 `useResidentBuildingNotice`를 한 번도 호출하지 않아(저장소 전체에서 사용처 0) 공지가 홈에 노출되지 않음. 세입자 계정이 없어 앱 실측은 못 함 | `ResidentHomeWorkspace.tsx:92` 부근에서 `useResidentBuildingNotice()`(`hooks/reactquery/residentNotices/queries.ts:35`)를 호출해 값이 있으면 홈 건물 공지 카드로 렌더, null이면 숨김 | [img](captures/OM2-017_standing_notice_saved.png) |
| OM2-018 | 상세 수정 저장 후 건물 목록 컬럼 반영 | 정합성 | P2 | **O** | - | 유형(빌딩)·공동현관(#2222)·건물주명·주 전화번호를 한 번에 수정. `save_building` RPC 1회 호출, 토스트 표시. `목록으로` 클릭 시 이탈 확인 없이 이동. 행: `005 / TC2A-테스트빌딩 / 빌딩 / … / TC2A건물주 / 010-7777-8888 / #2222` | - | [img](captures/OM2-018_list_row.png) |
| OM2-019 | 고객번호 카드 삭제 저장 시 soft delete와 조회 화면 반영 | 정합성 | P1 | **O** | - | W2 삭제 시 확인창 없이 즉시 제거됨. 남은 W1 카드에는 삭제 버튼 없음(0개). `목록으로` → 이탈 확인 → 취소 → 저장. 고객번호 조회에는 TC2A-W1만 남음. DB id 63(W2)은 `deleted_at=2026-10-14 08:03` soft delete | - | [img](captures/OM2-034_water_row.png) |
| OM2-020 | 건물 삭제 후 목록·고객번호 조회 제외 | 정합성 | P2 | **O** | - | TC2A-삭제빌딩(130) `건물 삭제` → 확인 모달 "정말 이 건물을 삭제하시겠습니까?" → 토스트 "건물을 삭제했어요", 목록 이동. 목록 검색 0곳, 고객번호 조회에서 TC2A-DEL-W1 사라짐 | - | [img](captures/OM2-020_customer_numbers_after_delete.png) |
| OM2-021 | 할인 유형에 따른 할인 금액 활성화 | 검증 | P2 | **O** | - | 기본 `일반`, 할인 금액 readonly·공란. 선택지 일반/수급자할인/다자녀할인/기타할인. 수급자할인에서 5000 입력됨. 일반으로 바꾸면 readonly·공란(저장 시 null) | - | |
| OM2-022 | 신규 등록 폼 기본값 | 정상 | P3 | **X** | 보통 | 문자·알림톡 동의, 부과금 Y, 이체 지로, 이름 미출력, 알림톡 고지서, 임대구분 월세, 물건구분 원룸, 거래형태 직거래, 구분 월세, 텍스트 공란, 전출정보 "전출자 이력이 없습니다."는 정상. 그러나 **연체료 부과 여부=O(Y)**, **단수 출력 여부=O(Y)**, **고지서 출력 여부=N**으로 정책(N/N/Y)과 다름. DB 저장값도 late_fee_enabled=true, single_print=true, print_enabled=false | `TenantForm.tsx:76-77`을 `lateFeeEnabled: false, singlePrint: false`로, `:91`을 `printEnabled: true`로 변경. 신규에서 알림톡 동의 시 출력 N으로 바꾸는 `:320`도 정책(고지서 출력 Y)과 맞추기 | |
| OM2-023 | 당월 미확정 건물 등록 시 부과 모달 미노출과 목록 반영 | 상태전이 | P1 | **O** | - | 미확정 TC2A 건물에 101 등록. 모달 없이 "저장되었습니다." 후 `/staff/buildings?building=33`로 이동, 세대 표에 101 추가, 인원 배지 1명 | - | [img](captures/OM2-023_unit_registered.png) |
| OM2-024 | 전화번호·차량번호 복수 입력 매핑 | 정합성 | P2 | **O** | - | 전화 4개, 차량 2개 저장 후 DB phone=010-1111-0001, phone2=010-1111-0002, phone3=02-111-0003, phones_extra=[010-1111-0004], vehicle_no=12가3456, vehicles_extra=[34나5678]. 상세에서 4개·2개 모두 표시 | - | [img](captures/OM2-024_phones_detail.png) |
| OM2-025 | 공과금 고객번호 드롭다운 후보 연동 | 정합성 | P2 | **O** | - | 수도 후보 [TC2A-W1, TC2A-W2], 공용 전기 [TC2A-C1], 가스·전기 후보 없음(다른 건물 값 미노출). 한전고객번호·한전계기번호는 텍스트 input | - | [img](captures/OM2-025_customer_options.png) |
| OM2-026 | 반복 퇴실 시 전출정보 이사일 내림차순 누적 | 정합성 | P2 | **△** | 낮음 | 101호 즉시 퇴실 2회(TC2A입주자1 → 재입주 TC2A입주자3)로 전출정보 2행 누적, 이름·집전화·주·부·입주일 표시. 표에 입력 칸 없음(읽기 전용). 과거 이력(2025-03-31)은 만들 수 없어 날짜 간 정렬은 미확인. 같은 날짜 2건은 먼저 퇴실한 입주자1이 위에 표시됨. `list_occupancy_history`가 `order by move_out_date desc`만 써서 동일 일자의 순서가 정해지지 않음 | `list_occupancy_history`(및 상세 조회 RPC)의 정렬을 `order by h.move_out_date desc, h.id desc`로 바꿔 최신 퇴실이 위에 오게 함 | [img](captures/OM2-026_history_two_rows.png) |
| OM2-027 | 즉시 퇴실 후 목록 공실 표시와 고객번호 유지 | 정합성 | P1 | **O** | - | 즉시 퇴실 후 "퇴실 완료" 안내. 목록 101 → `공실`. 상세: 호실 101, 수도 고객번호 TC2A-W1, 계량기 TC2A-M1-NEW 유지, 입주자명·입금자명·전화 공란. DB unit_meters 행 유지 | - | [img](captures/OM2-027_after_moveout_detail.png) |
| OM2-028 | 예약 퇴실일 도래 후 만기 처리 | 상태전이 | P1 | **O** | - | 과거 날짜(13일)는 달력에서 disabled라 "어제 예약"은 만들 수 없음. 그래서 오늘(14일)로 예약해 도래 조건(<=오늘)으로 대신 검증. "퇴실 예약 완료" 후 목록 진입(`execute_due_move_outs`) 시 102 → 공실. 상세에서 예약 카드 사라지고 전출정보에 TC2A입주자2 2026-10-14 누적. moving_settlements 0건(자동 생성 없음) | - | [img](captures/OM2-028_after_due.png) |
| OM2-029 | 호수 삭제(이력 유무별) | 예외 | P2 | **△** | - | 이력 없는 103: 확인 모달 "정말 이 호수를 삭제하시겠습니까?" → "삭제되었습니다." → `/staff/buildings?building=33` 이동, 표에서 사라짐(units.deleted_at soft delete). 이력 있는 세대 M은 테스트 건물에 부과·수납 이력을 만들 수 없어 미실행. 코드상 `deleteImpactWarning`이 경고 문구만 붙이고 차단하지 않으며 soft delete라 과거 데이터는 보존됨 | - | |
| OM2-030 | 기존 세대 수정 저장 시 이번달 부과 모달 | 상태전이 | P2 | **X** | 높음 | 저장 시 "이번달 부과?" 모달이 구현돼 있지 않음. 저장소 전체에서 "이번달 관리비 부과"·"다음달부터" 문자열 0건. `TenantForm.onSave`가 확정 여부를 확인하지 않고 바로 `save.mutateAsync` 호출(`TenantForm.tsx:485`). 실제 확정 건물 세대에서는 실측하지 않음(실데이터 보호). 미확정 건물 저장 시 모달 없이 저장됨 | 저장 전에 해당 건물·당월 `billing_confirmations` 존재 여부를 조회하고, 확정이면 [다음달부터]/[이번 달 부과] 모달을 띄우기. 이번 달 선택 시 입주일 기준 일할 부과 RPC 호출, 다음달 선택 시 "다음달부터 부과됩니다" 토스트 | |
| OM2-031 | 화면 미노출 기존 값 보존 | 정합성 | P2 | **△** | - | 상세에 층·용도·계약 만료 알림 미노출 확인. 입금자명만 수정해 "저장되었습니다." 확인. 저장 후 floor=null, usage_type=residential, expiry_alert=false 그대로이고 입금자명만 변경. 층 3/상가 같은 사전값은 UI로 만들 수 없어 기본값으로만 확인. 코드상 `full.unit.floor/usageType`, `lease.expiryAlert` carry 처리 | - | |
| OM2-032 | utilities 권한 미보유 일반 staff 차단 | 권한 | P1 | **O** | - | U(tc2a_office3, 건물 권한만): LNB에 공과금 관리 없음. `/staff/customer-numbers` → "고객번호 조회 권한이 없습니다". `/api/customer-numbers/export?kind=water` → 403 {"error":"권한이 없습니다."}. V(tc2a_office2, 공과금 권한): 공과금 아코디언 펼침, 고객번호 조회만 aria-current, 목록 11건, export 200 | - | [img](captures/OM2-032_U_customer_numbers.png) |
| OM2-033 | 통합검색 대상·지연 조회·결과 없음 | 정상 | P2 | **△** | 낮음 | 입력 후 314~326ms 뒤 서버 조회 1회. 기타적요 "교체 예정" → 1건, 건물명 "TC2A" → 2건, `조회 결과 N건` 표시. 결과가 12건이라 2페이지에서 1페이지로 돌아가는 동작은 미확인. 결과 없음 문구가 "검색 결과가 없어요 / 고객번호나 건물명으로 다시 검색해 주세요"로 정책 "검색 결과가 없습니다"와 다름 | `CustomerNumberLookupContent.tsx:35` 문구를 정책 문구로 맞추거나 정책 갱신 | |
| OM2-034 | 건물 상세 저장값(LIN·계산·기타적요)의 조회 반영 | 정합성 | P1 | **O** | - | W1 LIN을 비우고 계산 수동, 기타적요 "계량기 교체 예정"으로 저장. 조회 행 `- / TC2A-W1 / 28(저장 당시 29) / 당월 / 수동 / 계량기 교체 예정`, 일금일 없는 행은 `-`. 공용전기 C1 계산 `자동`, DB calculation_method=auto | - | [img](captures/OM2-034_water_row.png) |
| OM2-035 | 일금일 1~28 입력 경계 | 경계값 | P2 | **X** | 보통 | 건물 상세 수도 카드 `검침일`(=일금일) 선택지가 1일~31일. 29일 선택 후 저장 시 "저장되었습니다."이고 DB meter_day=29, 고객번호 조회 일금일에도 29가 표시됨. RPC `save_building`과 DB 제약(1~31)에도 1~28 검사가 없음. 28 재저장 후 조회에 28 표시. 추가로 손대지 않은 카드는 화면에 "15일"을 기본으로 보여 주지만 저장값은 null | `config/utilities.ts:10` METER_DAY를 1~28로 제한. `save_building`에 `meter_day between 1 and 28` 검사 추가(기존 값 호환 필요 시 신규 입력에만). 표시 기본값(15일)과 저장값이 다르지 않게 `formState.ts:276`에서 defaultValue 반영 | [img](captures/OM2-035_meterday29_saved.png) |
| OM2-036 | 세대 계량기 고객번호 미혼합 | 정합성 | P2 | **O** | - | 입주자 상세에서 수도 계량기 번호를 TC2A-M1-NEW로 저장한 뒤에도 수도 조회 건수 변동 없음(12건, 이후 TC2A-삭제빌딩 삭제로 11건). 엑셀 Sheet1도 헤더 제외 12행으로 화면과 일치 | - | |
| OM2-037 | 사무실 관리자 비밀번호 숫자 4자리 강제 | 경계값 | P1 | **O** | - | `123` → "비밀번호는 숫자 4자리로 입력해 주세요.". `12345`는 maxLength 4라 `1234`로 잘려 입력됨. `ab12` → 같은 오류. `1234` → "저장되었습니다", 목록 컬럼 이름/아이디/연락처/유형/상태, 비밀번호 미표시 | - | [img](captures/OM2-037_pw_123_error.png) |
| OM2-038 | 현장 관리자 비밀번호 6자 이상과 탭별 필드 차이 | 경계값 | P1 | **O** | - | 현장 탭 등록 모달에 회원 유형·페이지별 권한 없음. `ab123` → "비밀번호는 6자 이상 입력해 주세요.", `ab1234` → 저장됨(tc2a_field1) | - | |
| OM2-039 | 수정 모달 비밀번호 칸 공란 유지·재설정 | 상태전이 | P1 | **O** | - | 수정 모달 비밀번호 칸 공란, `삭제` 버튼 노출. 연락처만 변경해 저장 후 B가 기존 비번(5678)으로 로그인하면 바로 `/staff/receipts`. 마스터가 4321로 재설정("변경되었습니다") 후 B 로그인 시 `/staff/change-password` | - | [img](captures/OM2-039_reset_forces_change.png) |
| OM2-040 | 최초 로그인·본인 변경 시 사무실 관리자 4자리 규칙 | 검증 | P1 | **O** | - | 변경 화면 `abcdef` → "비밀번호는 숫자 4자리로 입력해 주세요.". `5678/5679` → "새 비밀번호가 일치하지 않습니다."(버튼 disabled). 임시와 같은 `1234`도 거부. `5678` → 업무 화면 진입. 기존 장문 비밀번호 사무실 관리자 계정(admin)은 그대로 로그인됨. 프로필 메뉴 비밀번호 변경 모달은 4자 초과 입력을 막고(`abcd`) 숫자 4자리 오류 | - | [img](captures/OM2-040_profile_modal_abcdef.png) |
| OM2-041 | 입주자 탭 매핑실패 수동 연결 | 상태전이 | P1 | **△** | 낮음 | 매핑실패 필터 → 1행, 컬럼 8개(건물명~연결일) 정책과 일치. 행 클릭 시 세대 연결 모달 열림. 연결됨 행 클릭 시 모달 없음. 매핑실패 계정이 실사용자 데이터라 연결 확인(4·5단계)은 미실행. 모달 세대 후보가 "그린빌라 101호호"처럼 '호'가 중복 표시됨(`ResidentClaimsPanel.tsx:115`) | `ResidentClaimsPanel.tsx:115,188,388`의 `{unitNo}호`를 `displayUnitNo(unitNo)`(lib/bill/document)로 바꿔 '호' 중복 제거 | [img](captures/OM2-041_link_modal.png) |
| OM2-042 | 권한 칩 묶음 단위 부여와 감사 로그 기록 | 권한 | P2 | **X** | 보통 | G(tc2a_office2)에 공과금·이사정산 칩만 켜고 등록. G LNB에 공과금(고객번호·전기·수도·가스)과 이사정산(입력·전체/전기/수도/가스 조회)이 묶음으로 노출되고 `/staff/buildings`는 "접근할 권한이 없습니다". 그런데 부여하지 않은 **수납관리·민원접수**도 노출됨. 등록 모달에서는 칩이 꺼져 있었지만 DB 트리거(0267)가 INSERT 때 payment/complaints를 몰래 부여함(DB feature_permissions=[utilities,moving,payment,complaints]). 수정 저장 시 PERMISSION_CHANGE는 audit_log에 기록되고 HQ 감사 로그에 표시됨. 단, 권한 변화가 없는 저장(연락처만 변경)도 매번 "권한 변경"으로 기록됨 | 등록 모달 기본 `permissions`(`AccountFormModal.tsx:115`)에 payment·complaints를 미리 켜서 마스터에게 보이게 하거나, 트리거(0267)를 제거하고 화면 값만 저장. 수정 저장은 권한 diff가 있을 때만 `admin_set_member_permissions` 호출(`AccountFormModal.tsx:202-208`) | [img](captures/OM2-042_G_lnb.png) |
| OM2-043 | 기본 납부일 짧은 달 말일 보정 | 계산 | P1 | **△** | - | 셋업 기본 납부일은 조직 전체 설정이라 병렬 테스터 영향 때문에 저장하지 않음(현재 "설정 안 함"). `billing_default_due_date` 식에 익월·31일·2027-01 값을 넣은 SELECT 결과 2027-02-28 → 말일 보정 로직 확인. UI 선택지는 1~28일·말일(31) | - | |
| OM2-044 | 납부기한 우선순위 적용 | 정합성 | P1 | **△** | - | 전역 설정 변경 불가로 코드/DB만 확인. 배포 DB `billing_effective_due_date` = coalesce(발행 고지서 bill_issues.due_date → 건물·월 billing_period_settings.due_date → 기본 납부일 → 말일)로 정책 우선순위와 일치. 미설정 시 그 달 말일 확인(2026-11 → 11-30) | - | |
| OM2-045 | 관리비 입금 계좌 2개·인쇄 계좌 단일 선택·안내사항 250자 | 경계값 | P2 | **△** | - | 계좌는 2행 고정 슬롯이고 추가 버튼이 없어 최대 2개. 인쇄 라디오는 두 번째 선택 시 [false,true]로 단일 선택. 고객 안내사항 maxlength 250, 251자째 입력 차단. 전역 설정이라 저장과 고지서 미리보기(4단계)는 미실행(변경값 미저장으로 이탈) | - | |
| OM2-046 | 연체 설정 on/off와 세대 연체료 부과 여부 | 계산 | P2 | **△** | 낮음 | 전역 설정이라 저장하지 않음. 토글 off 상태에서도 1~12개월차 요율 input이 활성화(disabled=false) 상태로 남아 정책/TC와 다름. 계산은 코드로 확인: 0295 함수가 조직 토글·세대 late_fee_enabled가 모두 on일 때만 원금×Σ월요율(단리)을 적용하므로 100,000×2%=2,000, 세대 X는 0 | `LateFeeSettingsCard.tsx:50` Input에 `disabled={!enabled}` 적용 | [img](captures/OM2-046_latefee_off_inputs_enabled.png) |
| OM2-047 | 데이터 이관 오류 사전검증·완료 상태·초기화 | 상태전이 | P2 | **X** | 낮음 | 그룹 2·3 행에 "선행: …" 표기 확인. 건물 CSV(중복 코드 2행, 건물명 누락 1행) 업로드 시 바로 사전검증되어 `정상 1·오류 2`, "중복 (건물 코드)", "건물명 없음" 표시. 수정 CSV 재업로드 → 1건 등록. 행 상태는 "완료"가 아니라 "1건 · 2026.10.14"로 표시됨. 사전검증 단계에는 **오류 내역 다운로드 버튼이 없음**(등록 후 3단계에서 ng>0일 때만). 진행 기록 초기화 확인 모달 후 "미실행" 복귀 | `BulkImportModal.tsx:219-224` step 2에서 오류가 있으면 `오류 내역 다운로드` 버튼 노출. `DataMigrationTab.tsx:86` 상태 표시를 "완료" 배지(+건수·일자 보조)로 | [img](captures/OM2-047_precheck_errors.png) |
| OM2-048 | 업체가 연결된 사용자 추가 구분 삭제 불가 | 예외 | P1 | **O** | - | TC2A-방역 업체(업체 1) 삭제 시 "…등록된 업체가 1곳 있어 삭제할 수 없습니다…" 토스트로 차단. 업체 삭제 확인 모달 후 구분 삭제 확인 → 삭제됨. TC2A-조경 업체 이름 인라인 편집(→업체2)과 삭제 가능. 기본 구분에는 삭제 버튼 없음 | - | [img](captures/OM2-048_delete_blocked.png) |
| OM2-049 | 계약서 사진 10장 경계와 개별 삭제 | 경계값 | P2 | **O** | - | 소방검사업체 TC2A-소방에 10장 업로드 → 미리보기 10. 11번째 → "이미지는 최대 10장까지 첨부할 수 있습니다." 후 10장 유지. 3번째(p3.png) 삭제 → 9, 1장 추가 → 10. 저장(버튼 문구는 "추가") 후 "업체를 등록했어요", 재오픈 시 10장 | - | [img](captures/OM2-049_reopen_ten.png) |
| OM2-050 | 업체 등록 후 구분별 건수·검색 반영 | 정합성 | P3 | **X** | 낮음 | CCTV 업체에 TC2A-CCTV 등록 → CCTV 0→1, 전체 증가(7→9, 방역 업체 1건 함께). 담당자 `김방역` 검색 → TC2A-방역 1곳, 컬럼 구분/업체명/연락처. 없는 업체명 검색 시 "검색 결과가 없습니다"가 아니라 "등록된 업체가 없어요 · 업체 추가를 눌러 등록하세요" 표시 | `components/vendors/VendorList.tsx:60`에서 검색어가 있으면 "검색 결과가 없습니다", 없으면 빈 상태 문구로 분기 | [img](captures/OM2-050_search_none.png) |

## 결함 상세

#### OM2-017 건물 상시 공지문이 세입자 앱 홈에 노출되지 않음 — X · 중요도: 높음
- **현상**: 건물 상세에서 상시 공지문을 저장하면 DB(`buildings.basic_extra.standingNotice`)에 저장되지만 세입자 앱 홈 화면은 이 값을 조회하지 않는다. `useResidentBuildingNotice` 훅이 정의만 돼 있고 사용처가 0개다.
- **기대(정책)**: 상시 공지문은 입주민 홈에 상시 노출하고, 비우면 미표시한다(`policy/03_사무실 관리자/사무실 관리자_건물 등록.md` 3.3, `사무실 관리자_건물 상세.md` 5. 데이터 & 연동).
- **원인**: `app/(resident)/resident/(app)/home/ResidentHomeWorkspace.tsx`(약 92행)에서 건물 공지를 조회·렌더하지 않는다. RPC `resident_building_notice()`와 훅(`hooks/reactquery/residentNotices/queries.ts:35`)은 이미 있다.
- **개선 방안**: 홈 워크스페이스에서 `useResidentBuildingNotice()`를 호출하고 값이 있으면 건물 공지 카드를 렌더, null이면 숨긴다. 건물 상세 저장 후 세입자 쪽 캐시가 갱신되도록 staleTime도 짧게 둔다.

#### OM2-030 기존 세대 저장 시 "이번달 부과?" 모달 미구현 — X · 중요도: 높음
- **현상**: 당월 부과가 확정된 건물의 세대를 저장해도 모달 없이 바로 저장된다. 저장소에 모달 문구가 없다.
- **기대(정책)**: 확정 건물이면 "이번달 관리비 부과를 하시겠습니까? / {연}년 {월}월분 부과가 이미 확정된 건물입니다…" 모달과 [다음달부터]/[이번 달 부과] 선택을 띄운다(`policy/03_사무실 관리자/사무실 관리자_입주자 상세.md` 3.9, `사무실 관리자_입주민 등록.md` 3.9).
- **원인**: `app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx:485` `onSave`가 확정 여부를 확인하지 않고 `save.mutateAsync(payload)`를 바로 호출한다.
- **개선 방안**: 저장 직전에 건물·당월 `billing_confirmations`(또는 확정 상태 RPC)를 조회한다. 확정이면 ConfirmDialog를 띄우고, "이번 달 부과"면 입주일 기준 일할 부과 RPC를 저장과 함께 실행한다. "다음달부터"면 저장 후 "다음달부터 부과됩니다" 토스트를 띄운다.

#### OM2-008 입주민 행 Enter/Space/클릭 시 관리카드 모달 대신 상세 페이지로 이동 — X · 중요도: 보통
- **현상**: 건물·입주자 관리 하단 세대 행에서 Enter를 누르면 `/staff/buildings/33/tenants/73` 페이지로 이동한다. 모달은 열리지 않아 Esc 미저장 확인도 없다.
- **기대(정책)**: 행 클릭·Enter·Space 시 해당 `buildingId`·`unitId`의 입주민 관리카드 모달을 열고, 닫기·배경·Esc 시 미저장 변경을 확인한다(`policy/03_사무실 관리자/사무실 관리자_건물·입주자 관리.md` 3.3, 6. 결정됨 [2026-08-31]).
- **원인**: `app/(staff)/staff/(app)/buildings/components/TenantOccupancyCard.tsx:150,154`가 `router.push`로 페이지를 이동한다.
- **개선 방안**: `TenantForm`을 모달 컨테이너에서 재사용하도록 바꾸고 행 이벤트에서 모달 open state를 설정한다. 닫을 때 `dirty`면 확인한다.

#### OM2-009 입주자카드 엑셀 반출 기록이 HQ 감사 로그에 보이지 않음 — X · 중요도: 보통
- **현상**: 반출은 `access_log`(EXPORT_XLSX)에 기록되지만 HQ `/platform-admin/audit-logs`는 `audit_log`만 조회한다. audit_log의 EXPORT_* 행은 0건이다.
- **기대(정책)**: 반출 감사 로그가 통합관리자 감사 로그에서 조회돼야 한다(`policy/03_사무실 관리자/사무실 관리자_건물·입주자 관리.md` 3.3, `policy/01_공통 정책/서비스 전체 정책서 (4개 롤 통합).md` 8).
- **원인**: `lib/audit/accessLog.ts:67`은 `access_log`에 insert한다. `platform_list_audit_logs`(supabase/migrations/0277_platform_audit_logs.sql)는 access_log를 참조하지 않는다.
- **개선 방안**: `platform_list_audit_logs`에 access_log를 UNION해 분류 "반출/열람"으로 노출한다. 라벨 매핑은 `hooks/reactquery/platform/auditLogs.ts:71-72`에 이미 있다.

#### OM2-013 건물 코드 형식 오류가 필드에 표시되지 않음 — X · 중요도: 보통
- **현상**: `12` 저장 시 토스트만 뜨고 필드에 오류 표시·aria-invalid·포커스 이동이 없다.
- **기대(정책)**: 검증 실패 시 문제 필드 근처에 원인을 표시하고 첫 오류로 이동할 수 있어야 한다(`policy/03_사무실 관리자/사무실 관리자_건물 등록.md` 4.1).
- **원인**: `app/(staff)/staff/(app)/buildings/new-v2/_components/BuildingRegisterForm.tsx:126-128`이 `appToast.warning`만 호출하고, `codeError`는 중복일 때만 설정된다.
- **개선 방안**: 형식 오류용 state를 두고 `BasicInfoSection`의 건물 코드 `TextField error`로 전달한다. 코드 input에 `focus()`와 `scrollIntoView()`를 호출한다.

#### OM2-022 신규 등록 기본값 3개 불일치 — X · 중요도: 보통
- **현상**: 신규 등록 화면에서 연체료 부과 O, 단수 출력 O, 고지서 출력 N이 기본값이고 그대로 저장된다(DB late_fee_enabled=true, single_print=true, print_enabled=false).
- **기대(정책)**: 연체료 N, 단수 출력 N, 고지서 출력 Y(`policy/입주자 상세·등록 정책서 (UI중심).md` 3.3, 3.5, 4).
- **원인**: `TenantForm.tsx:76-77`(`lateFeeEnabled: true`, `singlePrint: true`), `:91`(`printEnabled: false`), `:320`(신규에서 알림톡 동의 시 출력 N으로 강제)
- **개선 방안**: 기본값을 정책대로 바꾸고 `:320`의 자동 전환은 제거하거나 정책과 맞춘다.

#### OM2-035 일금일 29~31 저장 허용 — X · 중요도: 보통
- **현상**: 수도 카드 검침일(조회 화면의 일금일)이 1~31일 선택 가능하고 29를 저장하면 DB와 조회 화면에 29가 표시된다. 손대지 않은 카드는 화면에 15일이 보이지만 저장값은 null이다.
- **기대(정책)**: 일금일은 신규 입력 시 1~28만 허용(`policy/03_사무실 관리자/사무실 관리자_고객번호 조회.md` 3.3, 6).
- **원인**: `app/(staff)/staff/(app)/buildings/new-v2/_components/config/utilities.ts:10` `METER_DAY` 31개. `save_building` RPC에 범위 검사가 없고 DB 제약도 `meter_day between 1 and 31`이다. `formState.ts:276`은 표시용 defaultValue를 저장하지 않는다.
- **개선 방안**: 선택지를 1~28로 제한하고 `save_building`에서 신규·변경 값의 1~28을 검증한다. 화면 기본값을 저장값과 일치시킨다(기본 미선택 또는 defaultValue 저장).

#### OM2-042 부여하지 않은 수납관리·민원접수 권한이 자동 부여됨 — X · 중요도: 보통
- **현상**: 마스터가 공과금·이사정산 칩만 켜고 등록해도 G에게 수납관리·민원접수가 노출된다. 등록 모달에서는 이 칩이 꺼져 보인다. 또 권한 변화가 없는 수정 저장도 매번 "권한 변경" 감사 로그를 남긴다.
- **기대(정책)**: 부여한 칩 묶음만 노출하고 미부여 메뉴는 숨긴다. 권한 변경은 감사 로그에 기록한다(`policy/03_사무실 관리자/사무실 관리자_계정·직원 관리.md` 3.3, 5; `policy/01_공통 정책/권한 매트릭스 (Permission Matrix).md` 2, 6).
- **원인**: `supabase/migrations/0267_*` 트리거 `trg_office_default_permissions`가 INSERT 시 payment/complaints를 추가한다. 화면 기본값은 `AccountFormModal.tsx:115` `permissions: []`이고, `:202-208`은 diff 없이 항상 `onUpdatePermissions`를 호출한다.
- **개선 방안**: 기본 부여를 유지하려면 등록 모달 기본 칩을 켜서 보여 주고, 아니면 트리거를 제거한다. 권한 저장은 변경이 있을 때만 호출한다.

#### OM2-010 출력 인쇄 여백이 정책(0)과 다름 — △ · 중요도: 낮음
- **현상**: 인쇄 CSS가 `@page { size: A4 portrait; margin: 11mm; }`이다.
- **기대(정책)**: A4·여백 0으로 전량 페이지 분할 출력(`policy/03_사무실 관리자/사무실 관리자_건물·입주자 관리.md` 3.4).
- **원인**: `app/(staff)/staff/(app)/buildings/components/TenantOutputModal.tsx:37`
- **개선 방안**: margin을 0으로 바꾸고 시트 내부 padding으로 여백을 처리한다. 의도된 차이라면 정책을 갱신한다.

#### OM2-026 같은 이사일 전출 이력의 정렬 순서가 정해지지 않음 — △ · 중요도: 낮음
- **현상**: 같은 날 두 번 퇴실하면 먼저 퇴실한 입주자가 위에 표시된다.
- **기대(정책)**: 이사일 내림차순으로 최신 퇴실이 위(`policy/입주자 상세·등록 정책서 (UI중심).md` 3.6).
- **원인**: DB 함수 `list_occupancy_history`가 `order by h.move_out_date desc`만 쓰고 보조 정렬이 없다.
- **개선 방안**: `order by h.move_out_date desc, h.id desc`(상세 조회 RPC의 history 정렬도 동일하게)

#### OM2-033 고객번호 조회 결과 없음 문구 차이 — △ · 중요도: 낮음
- **현상**: "검색 결과가 없어요 / 고객번호나 건물명으로 다시 검색해 주세요"
- **기대(정책)**: "검색 결과가 없습니다"(`policy/03_사무실 관리자/사무실 관리자_고객번호 조회.md` 4)
- **원인**: `app/(staff)/staff/(app)/customer-numbers/components/CustomerNumberLookupContent.tsx:35`
- **개선 방안**: 문구를 정책과 통일하거나 정책을 해요체로 갱신한다.

#### OM2-041 세대 연결 모달 호실 표기 '호' 중복 — △ · 중요도: 낮음
- **현상**: 후보가 "그린빌라 101호호"로 표시된다.
- **기대(정책)**: 올바른 건물명·호실로 검색·선택(`policy/03_사무실 관리자/사무실 관리자_계정·직원 관리.md` 3.4)
- **원인**: `app/(staff)/staff/(app)/accounts/components/ResidentClaimsPanel.tsx:115`(그리고 `:188`, `:388`)에서 unitNo 뒤에 '호'를 무조건 붙인다.
- **개선 방안**: `displayUnitNo()`(lib/bill/document)를 사용한다.

#### OM2-046 연체 설정 off에서도 요율 입력 활성 — △ · 중요도: 낮음
- **현상**: 토글 off 후에도 1~12개월차 요율 input이 활성화돼 있다.
- **기대(정책)**: on일 때만 요율 입력(`policy/03_사무실 관리자/사무실 관리자_셋업 설정.md` 3.2 관리비 연체 설정)
- **원인**: `app/(staff)/staff/(app)/setup/components/billing/LateFeeSettingsCard.tsx:50` Input에 disabled 처리가 없다.
- **개선 방안**: `disabled={!enabled}`를 추가하고 off 시 시각적으로 흐리게 표시한다.

#### OM2-047 데이터 이관 사전검증 단계에서 오류 내역 다운로드 불가·상태 라벨 차이 — X · 중요도: 낮음
- **현상**: 업로드 직후 사전검증에서 오류 2건이 보여도 `오류 내역 다운로드` 버튼이 없다(등록 후 결과 화면에서만 나옴). 완료 후 행 상태가 "완료"가 아니라 "1건 · 2026.10.14"로 나온다.
- **기대(정책)**: 사전검증 → (오류 시) 오류 내역 다운로드로 확인·수정 → 등록. 상태 뱃지는 미실행/완료(`policy/03_사무실 관리자/사무실 관리자_셋업 설정.md` 3.6)
- **원인**: `app/(staff)/staff/(app)/setup/components/BulkImportModal.tsx:219-224`(step 2 버튼 구성), `DataMigrationTab.tsx:86`
- **개선 방안**: step 2에서 `ng > 0`이면 `downloadErrors` 버튼을 노출한다. 상태는 "완료" 배지와 건수·일자 보조 텍스트로 표시한다.

#### OM2-050 협력업체 검색 0건 문구가 빈 상태 문구로 표시 — X · 중요도: 낮음
- **현상**: 없는 업체명 검색 시 "등록된 업체가 없어요 · 업체 추가를 눌러 등록하세요"가 표시된다.
- **기대(정책)**: 검색 0건은 "검색 결과가 없습니다"(`policy/03_사무실 관리자/사무실 관리자_협력업체 관리.md` 4)
- **원인**: `components/vendors/VendorList.tsx:60` 검색 여부와 무관하게 같은 문구를 쓴다.
- **개선 방안**: 검색어 유무로 결과 없음과 빈 상태 문구를 분기한다.
