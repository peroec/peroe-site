import { Link } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';

/**
 * 全站唯一的分页控件 —— 博客 `/posts`、论坛 `/`、友链 `/friends` 共用这一份。
 * 此前三处各写各的：博客只有「← 上一页 / 3 / 12 / 下一页 →」没有页码，
 * 论坛有页码窗口，友链把所有页码一口气全列出来（12 页就是 12 个按钮）。
 *
 * 形态（14 页时）：
 *   停在第 1 页  <-  1 2 3 4 5 6 7 … 14  ->
 *   停在第 7 页  <-  1 … 5 6 7 8 9 … 14  ->
 *
 * 必须是真链接（`<a href>`），不能是 onClick 按钮：禁用 JS 时翻不了页，
 * 爬虫也发现不了第 2 页往后的内容。RR 的 <Link> 在有 JS 时仍走客户端导航。
 */

/** 首尾各固定露出的页数 */
const BOUNDARY = 1;
/** 当前页两侧各露出的页数：窄屏 1、sm 起 2 */
const NARROW_SIBLINGS = 1;
const WIDE_SIBLINGS = 2;

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

/**
 * 算出该露出哪些页码。首尾各固定 `BOUNDARY` 页，当前页左右各 `siblings` 页；
 * **窗口贴到一端时向另一端补足**，所以 14 页里停在第 1 页看到的是
 * `1 2 3 4 5 6 7 … 14` 而不是 `1 2 3 … 14`，停在第 7 页则是
 * `1 … 5 6 7 8 9 … 14`。页数够少时这套规则自然退化成「全列」。
 *
 * 断开处只差一页时把那一页直接显示出来 —— `1 … 3 4` 里的省略号只省掉一个 2，
 * 占的宽度还更大。
 */
function windowPages(current: number, count: number, siblings: number): number[] {
  const startPages = range(1, Math.min(BOUNDARY, count));
  const endPages = range(Math.max(count - BOUNDARY + 1, BOUNDARY + 1), count);

  const siblingsStart = Math.max(
    Math.min(current - siblings, count - BOUNDARY - siblings * 2 - 1),
    BOUNDARY + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(current + siblings, BOUNDARY + siblings * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : count - 1,
  );

  return [
    ...startPages,
    ...(siblingsStart > BOUNDARY + 2
      ? []
      : BOUNDARY + 1 < count - BOUNDARY
        ? [BOUNDARY + 1]
        : []),
    ...range(siblingsStart, siblingsEnd),
    ...(siblingsEnd < count - BOUNDARY - 1
      ? []
      : count - BOUNDARY > BOUNDARY
        ? [count - BOUNDARY]
        : []),
    ...endPages,
  ];
}

type Slot =
  | { kind: 'page'; page: number; narrow: boolean }
  | { kind: 'gap'; narrow: boolean; wide: boolean };

/**
 * 把「窄屏那套」和「宽屏那套」合并成一份 DOM，靠 CSS 断点决定每一格露不露脸 ——
 * 而不是渲染两套控件再藏掉一套。窄屏页码集合一定是宽屏的子集（同一个中心、
 * 更小的半径、同样的贴边夹取），所以只要按宽屏那串走一遍，
 * 顺手记下每一格在窄屏里可见与否即可。省略号两边各自判断：
 * 窄屏藏掉几个页码后可能多出一处断裂，那里要补一个只在窄屏出现的「…」。
 */
function buildSlots(current: number, count: number): Slot[] {
  const wide = windowPages(current, count, WIDE_SIBLINGS);
  const narrowSet = new Set(windowPages(current, count, NARROW_SIBLINGS));
  const slots: Slot[] = [];
  let prevWide: number | null = null;
  let prevNarrow: number | null = null;
  for (const p of wide) {
    const inNarrow = narrowSet.has(p);
    const wideGap = prevWide !== null && p - prevWide > 1;
    const narrowGap = inNarrow && prevNarrow !== null && p - prevNarrow > 1;
    if (wideGap || narrowGap) slots.push({ kind: 'gap', narrow: narrowGap, wide: wideGap });
    slots.push({ kind: 'page', page: p, narrow: inNarrow });
    prevWide = p;
    if (inNarrow) prevNarrow = p;
  }
  return slots;
}

/** 只在窄屏 / 只在宽屏 / 两边都出现 —— 对应的 Tailwind 可见性类 */
function visibility(narrow: boolean, wide: boolean): string {
  if (narrow && wide) return 'inline-flex';
  return narrow ? 'inline-flex sm:hidden' : 'hidden sm:inline-flex';
}

const CELL = 'items-center justify-center h-8 min-w-8 px-2 border text-sm transition-colors';
const IDLE = 'border-input bg-transparent hover:bg-accent';
const ACTIVE = 'border-primary bg-primary text-primary-foreground';
const DISABLED = 'border-input bg-transparent opacity-40 pointer-events-none';

export function Pagination({
  page,
  pageCount,
  hrefFor,
  className,
}: {
  /** 当前页，**1 基**（URL 里是 0 基的调用方自己换算，见 /posts） */
  page: number;
  pageCount: number;
  /** 1 基页码 → 链接地址；调用方在这里保留自己的筛选参数 */
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-1 mt-8 ${className ?? ''}`}
      aria-label="分页导航"
    >
      {current > 1 ? (
        <Link to={hrefFor(current - 1)} rel="prev" aria-label="上一页" className={`inline-flex ${CELL} ${IDLE}`}>
          <Icon icon="mdi:chevron-left" className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={`inline-flex ${CELL} ${DISABLED}`}>
          <Icon icon="mdi:chevron-left" className="size-4" />
        </span>
      )}

      {buildSlots(current, pageCount).map((slot, i) =>
        slot.kind === 'gap' ? (
          <span
            key={`gap-${i}`}
            aria-hidden
            className={`${visibility(slot.narrow, slot.wide)} h-8 min-w-4 items-center justify-center px-1 text-muted-foreground`}
          >
            …
          </span>
        ) : (
          <Link
            key={slot.page}
            to={hrefFor(slot.page)}
            aria-current={slot.page === current ? 'page' : undefined}
            className={`${visibility(slot.narrow, true)} ${CELL} ${slot.page === current ? ACTIVE : IDLE}`}
          >
            {slot.page}
          </Link>
        ),
      )}

      {current < pageCount ? (
        <Link to={hrefFor(current + 1)} rel="next" aria-label="下一页" className={`inline-flex ${CELL} ${IDLE}`}>
          <Icon icon="mdi:chevron-right" className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={`inline-flex ${CELL} ${DISABLED}`}>
          <Icon icon="mdi:chevron-right" className="size-4" />
        </span>
      )}
    </nav>
  );
}
