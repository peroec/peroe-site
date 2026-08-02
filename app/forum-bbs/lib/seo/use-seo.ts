import { useEffect } from "react";
import { useLocation } from "react-router";
import { applySeo, type PageSeo } from "./apply-seo";
import { resolveRouteMeta, stripBase } from "./route-meta";

/**
 * 纯 CSR 下的 `<head>` 维护。
 *
 * SSR 版本里这活儿归路由的 `meta()`，服务端直出；这里没有服务端，只能在
 * 挂载/路由变化后改 DOM。**首帧的兜底值写在 index.html 里**，不要指望这里
 * 能让爬虫看到 —— 不执行 JS 的抓取工具拿到的永远是 index.html 那一份。
 *
 * 不传参时按当前路径查表（静态页够用）；详情页把动态数据拼好后自己传。
 */
export function useSeo(seo?: PageSeo) {
  const { pathname } = useLocation();
  // 对象字面量每次渲染都是新引用，用序列化后的值做依赖，避免每帧重写 <head>
  const key = seo ? JSON.stringify(seo) : "";

  useEffect(() => {
    if (key) {
      applySeo(JSON.parse(key) as PageSeo);
      return;
    }
    const meta = resolveRouteMeta(pathname);
    applySeo({
      title: meta.title,
      description: meta.description,
      noindex: meta.noindex,
      ogType: meta.ogType,
      path: stripBase(pathname),
    });
  }, [key, pathname]);
}
