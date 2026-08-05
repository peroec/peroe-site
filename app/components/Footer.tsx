import { SITE_NAME } from "~/lib/site";

/**
 * 页脚。构建时间与年份都在构建期注入（vite define __BUILD_TIME__ / __BUILD_YEAR__），
 * SSR 与客户端同值，无需每次请求实时取时间（#185：注释与行为一致）。
 */
export function Footer() {
  return (
    <footer className="border-t border-border py-10 text-center text-sm text-muted-2">
      <p className="mb-2">© {__BUILD_YEAR__} {SITE_NAME}</p>
      <p className="text-xs">
        构建时间：{__BUILD_TIME__}
      </p>
    </footer>
  );
}
