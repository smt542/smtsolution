import { Button } from "./Button";
import { Select } from "./Select";

/**
 * 1-based 페이지네이션 컨트롤: 이전/다음 + `{page} / {totalPages}` 표시.
 * 페이지 크기 select는 `pageSize`·`pageSizeOptions`·`onPageSizeChange`가 모두
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
        <Select
          aria-label="페이지당 건수"
          className="w-28"
          options={pageSizeOptions.map((n) => ({
            value: String(n),
            label: `${n}건`,
          }))}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        />
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
