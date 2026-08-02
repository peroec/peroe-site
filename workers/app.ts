import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    void env;
    void ctx;
    const response = await requestHandler(request);

    // 静态内容（博客/工具页/RSS）加边缘缓存：内容按构建产物固定，
    // 不缓存论坛（/forum 是 clientLoader 动态数据）、登录态相关与提交动作。
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const isStatic =
      method === "GET" &&
      !url.pathname.startsWith("/forum") &&
      !url.pathname.startsWith("/api/") &&
      (url.pathname.startsWith("/posts") ||
        url.pathname.startsWith("/cover") ||
        url.pathname.startsWith("/watermark") ||
        url.pathname.startsWith("/convert") ||
        url.pathname.startsWith("/bilibili-cover") ||
        url.pathname.startsWith("/tier") ||
        url.pathname.startsWith("/files") ||
        url.pathname.startsWith("/friends") ||
        url.pathname.startsWith("/sponsors") ||
        url.pathname.startsWith("/anime") ||
        url.pathname === "/");

    if (isStatic && response.status < 400) {
      // 边缘缓存 60s + 客户端缓存 10s：兼顾性能与内容更新的及时性
      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300, max-age=10");
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
