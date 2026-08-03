import { SITE_NAME } from "~/lib/site";

/**
 * 页脚。构建时间在构建期注入（vite define __BUILD_TIME__），
 * SSR 与客户端同值，无需挂载后再取当前时间（此前显示的是"每次刷新的当前时间"，误导）。
 */
export function Footer() {
  return (
    <footer className="border-t border-border py-10 text-center text-sm text-muted-2">
      <p className="mb-2">© {new Date().getFullYear()} {SITE_NAME}</p>
      <p className="text-xs">
        构建时间：{__BUILD_TIME__}
      </p>
    </footer>
  );
}
