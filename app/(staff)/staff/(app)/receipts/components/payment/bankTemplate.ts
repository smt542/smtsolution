import { appToast } from "@/hooks/common/useAppToast";

/**
 * 은행 입금내역 업로드 양식(.xlsx) 다운로드 — 정본 `downBankForm()`의 `은행_입금내역_업로드양식.xlsx`.
 * 파일은 `public/templates/bank-deposit-upload-form.xlsx`를 그대로 내려 준다(시트 `입금내역`,
 * 순번·고객번호·거래일시·출금금액·입금금액·거래후잔액·거래내용·거래기록사항·거래점·거래메모 + 예시 2줄).
 * 업로드 쪽 열 자동 인식(`lib/payments/bankParse`의 `guessColumns`)이 이 머리글을 읽는다.
 */
const BANK_TEMPLATE_URL = "/templates/bank-deposit-upload-form.xlsx";
const BANK_TEMPLATE_FILE_NAME = "은행_입금내역_업로드양식.xlsx";

export function downloadBankTemplate(): void {
  const anchor = document.createElement("a");
  anchor.href = BANK_TEMPLATE_URL;
  anchor.download = BANK_TEMPLATE_FILE_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  appToast.success("은행 입금내역 양식을 내려받았어요");
}
