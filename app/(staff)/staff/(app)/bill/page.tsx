import { ModuleGate } from "@/components/common";
import { BillWorkspace } from "./components/BillWorkspace";
import { DocumentCards } from "./components/DocumentCards";

/**
 * 진입 화면은 정적 마크업(DocumentCards)뿐이라 서버 I/O 없이 즉시 렌더한다.
 * 여기서 컨텍스트를 await하면 그 왕복 동안 로더가 떠서 의도적으로 두지 않는다.
 *
 * 권한 표시는 ModuleGate가 셸이 이미 받아둔 컨텍스트 캐시로 논블로킹 처리하고,
 * 실제 차단은 서버가 유지한다 — 상위 레이아웃 requirePersona가 비직원을 막고,
 * /api/bill/page-data가 hasModule로 403을 반환한다.
 */
export default function BillPage() {
  return (
    <ModuleGate module="bill_publish" message="서류 발행·출력 권한이 없습니다.">
      <BillWorkspace>
        <div className="min-h-[calc(100vh-62px)] bg-[#f2f4f6] px-[24px] pt-[22px] print:hidden">
          <h1 className="sr-only">서류 발행·출력</h1>
          <DocumentCards />
        </div>
      </BillWorkspace>
    </ModuleGate>
  );
}
