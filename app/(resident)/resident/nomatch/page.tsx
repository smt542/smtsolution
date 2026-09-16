import ResidentNomatchClient from "./ResidentNomatchClient";
export default function ResidentNomatchPage() {
  return (
    <ResidentNomatchClient
      icon={
        <div className="flex size-[58px] animate-[pop_0.45s_cubic-bezier(0.22,0.61,0.36,1)_both] items-center justify-center rounded-[19px] bg-amber-t text-amber [&_svg]:size-7">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" />
            <path d="M11 8v3M11 14v.4" />
          </svg>
        </div>
      }
    >
      <div className="mt-6 rounded-[18px] border border-line px-4 py-1.5 animate-[rise_0.5s_160ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <div className="flex gap-[11px] border-b border-line2 py-[15px] last:border-b-0 [&_b]:block [&_b]:text-[14.5px] [&_b]:font-bold [&_b]:tracking-[-0.01em] [&_span]:mt-1 [&_span]:block [&_span]:text-[12.5px] [&_span]:font-medium [&_span]:leading-[1.6] [&_span]:text-t3">
          <div className="mt-px flex size-[22px] flex-none items-center justify-center rounded-lg bg-bg text-[11.5px] font-extrabold text-t3">1</div>
          <div>
            <b>관리사무소에 등록된 번호가 다를 수 있어요</b>
            <span>계약서에 적은 번호와 카카오 계정 번호가 다른 경우예요</span>
          </div>
        </div>
        <div className="flex gap-[11px] border-b border-line2 py-[15px] last:border-b-0 [&_b]:block [&_b]:text-[14.5px] [&_b]:font-bold [&_b]:tracking-[-0.01em] [&_span]:mt-1 [&_span]:block [&_span]:text-[12.5px] [&_span]:font-medium [&_span]:leading-[1.6] [&_span]:text-t3">
          <div className="mt-px flex size-[22px] flex-none items-center justify-center rounded-lg bg-bg text-[11.5px] font-extrabold text-t3">2</div>
          <div>
            <b>입주 등록이 아직 안 됐을 수 있어요</b>
            <span>입주 직후에는 관리사무소 등록까지 하루 정도 걸려요</span>
          </div>
        </div>
        <div className="flex gap-[11px] py-[15px] [&_b]:block [&_b]:text-[14.5px] [&_b]:font-bold [&_b]:tracking-[-0.01em] [&_span]:mt-1 [&_span]:block [&_span]:text-[12.5px] [&_span]:font-medium [&_span]:leading-[1.6] [&_span]:text-t3">
          <div className="mt-px flex size-[22px] flex-none items-center justify-center rounded-lg bg-bg text-[11.5px] font-extrabold text-t3">3</div>
          <div>
            <b>세대주 명의가 가족일 수 있어요</b>
            <span>
              계약자 본인 번호로 가입된 카카오 계정으로 로그인해 주세요
            </span>
          </div>
        </div>
      </div>
    </ResidentNomatchClient>
  );
}
