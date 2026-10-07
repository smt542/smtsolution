import Link from "next/link";

import ResidentScreenFrame from "@/app/(resident)/_components/ResidentScreenFrame";

import { legalClasses } from "../legalClasses";

// NOTE: 「관리비서」 세입자 서비스 개인정보 처리방침 — 클로드 디자인 원본
// (staging resident-privacy.dc.html) 구성을 그대로 따른다(리드+시행일 최상단, 표·번호목록·부칙).
// 개인정보처리자(회사) = 에스엠티솔루션㈜(원본의 스마일종합관리 치환, 대표 최서윤),
// 보호책임자 = 안정현(010-8227-6496), 시행일 2026-09-07.
// 수집항목 표는 실제 수집분만 반영 — 카카오 스코프의 프로필 이미지는 선택 수집(정책서 세입자_개인정보 처리방침 3.1),
// 스코프에 없는 이메일과 기기 정보·앱 버전 자동수집은 미수집이라 제외(처리방침 허위 기재 방지).

export default function ResidentPrivacyPage() {
  return (
    <ResidentScreenFrame
      variant="legal"
      header={
        <>
          <Link href="/resident/me" aria-label="내 정보로 돌아가기">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1>개인정보 처리방침</h1>
        </>
      }
    >
      <div className={legalClasses.lead}>
        에스엠티솔루션㈜(이하 <b>회사</b>)는 <b>관리비서</b> 서비스를 제공하며
        이용자의 개인정보를 「개인정보 보호법」 등 관련 법령에 따라 안전하게
        처리합니다.
        <br />시행일 2026년 9월 7일
      </div>

      <h2>1. 수집하는 개인정보 항목</h2>
      <div className={legalClasses.table}>
        <div className={`${legalClasses.row} ${legalClasses.headerRow}`}>
          <div>구분</div>
          <div>항목</div>
        </div>
        <div className={legalClasses.row}>
          <div>필수</div>
          <div>카카오 계정 식별자, 이름, 휴대전화번호</div>
        </div>
        <div className={legalClasses.row}>
          <div>필수</div>
          <div>건물명·호실 등 세대 정보, 관리비 부과·납부 내역</div>
        </div>
        <div className={legalClasses.row}>
          <div>선택</div>
          <div>카카오 프로필 이미지</div>
        </div>
        <div className={legalClasses.row}>
          <div>자동수집</div>
          <div>접속 일시(로그인 이력)</div>
        </div>
      </div>
      <p>
        회사는 위 항목 외의 카카오 계정 정보(이메일 등)나 민감정보는 수집하지
        않습니다.
      </p>

      <h2>2. 개인정보의 수집·이용 목적</h2>
      <ol>
        <li>본인 확인 및 세대 정보 매칭, 회원 관리</li>
        <li>관리비·공과금 내역 제공 및 납부 안내</li>
        <li>퇴실 신청 접수와 처리 결과 안내</li>
        <li>공지사항 및 중요 안내 전달</li>
        <li>서비스 품질 개선, 오류 대응, 부정 이용 방지</li>
      </ol>

      <h2>3. 보유 및 이용 기간</h2>
      <ol>
        <li>
          회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한
          경우 해당 기간 동안 보관합니다.
        </li>
        <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
        <li>대금 결제 및 재화 공급에 관한 기록: 5년</li>
        <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년</li>
        <li>서비스 접속 기록: 3개월</li>
      </ol>

      <h2>4. 개인정보의 제3자 제공</h2>
      <p>
        회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만
        서비스 제공을 위해 아래와 같이 제공합니다.
      </p>
      <div className={legalClasses.table}>
        <div className={`${legalClasses.row} ${legalClasses.headerRow}`}>
          <div>제공받는 자</div>
          <div>목적 · 항목 · 기간</div>
        </div>
        <div className={legalClasses.row}>
          <div>
            관리주체<br />(관리사무소)
          </div>
          <div>
            관리비 부과·수납 확인 및 퇴실 처리 · 이름, 연락처, 세대 정보, 신청
            내용 · 위탁관리 계약 종료 시까지
          </div>
        </div>
      </div>

      <h2>5. 개인정보 처리의 위탁</h2>
      <div className={legalClasses.table}>
        <div className={`${legalClasses.row} ${legalClasses.headerRow}`}>
          <div>수탁자</div>
          <div>위탁 업무</div>
        </div>
        <div className={legalClasses.row}>
          <div>클라우드 사업자</div>
          <div>서비스 운영을 위한 데이터 보관 및 인프라 운영</div>
        </div>
        <div className={legalClasses.row}>
          <div>메시지 발송 사업자</div>
          <div>인증·안내 문자 및 카카오 알림톡·팩스 발송</div>
        </div>
      </div>

      <h2>6. 정보주체의 권리와 행사 방법</h2>
      <ol>
        <li>
          이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수
          있습니다.
        </li>
        <li>
          권리 행사는 앱 내 프로필 메뉴 또는 아래 연락처를 통해 요청할 수 있으며,
          회사는 지체 없이 조치합니다.
        </li>
        <li>법정대리인은 만 14세 미만 아동의 권리를 대리 행사할 수 있습니다.</li>
      </ol>

      <h2>7. 개인정보의 파기</h2>
      <p>
        보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
        전자적 파일은 복구할 수 없는 방법으로 삭제하고, 출력물은 파쇄하거나
        소각합니다.
      </p>

      <h2>8. 안전성 확보 조치</h2>
      <ol>
        <li>개인정보 취급 담당자 최소화 및 접근 권한 관리</li>
        <li>전송 구간 암호화와 저장 시 암호화 적용</li>
        <li>접속 기록 보관 및 위·변조 방지</li>
        <li>내부 관리계획 수립 및 정기 점검</li>
      </ol>

      <h2>9. 개인정보 보호책임자</h2>
      <div className={legalClasses.table}>
        <div className={legalClasses.row}>
          <div>보호책임자</div>
          <div>안정현</div>
        </div>
        <div className={legalClasses.row}>
          <div>문의</div>
          <div>010-8227-6496</div>
        </div>
      </div>
      <p>
        개인정보 침해에 대한 상담이 필요한 경우 개인정보분쟁조정위원회(1833-6972),
        개인정보침해신고센터(118)에 문의할 수 있습니다.
      </p>

      <h2>10. 처리방침의 변경</h2>
      <p>
        이 방침의 내용이 변경되는 경우 시행 7일 전부터 서비스 내 공지사항을 통해
        알립니다. 이용자에게 불리한 변경은 30일 전에 공지합니다.
      </p>

      <div className={legalClasses.tail}>
        시행일 2026년 9월 7일 · 이전 버전은 문의 시 제공됩니다.
      </div>
    </ResidentScreenFrame>
  );
}
