import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { ArrowUp, MessageSquare, Link2, Check } from "lucide-react";

/**
 * 右下角浮动操作堆（复刻原站交互）：
 * 1. 回到顶部 —— 滚动超过 400px 才出现
 * 2. 去评论区 —— 仅在页面存在评论区锚点（#comments）时显示
 * 3. 复制当前页面链接 —— 用 clipboard API 写整 URL，避免手动复制的中文/特殊字符编码问题
 */
export function FloatingActions() {
  const location = useLocation();
  const [showTop, setShowTop] = useState(false);
  const [copied, setCopied] = useState(false);
  // 评论区锚点是否存在于当前页面（SSR 直出后 DOM 已有；客户端导航后重新检测）
  const [hasComments, setHasComments] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setHasComments(!!document.getElementById("comments"));
    setCopied(false);
  }, [location.pathname, location.search]);

  const goToComments = () => {
    const el = document.getElementById("comments");
    if (!el) return;
    // 用 scrollIntoView + 手动偏移，避免 fixed header 遮挡评论区标题
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const copyLink = async () => {
    // 复制完整 URL（含当前查询参数与锚点）；失败时退回 textarea 方案
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="回到顶部"
          title="回到顶部"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted shadow-lg transition-colors hover:text-white"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
      {hasComments && (
        <button
          type="button"
          onClick={goToComments}
          aria-label="去评论区"
          title="去评论区"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted shadow-lg transition-colors hover:text-white"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={copyLink}
        aria-label="复制当前页面链接"
        title="复制当前页面链接"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted shadow-lg transition-colors hover:text-white"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
