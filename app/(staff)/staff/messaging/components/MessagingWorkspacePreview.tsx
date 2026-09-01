export function MessagingWorkspacePreview({
  senderPhone,
  body,
}: {
  senderPhone: string;
  body: string;
}) {
  return (
    <section aria-label="메시지 미리보기" className="w-[238px] shrink-0">
      <div className="h-[25px] pb-[8px] text-[12.5px] font-bold text-t2 opacity-0">미리보기</div>
      <div className="h-[260px] overflow-hidden rounded-[16px] border border-line bg-[#f7f8fa] px-[12px] py-[13px]">
        <div className="flex h-[24px] items-start justify-between pb-[9px]">
          <span className="text-[10.5px] font-bold text-t3">발신 {senderPhone}</span>
          <span className="rounded-[6px] bg-[#e2f5f1] px-[8px] py-[2px] text-[9.5px] font-extrabold text-[#0e8677]">
            문자
          </span>
        </div>
        <div className="mb-[8px] flex justify-center">
          <span className="rounded-[10px] border border-line2 bg-white px-[9px] py-[2px] text-[9px] font-bold text-t4">
            오늘
          </span>
        </div>
        <div className="max-h-[188px] overflow-hidden rounded-bl-[16px] rounded-br-[16px] rounded-tl-[5px] rounded-tr-[16px] bg-white px-[13px] py-[10px] text-[12px] font-medium leading-[18.6px] whitespace-pre-wrap text-[#1a1f27] shadow-[0_2px_4px_rgba(23,31,40,0.12)]">
          {body || "메시지 내용을 입력하면 미리보기가 표시돼요"}
        </div>
        <p className="pt-[5px] text-[9.5px] font-semibold text-t4">방금 전</p>
      </div>
    </section>
  );
}
