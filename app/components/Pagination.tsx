import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
}

/** 复刻线上的分页条：< 1 2 3 4 5 6 > */
export function Pagination({ page, totalPages }: Props) {
  const [params] = useSearchParams();
  if (totalPages <= 1) return null;

  const makeTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `?${next.toString()}`;
  };

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5 text-sm">
      {page > 1 && (
        <Link
          to={makeTo(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:text-white"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          to={makeTo(p)}
          className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
            p === page
              ? "border-white bg-white font-semibold text-black"
              : "border-border text-muted hover:text-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          to={makeTo(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:text-white"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
