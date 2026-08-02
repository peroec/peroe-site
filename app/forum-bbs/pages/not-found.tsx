import { Link } from "react-router";
import { Button } from "@/forum-bbs/components/ui/button";
import { useSeo } from "@/forum-bbs/lib/seo/use-seo";

/**
 * 兜底 404。纯 CSR 下服务器对任何路径都回同一份 index.html，
 * 「这个地址不存在」只能由路由在浏览器里判定 —— 所以状态码永远是 200，
 * 想让搜索引擎正确处理请在托管侧配规则（见 README）。
 */
export function Component() {
  useSeo();
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-mono text-5xl font-bold">404</h1>
      <p className="mt-4 text-muted-foreground">你访问的页面不存在。</p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="outline" size="sm">← 返回论坛</Button>
      </Link>
    </main>
  );
}
