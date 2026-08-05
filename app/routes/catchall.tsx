import { Link, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/catchall";

export function meta() {
  return [{ title: "页面不存在 | peroe" }];
}

// 未知路径返回真 404（而非 200+404 页面），避免搜索引擎收录垃圾 URL
export function loader(_: Route.LoaderArgs) {
  throw new Response(null, { status: 404, statusText: "Not Found" });
}

// #182：此前自定义 404 是死代码——loader 恒 throw 404，React Router 渲染的是根
// ErrorBoundary（英文 "Not Found"），这里精心做的 404 设计从未显示。
// 导出 ErrorBoundary 接管 404 渲染。
export function ErrorBoundary({ error }: { error: unknown }) {
  // 用 isRouteErrorResponse 判定（loader throw 的 Response 经 React Router 包装后
  // 不是原生 Response 实例，instanceof 判定会失败——#182 实测踩坑）
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-28 text-center">
      <p className="text-6xl font-bold text-neutral-800">404</p>
      <h1 className="mt-4 text-xl font-bold text-white">{is404 ? "页面不存在" : "出错了"}</h1>
      {!is404 && (
        <p className="mt-2 text-sm text-muted">
          {error instanceof Error ? error.message : isRouteErrorResponse(error) ? String(error.statusText || error.status) : ""}
        </p>
      )}
      <Link
        to="/"
        reloadDocument
        className="mt-8 rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
      >
        返回首页
      </Link>
    </main>
  );
}

export default function CatchAll() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-28 text-center">
      <p className="text-6xl font-bold text-neutral-800">404</p>
      <h1 className="mt-4 text-xl font-bold text-white">页面不存在</h1>
      <Link
        to="/"
        reloadDocument
        className="mt-8 rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
      >
        返回首页
      </Link>
    </main>
  );
}
