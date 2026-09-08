/**
 * 은행 입금내역 업로드용 빈 양식(.xlsx) 다운로드.
 * 열은 BankImportModal이 매핑하는 필드와 동일: 고객번호·입금자명·입금액·입금일.
 * (클라이언트에서 생성 — BankImportModal의 bankParse도 exceljs를 클라이언트에서 사용)
 */
export async function downloadBankTemplate(): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("은행입금내역");
  sheet.columns = [
    { header: "고객번호", key: "customerNo", width: 16 },
    { header: "입금자명", key: "name", width: 16 },
    { header: "입금액", key: "amount", width: 14 },
    { header: "입금일", key: "paidAt", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ customerNo: "1000123", name: "홍길동", amount: 150000, paidAt: "2026-08-15" });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "은행입금내역_양식.xlsx";
  anchor.click();
  URL.revokeObjectURL(url);
}
