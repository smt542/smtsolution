import { Button } from "./Button";
import { CustomDropdown } from "./CustomDropdown";

/**
 * 1-based 페이지네이션 컨트롤: 이전/다음 + `{page} / {totalPages}` 표시.
 * 페이지 크기 드롭다운은 `pageSize`·`pageSizeOptions`·`onPageSizeChange`가 모두
 * 주어질 때만 왼쪽에 노출된다(그때 컨테이너는 justify-between, 없으면 justify-end).
 * 페이지 상태는 호출부가 소유하고, 여기서는 표시와 콜백만 담당한다.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  className = "",
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}) {
  const showPageSize =
    pageSize != null && pageSizeOptions != null && onPageSizeChange != null;

  return (
    <div
      className={[
        "flex items-center",
        showPageSize ? "justify-between" : "justify-end",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showPageSize && (
        // 네이티브 select 금지(QA 공통 규칙) — 트리거는 예전 select 크기(44px·112px·r12·14px) 그대로
        <div className="[&_.uc-dd-btn]:h-11 [&_.uc-dd-btn]:w-28 [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-xl [&_.uc-dd-btn]:pl-4 [&_.uc-dd-btn]:pr-4 [&_.uc-dd-btn]:text-sm [&_.uc-dd-btn]:font-normal">
          <CustomDropdown
            chevron="rotate"
            ariaLabel="페이지당 건수"
            value={String(pageSize)}
            options={pageSizeOptions.map((n) => ({
              value: String(n),
              label: `${n}건`,
            }))}
            position="fixed"
            onChange={(value) => onPageSizeChange(Number(value))}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전
        </Button>
        <span className="text-sm text-t3">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
