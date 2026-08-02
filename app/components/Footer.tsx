import { useEffect, useState } from "react";
import { SITE_NAME } from "~/lib/site";

/**
 * 页脚。构建时间必须客户端挂载后再渲染：
 * SSR 与客户端水合时 new Date() 不同（秒级），直接渲染会导致
 * React 418 水合错误（text mismatch）。
 */
export function Footer() {
  const [builtAt, setBuiltAt] = useState<string | null>(null);

  useEffect(() => {
    setBuiltAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  }, []);

  return (
    <footer className="border-t border-border py-10 text-center text-sm text-muted-2">
      <p className="mb-2">© {new Date().getFullYear()} {SITE_NAME}</p>
      <p className="text-xs">
        构建时间：{builtAt ?? "…"}
      </p>
    </footer>
  );
}
