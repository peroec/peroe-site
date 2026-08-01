import { SITE_NAME } from "~/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border py-10 text-center text-sm text-muted-2">
      <p className="mb-2">© {new Date().getFullYear()} {SITE_NAME}</p>
      <p className="text-xs">
        构建时间：{new Date().toLocaleString("zh-CN", { hour12: false })}
      </p>
    </footer>
  );
}
