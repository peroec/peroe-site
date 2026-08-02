"use client";

import { useEffect, useRef, useState } from "react";
import type { TocItem } from "@/forum-bbs/lib/build-toc";

/**
 * 博客文章目录侧栏（SSR 直出标题数据，客户端加 scroll-spy 高亮）。
 * 与 TableOfContents 不同：不需要 DOM 扫描，标题由服务端 buildToc() 提供。
 */
export function PostToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    if (items.length === 0) return;

    const THRESHOLD = 80; // 与 prose-headings:scroll-mt-20 (5rem) 对齐

    const update = () => {
      let best = "";
      let bestTop = Infinity;

      // 找出阈值以下、离阈值最近的标题（正在读的章节）
      for (const h of items) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top >= THRESHOLD && top < bestTop) {
          bestTop = top;
          best = h.id;
        }
      }

      // 所有标题都在阈值上方 → 取最后一个在阈值上方的（页面顶部还没滚到第一个标题）
      if (!best) {
        let lastAbove = "";
        let lastAboveTop = -Infinity;
        for (const h of items) {
          const el = document.getElementById(h.id);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top < THRESHOLD && top > lastAboveTop) {
            lastAboveTop = top;
            lastAbove = h.id;
          }
        }
        if (lastAbove) best = lastAbove;
      }

      // 兜底：没有任何匹配时高亮第一个
      if (!best && items.length > 0) best = items[0].id;

      if (best && best !== activeRef.current) setActiveId(best);
    };

    window.addEventListener("scroll", update, { passive: true });
    update(); // 页面加载后立即跑一次（处理带 hash 锚点进入的情况）

    return () => window.removeEventListener("scroll", update);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block w-[320px] flex-shrink-0 sticky top-20 self-start">
      {/* 与正文一致的去卡片处理：边界只用一条竖线交代 */}
      <div className="border-l border-border pl-4">
        <p className="text-sm font-medium mb-3 text-muted-foreground">目录</p>
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {items.map((h) => {
            const active = activeId === h.id;
            return (
              <li key={h.id} className={h.level === 3 ? "pl-4" : ""}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(h.id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                    window.history.pushState({}, "", `#${h.id}`);
                  }}
                  className={`block truncate px-2 -mx-2 py-0.5 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  {h.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
